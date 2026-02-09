from datetime import datetime

from pydantic import BaseModel


class FranqueadoraUpsert(BaseModel):
    nome: str
    razaoSocial: str
    email: str
    cnpj: str | None = None
    emailSecundario: str | None = None
    endereco: str | None = None
    celular: str | None = None
    celularSecundario: str | None = None
    telefone: str | None = None
    telefoneSecundario: str | None = None
    responsavel: str | None = None


class FranqueadoraOut(BaseModel):
    id: str
    nome: str
    razaoSocial: str
    cnpj: str | None = None
    email: str
    emailSecundario: str | None = None
    endereco: str | None = None
    celular: str | None = None
    celularSecundario: str | None = None
    telefone: str | None = None
    telefoneSecundario: str | None = None
    responsavel: str | None = None
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}
