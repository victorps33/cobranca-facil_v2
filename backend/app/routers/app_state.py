from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.app_state import AppState
from app.models.charge import Charge

router = APIRouter(prefix="/api/app-state", tags=["app-state"])


@router.get("")
async def get_app_state(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(AppState).where(AppState.id == 1))
        app_state = result.scalar_one_or_none()
        now = app_state.simulatedNow if app_state and app_state.simulatedNow else datetime.utcnow()
        is_simulated = bool(app_state and app_state.simulatedNow)

        total, pending, paid, overdue = await _get_counts(db)
        total_amount_result = await db.execute(select(func.sum(Charge.amountCents)))
        total_amount = total_amount_result.scalar() or 0

        paid_amount_result = await db.execute(
            select(func.sum(Charge.amountCents)).where(Charge.status == "PAID")
        )
        paid_amount = paid_amount_result.scalar() or 0

        return {
            "date": now.isoformat(),
            "isSimulated": is_simulated,
            "demoDate": now.isoformat() if is_simulated else None,
            "stats": {
                "total": total,
                "pending": pending,
                "paid": paid,
                "overdue": overdue,
                "totalAmount": total_amount,
                "paidAmount": paid_amount,
            },
        }
    except Exception:
        # Fallback with dummy-derived data
        from app.data.cobrancas_dummy import cobrancas_dummy, get_cobrancas_stats
        from app.data.apuracao_historico_dummy import ciclos_historico

        latest = ciclos_historico[0]
        cobs = [c for c in cobrancas_dummy if c["competencia"] == latest["competencia"]]
        stats = get_cobrancas_stats(cobs)

        return {
            "date": datetime.utcnow().isoformat(),
            "isSimulated": False,
            "demoDate": None,
            "stats": {
                "total": stats["total"],
                "pending": stats["byStatus"]["aberta"],
                "paid": stats["byStatus"]["paga"],
                "overdue": stats["byStatus"]["vencida"],
                "totalAmount": stats["totalEmitido"],
                "paidAmount": stats["totalPago"],
            },
        }


async def _get_counts(db: AsyncSession):
    total = (await db.execute(select(func.count(Charge.id)))).scalar() or 0
    pending = (await db.execute(select(func.count(Charge.id)).where(Charge.status == "PENDING"))).scalar() or 0
    paid = (await db.execute(select(func.count(Charge.id)).where(Charge.status == "PAID"))).scalar() or 0
    overdue = (await db.execute(select(func.count(Charge.id)).where(Charge.status == "OVERDUE"))).scalar() or 0
    return total, pending, paid, overdue
