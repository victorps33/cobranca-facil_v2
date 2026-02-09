from pydantic import BaseModel


class AppStateOut(BaseModel):
    date: str
    isSimulated: bool
    demoDate: str | None = None
    stats: "AppStats"


class AppStats(BaseModel):
    total: int
    pending: int
    paid: int
    overdue: int
    totalAmount: int
    paidAmount: int


AppStateOut.model_rebuild()
