import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.app_state import AppState
from app.models.charge import Charge
from app.models.dunning import DunningStep
from app.models.notification_log import NotificationLog
from app.schemas.dunning import DunningRunResult

router = APIRouter(prefix="/api/dunning", tags=["dunning-run"])


@router.post("/run", response_model=DunningRunResult)
async def run_dunning(db: AsyncSession = Depends(get_db)):
    # Get current date (simulated or real)
    app_state_result = await db.execute(select(AppState).where(AppState.id == 1))
    app_state = app_state_result.scalar_one_or_none()
    now = app_state.simulatedNow if app_state and app_state.simulatedNow else datetime.utcnow()

    # Get enabled steps with active rules
    steps_result = await db.execute(
        select(DunningStep)
        .where(DunningStep.enabled == True)  # noqa: E712
        .options(selectinload(DunningStep.rule))
    )
    steps = [s for s in steps_result.scalars().all() if s.rule.active]

    # Get pending/overdue charges with customers
    charges_result = await db.execute(
        select(Charge)
        .where(Charge.status.in_(["PENDING", "OVERDUE"]))
        .options(selectinload(Charge.customer))
    )
    charges = charges_result.scalars().all()

    notifications_created = 0

    for charge in charges:
        due_date = charge.dueDate
        if due_date.tzinfo:
            from datetime import timezone
            now_aware = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now
            diff_days = round((now_aware - due_date).total_seconds() / 86400)
        else:
            diff_days = round((now - due_date).total_seconds() / 86400)

        # Mark as OVERDUE if past due
        if diff_days > 0 and charge.status == "PENDING":
            charge.status = "OVERDUE"

        for step in steps:
            should_trigger = False
            if step.trigger == "BEFORE_DUE" and diff_days == -step.offsetDays:
                should_trigger = True
            if step.trigger == "ON_DUE" and diff_days == 0:
                should_trigger = True
            if step.trigger == "AFTER_DUE" and diff_days == step.offsetDays:
                should_trigger = True

            if should_trigger:
                # Check existing log
                existing = await db.execute(
                    select(NotificationLog).where(
                        NotificationLog.chargeId == charge.id,
                        NotificationLog.stepId == step.id,
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                rendered = (
                    step.template
                    .replace("{{nome}}", charge.customer.name)
                    .replace("{{valor}}", f"R$ {charge.amountCents / 100:.2f}")
                    .replace("{{vencimento}}", due_date.strftime("%d/%m/%Y"))
                    .replace("{{descricao}}", charge.description)
                )

                log = NotificationLog(
                    chargeId=charge.id,
                    stepId=step.id,
                    channel=step.channel,
                    status="SENT",
                    scheduledFor=now,
                    sentAt=now,
                    renderedMessage=rendered,
                    metaJson=json.dumps({"trigger": step.trigger, "offsetDays": step.offsetDays}),
                )
                db.add(log)
                notifications_created += 1

    await db.commit()

    return DunningRunResult(
        success=True,
        notificationsCreated=notifications_created,
        processedCharges=len(charges),
    )
