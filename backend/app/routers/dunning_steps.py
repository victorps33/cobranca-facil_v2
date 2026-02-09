from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.dunning import DunningStep
from app.schemas.dunning import DunningStepCreate, DunningStepOut, DunningStepUpdate

router = APIRouter(prefix="/api/dunning-steps", tags=["dunning-steps"])


@router.get("", response_model=list[DunningStepOut])
async def list_steps(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DunningStep)
        .options(selectinload(DunningStep.rule))
        .order_by(DunningStep.offsetDays.asc())
    )
    return result.scalars().all()


@router.post("", response_model=DunningStepOut, status_code=201)
async def create_step(body: DunningStepCreate, db: AsyncSession = Depends(get_db)):
    step = DunningStep(
        ruleId=body.ruleId,
        trigger=body.trigger,
        offsetDays=body.offsetDays,
        channel=body.channel,
        template=body.template,
        enabled=body.enabled,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return step


@router.get("/{step_id}", response_model=DunningStepOut)
async def get_step(step_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DunningStep)
        .where(DunningStep.id == step_id)
        .options(selectinload(DunningStep.rule))
    )
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step não encontrado")
    return step


@router.patch("/{step_id}", response_model=DunningStepOut)
async def update_step(step_id: str, body: DunningStepUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DunningStep).where(DunningStep.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=500, detail="Erro ao atualizar step")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(step, field, value)
    await db.commit()
    await db.refresh(step)
    return step


@router.delete("/{step_id}")
async def delete_step(step_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DunningStep).where(DunningStep.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=500, detail="Erro ao excluir step")
    await db.delete(step)
    await db.commit()
    return {"success": True}
