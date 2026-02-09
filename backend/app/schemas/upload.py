from pydantic import BaseModel


class CadastroUploadResponse(BaseModel):
    franqueados: list[dict]
    warnings: list[str]
    summary: str


class ApuracaoRow(BaseModel):
    nome: str
    pdv: int
    ifood: int
    rappi: int
    total: int
    mesAnterior: int


class ApuracaoUploadRequest(BaseModel):
    rows: list[ApuracaoRow]
    headers: list[str]


class ApuracaoUploadResponse(BaseModel):
    summary: str
