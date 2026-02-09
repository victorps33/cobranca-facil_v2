from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] | None = None
    message: str | None = None
    stream: bool = False
    detailLevel: str = "resumido"


class ChatResponse(BaseModel):
    reply: str


class MiaRequest(BaseModel):
    message: str
    timeframe: str | None = None
    page: str | None = None


class MiaResponse(BaseModel):
    replyMarkdown: str
    suggestedQuestions: list[str]
    context: dict | None = None


class DashboardAIRequest(BaseModel):
    type: str | None = None
    filters: dict | None = None
