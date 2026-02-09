from datetime import datetime

from sqlalchemy import DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppState(Base):
    __tablename__ = "AppState"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    simulatedNow: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
