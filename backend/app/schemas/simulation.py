from pydantic import BaseModel


class SimulateRequest(BaseModel):
    days: int = 7


class SimulateResult(BaseModel):
    success: bool
    previousDate: str
    newDate: str
    daysAdvanced: int


class SimulateResetResult(BaseModel):
    success: bool
    date: str
