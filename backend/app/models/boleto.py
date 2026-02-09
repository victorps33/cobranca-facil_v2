from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

cuid_generate = cuid_wrapper()


class Boleto(Base):
    __tablename__ = "Boleto"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_generate)
    chargeId: Mapped[str] = mapped_column(String, ForeignKey("Charge.id", ondelete="CASCADE"), unique=True)
    linhaDigitavel: Mapped[str] = mapped_column(String)
    barcodeValue: Mapped[str] = mapped_column(String)
    publicUrl: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    charge: Mapped["Charge"] = relationship(back_populates="boleto")  # noqa: F821
