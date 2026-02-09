from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.charge import Charge
from app.models.customer import Customer
from app.schemas.chat import MiaRequest
from app.services.ai_service import get_mia_mock_response

router = APIRouter(prefix="/api/mia", tags=["mia"])


async def _get_context_data(db: AsyncSession) -> dict | None:
    try:
        charges_result = await db.execute(
            select(Charge)
            .options(selectinload(Charge.customer))
            .order_by(Charge.createdAt.desc())
            .limit(100)
        )
        charges = charges_result.scalars().all()

        from sqlalchemy import func
        customer_count = (await db.execute(select(func.count(Customer.id)))).scalar() or 0

        total_revenue = sum(c.amountCents for c in charges if c.status == "PAID") / 100
        overdue = [c for c in charges if c.status == "OVERDUE"]
        pending = [c for c in charges if c.status == "PENDING"]

        return {
            "totalRevenue": total_revenue,
            "totalCustomers": customer_count,
            "overdueCount": len(overdue),
            "overdueTotal": sum(c.amountCents for c in overdue) / 100,
            "pendingCount": len(pending),
            "pendingTotal": sum(c.amountCents for c in pending) / 100,
        }
    except Exception:
        return None


@router.post("")
async def mia_chat(body: MiaRequest, db: AsyncSession = Depends(get_db)):
    if not body.message:
        return {"error": "Message is required"}, 400

    context = await _get_context_data(db)
    reply_markdown = get_mia_mock_response(body.message)

    return {
        "replyMarkdown": reply_markdown,
        "suggestedQuestions": [
            "Como está a taxa de recebimento?",
            "Quais ações priorizar esta semana?",
        ],
        "context": context,
    }
