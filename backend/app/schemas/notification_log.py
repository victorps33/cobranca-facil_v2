from datetime import datetime

from pydantic import BaseModel


class ChargeBrief(BaseModel):
    id: str
    customerId: str
    description: str
    amountCents: int
    dueDate: datetime
    status: str
    customer: "CustomerBrief | None" = None

    model_config = {"from_attributes": True}


class CustomerBrief(BaseModel):
    id: str
    name: str
    doc: str
    email: str
    phone: str

    model_config = {"from_attributes": True}


class StepBrief(BaseModel):
    id: str
    ruleId: str
    trigger: str
    offsetDays: int
    channel: str
    template: str
    enabled: bool

    model_config = {"from_attributes": True}


class NotificationLogOut(BaseModel):
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
    charge: ChargeBrief | None = None
    step: StepBrief | None = None

    model_config = {"from_attributes": True}


ChargeBrief.model_rebuild()
