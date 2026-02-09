from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.dunning import DunningRule
from app.schemas.dunning import DunningRuleOut, DunningRuleUpdate

router = APIRouter(prefix="/api/dunning-rules", tags=["dunning-rules"])


@router.get("/{rule_id}", response_model=DunningRuleOut)
async def get_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DunningRule)
        .where(DunningRule.id == rule_id)
        .options(selectinload(DunningRule.steps))
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Régua não encontrada")
    return rule


@router.patch("/{rule_id}", response_model=DunningRuleOut)
async def update_rule(rule_id: str, body: DunningRuleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DunningRule)
        .where(DunningRule.id == rule_id)
        .options(selectinload(DunningRule.steps))
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=500, detail="Erro ao atualizar régua")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DunningRule).where(DunningRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=500, detail="Erro ao excluir régua")
    await db.delete(rule)
    await db.commit()
    return {"success": True}
