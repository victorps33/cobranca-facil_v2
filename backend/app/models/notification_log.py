from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Channel, NotificationStatus

cuid_generate = cuid_wrapper()


class NotificationLog(Base):
    __tablename__ = "NotificationLog"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_generate)
    chargeId: Mapped[str] = mapped_column(String, ForeignKey("Charge.id", ondelete="CASCADE"))
    stepId: Mapped[str] = mapped_column(String, ForeignKey("DunningStep.id", ondelete="CASCADE"))
    channel: Mapped[Channel] = mapped_column(
        Enum(Channel, name="Channel", create_type=False),
    )
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="NotificationStatus", create_type=False),
    )
    scheduledFor: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sentAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    renderedMessage: Mapped[str] = mapped_column(String)
    metaJson: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    charge: Mapped["Charge"] = relationship(back_populates="notificationLogs")  # noqa: F821
    step: Mapped["DunningStep"] = relationship(back_populates="notificationLogs")  # noqa: F821

    __table_args__ = (
        Index("NotificationLog_chargeId_idx", "chargeId"),
        Index("NotificationLog_stepId_idx", "stepId"),
        Index("NotificationLog_scheduledFor_idx", "scheduledFor"),
    )
