from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.app_state import AppState
from app.schemas.simulation import SimulateRequest, SimulateResetResult, SimulateResult

router = APIRouter(prefix="/api/simulate", tags=["simulation"])


@router.post("", response_model=SimulateResult)
async def simulate(body: SimulateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppState).where(AppState.id == 1))
    app_state = result.scalar_one_or_none()
    current_date = app_state.simulatedNow if app_state and app_state.simulatedNow else datetime.utcnow()
    new_date = current_date + timedelta(days=body.days)

    if app_state:
        app_state.simulatedNow = new_date
    else:
        app_state = AppState(id=1, simulatedNow=new_date)
        db.add(app_state)

    await db.commit()

    return SimulateResult(
        success=True,
        previousDate=current_date.isoformat(),
        newDate=new_date.isoformat(),
        daysAdvanced=body.days,
    )


@router.post("/reset", response_model=SimulateResetResult)
async def simulate_reset(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppState).where(AppState.id == 1))
    app_state = result.scalar_one_or_none()

    if app_state:
        app_state.simulatedNow = None
    else:
        app_state = AppState(id=1, simulatedNow=None)
        db.add(app_state)

    await db.commit()

    return SimulateResetResult(success=True, date=datetime.utcnow().isoformat())
