from datetime import datetime

from pydantic import BaseModel


class BoletoOut(BaseModel):
    id: str
    chargeId: str
    linhaDigitavel: str
    barcodeValue: str
    publicUrl: str
    createdAt: datetime

    model_config = {"from_attributes": True}
