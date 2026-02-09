from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Channel, DunningTrigger

cuid_generate = cuid_wrapper()


class DunningRule(Base):
    __tablename__ = "DunningRule"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_generate)
    name: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    timezone: Mapped[str] = mapped_column(String, default="America/Sao_Paulo")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    steps: Mapped[list["DunningStep"]] = relationship(back_populates="rule", cascade="all, delete-orphan")


class DunningStep(Base):
    __tablename__ = "DunningStep"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_generate)
    ruleId: Mapped[str] = mapped_column(String, ForeignKey("DunningRule.id", ondelete="CASCADE"))
    trigger: Mapped[DunningTrigger] = mapped_column(
        Enum(DunningTrigger, name="DunningTrigger", create_type=False),
    )
    offsetDays: Mapped[int] = mapped_column(Integer, default=0)
    channel: Mapped[Channel] = mapped_column(
        Enum(Channel, name="Channel", create_type=False),
    )
    template: Mapped[str] = mapped_column(String)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rule: Mapped["DunningRule"] = relationship(back_populates="steps")
    notificationLogs: Mapped[list["NotificationLog"]] = relationship(back_populates="step", cascade="all, delete-orphan")  # noqa: F821

    __table_args__ = (
        Index("DunningStep_ruleId_idx", "ruleId"),
        Index("DunningStep_trigger_idx", "trigger"),
        Index("DunningStep_enabled_idx", "enabled"),
    )
