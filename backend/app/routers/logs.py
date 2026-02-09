from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.charge import Charge
from app.models.notification_log import NotificationLog

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
async def list_logs(
    channel: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(NotificationLog)
        .options(
            selectinload(NotificationLog.charge).selectinload(Charge.customer),
            selectinload(NotificationLog.step),
        )
        .order_by(NotificationLog.createdAt.desc())
        .limit(100)
    )

    if channel and channel != "all":
        stmt = stmt.where(NotificationLog.channel == channel)
    if status and status != "all":
        stmt = stmt.where(NotificationLog.status == status)

    result = await db.execute(stmt)
    return result.scalars().all()
