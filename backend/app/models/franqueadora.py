from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

cuid_generate = cuid_wrapper()


class Franqueadora(Base):
    __tablename__ = "Franqueadora"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_generate)
    nome: Mapped[str] = mapped_column(String)
    razaoSocial: Mapped[str] = mapped_column(String)
    cnpj: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    emailSecundario: Mapped[str | None] = mapped_column(String, nullable=True)
    endereco: Mapped[str | None] = mapped_column(String, nullable=True)
    celular: Mapped[str | None] = mapped_column(String, nullable=True)
    celularSecundario: Mapped[str | None] = mapped_column(String, nullable=True)
    telefone: Mapped[str | None] = mapped_column(String, nullable=True)
    telefoneSecundario: Mapped[str | None] = mapped_column(String, nullable=True)
    responsavel: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
