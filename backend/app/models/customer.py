from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

cuid_generate = cuid_wrapper()


class Customer(Base):
    __tablename__ = "Customer"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_generate)
    name: Mapped[str] = mapped_column(String)
    doc: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    charges: Mapped[list["Charge"]] = relationship(back_populates="customer", cascade="all, delete-orphan")  # noqa: F821
