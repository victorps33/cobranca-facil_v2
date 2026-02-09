import enum

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class ChargeStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    CANCELED = "CANCELED"


class DunningTrigger(str, enum.Enum):
    BEFORE_DUE = "BEFORE_DUE"
    ON_DUE = "ON_DUE"
    AFTER_DUE = "AFTER_DUE"


class Channel(str, enum.Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"


class NotificationStatus(str, enum.Enum):
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
