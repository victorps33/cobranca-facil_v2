from datetime import datetime

from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    doc: str
    email: str
    phone: str


class CustomerUpdate(BaseModel):
    name: str | None = None
    doc: str | None = None
    email: str | None = None
    phone: str | None = None


class CustomerOut(BaseModel):
    id: str
    name: str
    doc: str
    email: str
    phone: str
    createdAt: datetime
    charges: list["ChargeOut"] = []

    model_config = {"from_attributes": True}


class ChargeOut(BaseModel):
    id: str
    customerId: str
    description: str
    amountCents: int
    dueDate: datetime
    status: str
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}


# Avoid circular import
CustomerOut.model_rebuild()
