import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.boleto import Boleto
from app.models.charge import Charge
from app.schemas.charge import ChargeCreate, ChargeListOut, ChargeOut, ChargeUpdate

router = APIRouter(prefix="/api/charges", tags=["charges"])


@router.get("", response_model=list[ChargeListOut])
async def list_charges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Charge)
        .options(selectinload(Charge.customer), selectinload(Charge.boleto))
        .order_by(Charge.createdAt.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ChargeListOut, status_code=201)
async def create_charge(body: ChargeCreate, db: AsyncSession = Depends(get_db)):
    charge = Charge(
        customerId=body.customerId,
        description=body.description,
        amountCents=body.amountCents,
        dueDate=datetime.fromisoformat(body.dueDate),
        status="PENDING",
    )
    db.add(charge)
    await db.commit()
    await db.refresh(charge, ["customer"])
    return charge


@router.get("/{charge_id}", response_model=ChargeOut)
async def get_charge(charge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Charge)
        .where(Charge.id == charge_id)
        .options(
            selectinload(Charge.customer),
            selectinload(Charge.boleto),
            selectinload(Charge.notificationLogs),
        )
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")
    return charge


@router.patch("/{charge_id}", response_model=ChargeListOut)
async def update_charge(charge_id: str, body: ChargeUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Charge).where(Charge.id == charge_id).options(selectinload(Charge.customer))
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(status_code=500, detail="Erro ao atualizar cobrança")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "dueDate" and value is not None:
            value = datetime.fromisoformat(value)
        setattr(charge, field, value)
    await db.commit()
    await db.refresh(charge)
    return charge


@router.delete("/{charge_id}")
async def delete_charge(charge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Charge).where(Charge.id == charge_id))
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(status_code=500, detail="Erro ao excluir cobrança")
    await db.delete(charge)
    await db.commit()
    return {"success": True}


@router.post("/{charge_id}/generate-boleto", status_code=201)
async def generate_boleto(charge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Charge).where(Charge.id == charge_id).options(selectinload(Charge.boleto))
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    if charge.boleto:
        return charge.boleto

    # Deterministic linha digitavel based on charge ID
    hash_digits = re.sub(r"[^0-9]", "", charge_id).ljust(47, "0")[:47]
    linha = (
        f"23793.{hash_digits[:5]} {hash_digits[5:15]}.{hash_digits[15:20]} "
        f"{hash_digits[20:30]}.{hash_digits[30:35]} {hash_digits[35:36]} {hash_digits[36:47]}"
    )
    barcode = hash_digits[:44]

    boleto = Boleto(
        chargeId=charge_id,
        linhaDigitavel=linha,
        barcodeValue=barcode,
        publicUrl=f"/boleto/{charge_id}",
    )
    db.add(boleto)
    await db.commit()
    await db.refresh(boleto)
    return boleto
