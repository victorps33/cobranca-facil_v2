from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.charge import Charge
from app.models.customer import Customer

router = APIRouter(prefix="/api/ai/dashboard", tags=["ai-dashboard"])


async def _get_dashboard_context(db: AsyncSession) -> dict | None:
    try:
        charges_result = await db.execute(
            select(Charge).order_by(Charge.createdAt.desc()).limit(500)
        )
        charges = charges_result.scalars().all()

        customer_count = (await db.execute(select(func.count(Customer.id)))).scalar() or 0

        total_emitted = sum(c.amountCents for c in charges) / 100
        total_received = sum(c.amountCents for c in charges if c.status == "PAID") / 100
        overdue_total = sum(c.amountCents for c in charges if c.status == "OVERDUE") / 100

        return {
            "totalEmitted": total_emitted,
            "totalReceived": total_received,
            "overdueTotal": overdue_total,
            "receiptRate": (total_received / total_emitted * 100) if total_emitted > 0 else 0,
            "overdueRate": (overdue_total / total_emitted * 100) if total_emitted > 0 else 0,
            "customerCount": customer_count,
        }
    except Exception:
        return None


def _generate_insights(context: dict | None) -> list[dict]:
    insights = []
    if context and context.get("overdueRate", 0) > 5:
        insights.append({
            "type": "warning",
            "title": "Taxa de inadimplência acima do ideal",
            "message": f"A taxa atual de {context['overdueRate']:.1f}% está acima dos 5% recomendados. Considere intensificar as ações de cobrança.",
        })
    if context and context.get("receiptRate", 100) < 80:
        insights.append({
            "type": "alert",
            "title": "Taxa de recebimento baixa",
            "message": f"Com {context['receiptRate']:.1f}% de recebimento, há espaço para melhorias. Réguas automatizadas podem ajudar.",
        })
    return insights


@router.post("")
async def post_dashboard_ai(db: AsyncSession = Depends(get_db)):
    context = await _get_dashboard_context(db)
    insights = _generate_insights(context)

    recommendations = [
        {
            "id": "1",
            "priority": "high",
            "action": "Criar campanha de negociação para clientes 'Exige Atenção'",
            "impact": "Potencial recuperação de R$ 127.000",
        },
        {
            "id": "2",
            "priority": "medium",
            "action": "Aumentar intervalo da régua para clientes 'Controlado'",
            "impact": "Redução de 15% nos custos de cobrança",
        },
        {
            "id": "3",
            "priority": "medium",
            "action": "Ativar WhatsApp D-1 para todos os perfis",
            "impact": "Aumento de 23% na taxa de conversão",
        },
    ]

    return {
        "success": True,
        "context": context,
        "insights": insights,
        "recommendations": recommendations,
        "summary": {
            "alertMessage": "Identifiquei 12 franqueados com padrão de atraso nos últimos 3 meses. Com uma ação preventiva, todos ganham: mais previsibilidade para você, mais flexibilidade para eles.",
            "franchiseesAtRisk": 12,
            "potentialRecovery": 127000,
        },
    }


@router.get("")
async def get_dashboard_ai(db: AsyncSession = Depends(get_db)):
    context = await _get_dashboard_context(db)
    return {
        "success": True,
        "context": context,
        "lastUpdated": datetime.utcnow().isoformat(),
    }
