import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.franqueadora import Franqueadora
from app.schemas.franqueadora import FranqueadoraOut, FranqueadoraUpsert

router = APIRouter(prefix="/api/franqueadora", tags=["franqueadora"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@router.get("")
async def get_franqueadora(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Franqueadora).limit(1))
    franqueadora = result.scalar_one_or_none()
    return franqueadora


@router.put("", response_model=FranqueadoraOut)
async def upsert_franqueadora(body: FranqueadoraUpsert, db: AsyncSession = Depends(get_db)):
    errors: list[str] = []
    if not body.nome or not body.nome.strip():
        errors.append("Nome é obrigatório")
    if not body.razaoSocial or not body.razaoSocial.strip():
        errors.append("Razão Social é obrigatória")
    if not body.email or not body.email.strip():
        errors.append("E-mail é obrigatório")
    elif not EMAIL_RE.match(body.email):
        errors.append("E-mail inválido")

    if body.emailSecundario and body.emailSecundario.strip() and not EMAIL_RE.match(body.emailSecundario):
        errors.append("E-mail secundário inválido")

    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    result = await db.execute(select(Franqueadora).limit(1))
    existing = result.scalar_one_or_none()

    data = {
        "nome": body.nome.strip(),
        "razaoSocial": body.razaoSocial.strip(),
        "email": body.email.strip(),
        "cnpj": body.cnpj.strip() if body.cnpj else None,
        "emailSecundario": body.emailSecundario.strip() if body.emailSecundario else None,
        "endereco": body.endereco.strip() if body.endereco else None,
        "celular": body.celular.strip() if body.celular else None,
        "celularSecundario": body.celularSecundario.strip() if body.celularSecundario else None,
        "telefone": body.telefone.strip() if body.telefone else None,
        "telefoneSecundario": body.telefoneSecundario.strip() if body.telefoneSecundario else None,
        "responsavel": body.responsavel.strip() if body.responsavel else None,
    }

    if existing:
        for key, value in data.items():
            setattr(existing, key, value)
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        franqueadora = Franqueadora(**data)
        db.add(franqueadora)
        await db.commit()
        await db.refresh(franqueadora)
        return franqueadora
