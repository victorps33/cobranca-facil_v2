from datetime import datetime

from pydantic import BaseModel


class DunningStepCreate(BaseModel):
    ruleId: str
    trigger: str
    offsetDays: int = 0
    channel: str
    template: str
    enabled: bool = True


class DunningStepUpdate(BaseModel):
    trigger: str | None = None
    offsetDays: int | None = None
    channel: str | None = None
    template: str | None = None
    enabled: bool | None = None


class DunningRuleUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None
    timezone: str | None = None


class DunningRuleBrief(BaseModel):
    id: str
    name: str
    active: bool
    timezone: str
    createdAt: datetime

    model_config = {"from_attributes": True}


class DunningStepOut(BaseModel):
    id: str
    ruleId: str
    trigger: str
    offsetDays: int
    channel: str
    template: str
    enabled: bool
    createdAt: datetime
    rule: DunningRuleBrief | None = None

    model_config = {"from_attributes": True}


class DunningRuleOut(BaseModel):
    id: str
    name: str
    active: bool
    timezone: str
    createdAt: datetime
    steps: list[DunningStepOut] = []

    model_config = {"from_attributes": True}


class DunningRunResult(BaseModel):
    success: bool
    notificationsCreated: int
    processedCharges: int
