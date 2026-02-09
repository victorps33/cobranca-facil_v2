import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from app.services.ai_service import (
    ACTIONS_INSTRUCTION,
    JULIA_SYSTEM_PROMPT,
    SUGGESTIONS_INSTRUCTION,
    build_data_context,
    get_anthropic_client,
    get_mock_response,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def chat(request: Request):
    body = await request.json()
    conversation_messages = body.get("messages")
    message = body.get("message")
    is_streaming = body.get("stream", False)
    detail_level = body.get("detailLevel", "resumido")

    # Build Claude messages
    if conversation_messages:
        claude_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in conversation_messages
        ]
    elif message:
        claude_messages = [{"role": "user", "content": message}]
    else:
        claude_messages = []

    last_user_message = claude_messages[-1]["content"] if claude_messages else ""

    if not last_user_message:
        return JSONResponse({"error": "Message is required"}, status_code=400)

    anthropic = get_anthropic_client()
    data_context = build_data_context()
    include_suggestions = is_streaming

    detail_instruction = (
        "\n\n**NÍVEL DE DETALHE: DETALHADO** — Seja completo e aprofundado. Até 500 palavras. "
        "Inclua análise detalhada, contexto histórico, comparações e recomendações estratégicas com justificativa."
        if detail_level == "detalhado"
        else "\n\n**NÍVEL DE DETALHE: RESUMIDO** — Seja extremamente conciso e direto. "
        "Máximo 150 palavras. Apenas os pontos essenciais e números-chave."
    )

    system_prompt = (
        JULIA_SYSTEM_PROMPT
        + detail_instruction
        + "\n\n"
        + data_context
        + (SUGGESTIONS_INSTRUCTION + ACTIONS_INSTRUCTION if include_suggestions else "")
    )

    # Streaming mode
    if is_streaming:
        async def event_generator():
            if anthropic:
                try:
                    stream = anthropic.messages.create(
                        model="claude-haiku-4-5-20251001",
                        max_tokens=1024,
                        system=system_prompt,
                        messages=claude_messages,
                        stream=True,
                    )
                    for event in stream:
                        if (
                            event.type == "content_block_delta"
                            and event.delta.type == "text_delta"
                        ):
                            yield {"data": json.dumps({"text": event.delta.text})}
                    yield {"data": "[DONE]"}
                    return
                except Exception:
                    pass  # Fall through to mock

            # Mock streaming
            mock = get_mock_response(last_user_message)
            full_text = (
                mock["reply"]
                + "\n\n<<SUGESTÕES>>\n"
                + "\n".join(mock["suggestions"])
                + "\n<<AÇÕES>>\n"
                + "\n".join(mock["actions"])
            )
            words = full_text.split(" ")
            for i, word in enumerate(words):
                text = ("" if i == 0 else " ") + word
                yield {"data": json.dumps({"text": text})}
                await asyncio.sleep(0.02)
            yield {"data": "[DONE]"}

        return EventSourceResponse(event_generator())

    # Non-streaming mode
    if anthropic:
        try:
            response = anthropic.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=system_prompt,
                messages=claude_messages,
            )
            text_content = next((c for c in response.content if c.type == "text"), None)
            reply = text_content.text if text_content else ""
            if reply:
                return JSONResponse({"reply": reply})
        except Exception:
            pass

    # Mock fallback
    mock = get_mock_response(last_user_message)
    fallback_reply = mock["reply"] + "\n\n<<AÇÕES>>\n" + "\n".join(mock["actions"])
    return JSONResponse({"reply": fallback_reply})
