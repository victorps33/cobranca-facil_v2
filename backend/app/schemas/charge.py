from datetime import datetime

from pydantic import BaseModel


class ChargeCreate(BaseModel):
    customerId: str
    description: str
    amountCents: int
    dueDate: str  # ISO date string


class ChargeUpdate(BaseModel):
    description: str | None = None
    amountCents: int | None = None
    dueDate: str | None = None
    status: str | None = None


class BoletoOut(BaseModel):
    id: str
    chargeId: str
    linhaDigitavel: str
    barcodeValue: str
    publicUrl: str
    createdAt: datetime

    model_config = {"from_attributes": True}


class CustomerBrief(BaseModel):
    id: str
    name: str
    doc: str
    email: str
    phone: str
    createdAt: datetime

    model_config = {"from_attributes": True}


class NotificationLogBrief(BaseModel):
    id: str
    chargeId: str
    stepId: str
    channel: str
    status: str
    scheduledFor: datetime
    sentAt: datetime | None = None
    renderedMessage: str
    metaJson: str
    createdAt: datetime

    model_config = {"from_attributes": True}


class ChargeListOut(BaseModel):
    id: str
    customerId: str
    description: str
    amountCents: int
    dueDate: datetime
    status: str
    createdAt: datetime
    updatedAt: datetime
    customer: CustomerBrief | None = None
    boleto: BoletoOut | None = None

    model_config = {"from_attributes": True}


class ChargeOut(ChargeListOut):
    notificationLogs: list[NotificationLogBrief] = []
