from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, ChargeStatus

cuid_generate = cuid_wrapper()


class Charge(Base):
    __tablename__ = "Charge"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_generate)
    customerId: Mapped[str] = mapped_column(String, ForeignKey("Customer.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(String)
    amountCents: Mapped[int] = mapped_column(Integer)
    dueDate: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[ChargeStatus] = mapped_column(
        Enum(ChargeStatus, name="ChargeStatus", create_type=False),
        default=ChargeStatus.PENDING,
    )
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer: Mapped["Customer"] = relationship(back_populates="charges")  # noqa: F821
    boleto: Mapped["Boleto | None"] = relationship(back_populates="charge", uselist=False, cascade="all, delete-orphan")  # noqa: F821
    notificationLogs: Mapped[list["NotificationLog"]] = relationship(back_populates="charge", cascade="all, delete-orphan")  # noqa: F821

    __table_args__ = (
        Index("Charge_customerId_idx", "customerId"),
        Index("Charge_status_idx", "status"),
        Index("Charge_dueDate_idx", "dueDate"),
    )
