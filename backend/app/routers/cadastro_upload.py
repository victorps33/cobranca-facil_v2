import json
import re

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import settings

router = APIRouter(prefix="/api/cadastro", tags=["cadastro-upload"])


@router.post("/upload")
async def cadastro_upload(file: UploadFile = File(...)):
    if not file:
        return JSONResponse({"error": "Nenhum arquivo enviado."}, status_code=400)

    content = await file.read()
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""
    is_text = ext in ("csv", "txt", "tsv")

    if is_text:
        file_content = content.decode("utf-8", errors="replace")
    else:
        decoded = content.decode("utf-8", errors="replace")
        printable_count = sum(1 for c in decoded if 32 <= ord(c) < 127)
        if len(decoded) > 0 and printable_count / len(decoded) > 0.5:
            file_content = decoded[:50000]
        else:
            file_content = f"[Arquivo binário: {file.filename}, {len(content)} bytes. Não é possível ler diretamente o conteúdo.]"

    prompt = f"""Você é um assistente especializado em extrair dados estruturados de franqueados/lojas a partir de arquivos.

O usuário enviou um arquivo chamado "{file.filename}". Analise o conteúdo abaixo e extraia os dados de franqueados/lojas.

Conteúdo do arquivo:
---
{file_content[:40000]}
---

Extraia os dados e retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem blocos de código, sem texto adicional) no seguinte formato:

{{
  "franqueados": [
    {{
      "nome": "Nome da franquia/loja",
      "razaoSocial": "Razão social se disponível",
      "cnpj": "CNPJ se disponível",
      "email": "Email se disponível",
      "telefone": "Telefone se disponível",
      "cidade": "Cidade se disponível",
      "estado": "UF (2 letras) se disponível",
      "bairro": "Bairro se disponível",
      "dataAbertura": "YYYY-MM-DD se disponível",
      "responsavel": "Nome do responsável se disponível",
      "statusLoja": "Aberta ou Fechada ou Vendida"
    }}
  ],
  "warnings": ["Lista de avisos sobre dados que não puderam ser extraídos ou estão incompletos"],
  "summary": "Resumo breve do que foi encontrado no arquivo"
}}

Regras:
- Use "" (string vazia) para campos não encontrados no arquivo
- statusLoja deve ser "Aberta", "Fechada" ou "Vendida". Se não especificado, use "Aberta"
- Se o arquivo não contém dados de franqueados/lojas, retorne franqueados vazio e explique em warnings
- O campo "nome" é obrigatório. Pule registros sem nome
- Retorne APENAS o JSON, sem nenhum texto antes ou depois"""

    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        text_content = next((c for c in response.content if c.type == "text"), None)
        raw_response = text_content.text if text_content else ""

        json_match = re.search(r"\{[\s\S]*\}", raw_response)
        if not json_match:
            return JSONResponse(
                {"error": "Não foi possível interpretar o arquivo. Tente com um formato diferente."},
                status_code=422,
            )
        parsed = json.loads(json_match.group())

        return {
            "franqueados": parsed.get("franqueados", []),
            "warnings": parsed.get("warnings", []),
            "summary": parsed.get("summary", ""),
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
