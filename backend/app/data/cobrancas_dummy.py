from datetime import datetime, timedelta

from app.data.apuracao_historico_dummy import ciclos_historico

cliente_ids: dict[str, str] = {
    "Franquia Morumbi": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "Franquia Vila Mariana": "c2b3c4d5-e6f7-8901-bcde-f23456789012",
    "Franquia Santo Amaro": "c3c4d5e6-f789-0123-cdef-345678901234",
    "Franquia Campo Belo": "c4d5e6f7-8901-2345-def0-456789012345",
    "Franquia Itaim Bibi": "c5e6f789-0123-4567-ef01-567890123456",
    "Franquia Moema": "c6f78901-2345-6789-f012-678901234567",
    "Franquia Brooklin": "c7890123-4567-8901-0123-789012345678",
    "Franquia Saude": "c8901234-5678-9012-1234-890123456789",
    "Franquia Recife": "c9012345-6789-0123-2345-901234567890",
    "Franquia Fortaleza": "ca123456-7890-1234-3456-012345678901",
    "Franquia Salvador": "cb234567-8901-2345-4567-123456789012",
    "Franquia Curitiba": "cc345678-9012-3456-5678-234567890123",
}

meses_extenso = {
    "Jan": "Janeiro", "Fev": "Fevereiro", "Mar": "Março", "Abr": "Abril",
    "Mai": "Maio", "Jun": "Junho", "Jul": "Julho", "Ago": "Agosto",
    "Set": "Setembro", "Out": "Outubro", "Nov": "Novembro", "Dez": "Dezembro",
}

formas_pagamento = ["Boleto", "Pix", "Cartão"]


def _add_days(iso: str, days: int) -> str:
    dt = datetime.fromisoformat(iso + "T12:00:00")
    dt += timedelta(days=days)
    return dt.strftime("%Y-%m-%d")


def _hash_index(s: str, mod: int) -> int:
    h = 0
    for c in s:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    # Convert to signed 32-bit
    if h >= 0x80000000:
        h -= 0x100000000
    return abs(h) % mod


def _get_payment_day(seed: str) -> int | None:
    h = _hash_index(seed, 100)
    if h >= 88:
        return None
    h2 = _hash_index(seed + "day", 1000)
    if h < 5:
        return 2 + (h2 % 5)
    elif h < 15:
        return 7 + (h2 % 6)
    elif h < 48:
        return 13 + (h2 % 6)
    elif h < 65:
        return 20 + (h2 % 16)
    elif h < 78:
        return 36 + (h2 % 20)
    else:
        return 60 + (h2 % 41)


def _gerar_cobrancas() -> list[dict]:
    cobrancas: list[dict] = []
    counter = 1
    ciclos_ordenados = list(reversed(ciclos_historico))
    hoje = datetime(2026, 2, 7)

    for ciclo in ciclos_ordenados:
        parts = ciclo["competencia"].split("/")
        mes_abrev, ano = parts[0], parts[1]
        mes_extenso = meses_extenso.get(mes_abrev, mes_abrev)
        data_emissao = ciclo["dataApuracao"]
        data_vencimento = _add_days(data_emissao, 15)
        venc = datetime.fromisoformat(data_vencimento + "T12:00:00")
        vencido = venc < hoje

        for d in ciclo["detalhes"]:
            cid = cliente_ids.get(d["franqueado"], f"cgen-{_hash_index(d['franqueado'], 99999)}")
            seed = f"{ciclo['id']}-{d['franqueado']}"

            forma_r = formas_pagamento[_hash_index(seed + "R", 3)]
            forma_m = formas_pagamento[_hash_index(seed + "M", 3)]

            pay_day_r = _get_payment_day(seed + "R")
            pay_day_m = _get_payment_day(seed + "M")

            def resolve_status(pay_day):
                if pay_day is None:
                    return {"status": "Vencida" if vencido else "Aberta", "dataPagamento": None, "pago": False}
                pay_date = _add_days(data_emissao, pay_day)
                pay_date_obj = datetime.fromisoformat(pay_date + "T12:00:00")
                if pay_date_obj <= hoje:
                    return {"status": "Paga", "dataPagamento": pay_date, "pago": True}
                return {"status": "Vencida" if vencido else "Aberta", "dataPagamento": None, "pago": False}

            res_r = resolve_status(pay_day_r)
            res_m = resolve_status(pay_day_m)

            cobrancas.append({
                "id": f"COB-{ano}-{str(counter).zfill(3)}",
                "cliente": d["franqueado"],
                "clienteId": cid,
                "categoria": "Royalties",
                "descricao": f"Cobrança de Royalties - {mes_extenso} {ano}",
                "dataEmissao": data_emissao,
                "dataVencimento": data_vencimento,
                "dataPagamento": res_r.get("dataPagamento"),
                "valorOriginal": d["royalties"],
                "valorPago": d["royalties"] if res_r["pago"] else 0,
                "valorAberto": 0 if res_r["pago"] else d["royalties"],
                "formaPagamento": forma_r,
                "status": res_r["status"],
                "nfEmitida": d["nfEmitida"],
                "competencia": f"{mes_abrev}/{ano}",
            })
            counter += 1

            cobrancas.append({
                "id": f"COB-{ano}-{str(counter).zfill(3)}",
                "cliente": d["franqueado"],
                "clienteId": cid,
                "categoria": "FNP",
                "descricao": f"Fundo Nacional de Propaganda - {mes_extenso} {ano}",
                "dataEmissao": data_emissao,
                "dataVencimento": data_vencimento,
                "dataPagamento": res_m.get("dataPagamento"),
                "valorOriginal": d["marketing"],
                "valorPago": d["marketing"] if res_m["pago"] else 0,
                "valorAberto": 0 if res_m["pago"] else d["marketing"],
                "formaPagamento": forma_m,
                "status": res_m["status"],
                "nfEmitida": d["nfEmitida"],
                "competencia": f"{mes_abrev}/{ano}",
            })
            counter += 1

    # Extra charge
    cobrancas.append({
        "id": f"COB-2026-{str(counter).zfill(3)}",
        "cliente": "Franquia Morumbi",
        "clienteId": cliente_ids["Franquia Morumbi"],
        "categoria": "Taxa de Franquia",
        "descricao": "Taxa de Franquia - Parcela 3/12",
        "dataEmissao": "2026-02-01",
        "dataVencimento": "2026-02-10",
        "dataPagamento": None,
        "valorOriginal": 500000,
        "valorPago": 0,
        "valorAberto": 500000,
        "formaPagamento": "Boleto",
        "status": "Vencida",
        "nfEmitida": False,
        "competencia": "Fev/2026",
    })

    cobrancas.sort(key=lambda c: c["dataEmissao"], reverse=True)
    return cobrancas


cobrancas_dummy: list[dict] = _gerar_cobrancas()


def get_cobrancas_stats(cobrancas: list[dict]) -> dict:
    total = len(cobrancas)
    total_emitido = sum(c["valorOriginal"] for c in cobrancas)
    total_pago = sum(c["valorPago"] for c in cobrancas)
    total_aberto = sum(c["valorAberto"] for c in cobrancas)

    by_status = {
        "aberta": sum(1 for c in cobrancas if c["status"] == "Aberta"),
        "vencida": sum(1 for c in cobrancas if c["status"] == "Vencida"),
        "paga": sum(1 for c in cobrancas if c["status"] == "Paga"),
        "cancelada": sum(1 for c in cobrancas if c["status"] == "Cancelada"),
    }

    by_categoria = {
        "royalties": sum(c["valorOriginal"] for c in cobrancas if c["categoria"] == "Royalties"),
        "fnp": sum(c["valorOriginal"] for c in cobrancas if c["categoria"] == "FNP"),
        "taxaFranquia": sum(c["valorOriginal"] for c in cobrancas if c["categoria"] == "Taxa de Franquia"),
    }

    by_forma_pagamento = {
        "boleto": sum(1 for c in cobrancas if c["formaPagamento"] == "Boleto"),
        "pix": sum(1 for c in cobrancas if c["formaPagamento"] == "Pix"),
        "cartao": sum(1 for c in cobrancas if c["formaPagamento"] == "Cartão"),
    }

    taxa_recebimento = (total_pago / total_emitido * 100) if total_emitido else 0
    valor_vencido = sum(c["valorAberto"] for c in cobrancas if c["status"] == "Vencida")

    return {
        "total": total,
        "totalEmitido": total_emitido,
        "totalPago": total_pago,
        "totalAberto": total_aberto,
        "byStatus": by_status,
        "byCategoria": by_categoria,
        "byFormaPagamento": by_forma_pagamento,
        "taxaRecebimento": taxa_recebimento,
        "valorVencido": valor_vencido,
    }
