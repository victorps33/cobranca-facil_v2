from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.schemas.upload import ApuracaoUploadRequest

router = APIRouter(prefix="/api/apuracao", tags=["apuracao-upload"])


def _format_brl(cents: int) -> str:
    return f"R$ {cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


@router.post("/upload")
async def apuracao_upload(body: ApuracaoUploadRequest):
    if not body.rows:
        return JSONResponse({"error": "Nenhum dado encontrado na planilha."}, status_code=400)

    # Build table for Claude
    header = "| Franqueado | PDV | iFood | Rappi | Total | Mês Anterior |"
    sep = "|------------|-----|-------|-------|-------|--------------|"
    rows = [
        f"| {r.nome} | {_format_brl(r.pdv)} | {_format_brl(r.ifood)} | {_format_brl(r.rappi)} | {_format_brl(r.total)} | {_format_brl(r.mesAnterior)} |"
        for r in body.rows
    ]
    table_content = "\n".join([header, sep, *rows])

    prompt = f"""Você é uma assistente de análise financeira para uma rede de franquias. Analise os dados de faturamento abaixo e forneça um sumário conciso em português do Brasil.

Dados da planilha importada:

{table_content}

Forneça um sumário com:
1. Quantidade total de franqueados na planilha
2. Faturamento total da rede (soma da coluna Total)
3. Franqueado com maior e menor faturamento
4. Se houver coluna "Mês Anterior" com valores, indique variações significativas (>20%) — positivas ou negativas
5. Alertas ou observações relevantes (ex: franqueados sem faturamento, valores zerados, etc.)

Formato: texto corrido, organizado em parágrafos curtos. Seja direto e objetivo. Use valores em R$ formatados."""

    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text_content = next((c for c in response.content if c.type == "text"), None)
        summary = text_content.text if text_content else "Não foi possível gerar o sumário."
        return {"summary": summary}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
