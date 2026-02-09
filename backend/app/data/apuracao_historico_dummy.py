loja_base = [
    {"nome": "Franquia Morumbi", "pdv": 18500000, "ifood": 4200000, "rappi": 0},
    {"nome": "Franquia Vila Mariana", "pdv": 14200000, "ifood": 3800000, "rappi": 0},
    {"nome": "Franquia Santo Amaro", "pdv": 11800000, "ifood": 2900000, "rappi": 0},
    {"nome": "Franquia Campo Belo", "pdv": 9500000, "ifood": 2100000, "rappi": 0},
    {"nome": "Franquia Itaim Bibi", "pdv": 21000000, "ifood": 5500000, "rappi": 0},
    {"nome": "Franquia Moema", "pdv": 7800000, "ifood": 1900000, "rappi": 0},
    {"nome": "Franquia Brooklin", "pdv": 15600000, "ifood": 4100000, "rappi": 0},
    {"nome": "Franquia Saude", "pdv": 6200000, "ifood": 1500000, "rappi": 0},
    {"nome": "Franquia Recife", "pdv": 8900000, "ifood": 2200000, "rappi": 0},
    {"nome": "Franquia Fortaleza", "pdv": 7600000, "ifood": 1800000, "rappi": 0},
    {"nome": "Franquia Salvador", "pdv": 6800000, "ifood": 1600000, "rappi": 0},
    {"nome": "Franquia Curitiba", "pdv": 9350000, "ifood": 2400000, "rappi": 0},
]


def _gerar_detalhes(multiplicador: float, qtd_lojas: int, royalty_pct: float = 0.05, mkt_pct: float = 0.02) -> list[dict]:
    result = []
    for loja in loja_base[:qtd_lojas]:
        pdv = round(loja["pdv"] * multiplicador)
        ifood = round(loja["ifood"] * multiplicador)
        rappi = round(loja["rappi"] * multiplicador)
        faturamento = pdv + ifood + rappi
        royalties = round(faturamento * royalty_pct)
        marketing = round(faturamento * mkt_pct)
        result.append({
            "franqueado": loja["nome"],
            "pdv": pdv,
            "ifood": ifood,
            "rappi": rappi,
            "faturamento": faturamento,
            "royalties": royalties,
            "marketing": marketing,
            "totalCobrado": royalties + marketing,
            "nfEmitida": True,
        })
    return result


detalhes_jan26 = _gerar_detalhes(0.95, 12)
detalhes_dez25 = _gerar_detalhes(1.08, 12)
detalhes_nov25 = _gerar_detalhes(0.93, 11)
detalhes_out25 = _gerar_detalhes(0.88, 11)
detalhes_set25 = _gerar_detalhes(0.85, 10)


def _build_ciclo(id_: str, competencia: str, short: str, data_apuracao: str, franqueados: int, detalhes: list[dict], nfs: int) -> dict:
    return {
        "id": id_,
        "competencia": competencia,
        "competenciaShort": short,
        "dataApuracao": data_apuracao,
        "franqueados": franqueados,
        "faturamentoTotal": sum(d["faturamento"] for d in detalhes),
        "royaltyTotal": sum(d["royalties"] for d in detalhes),
        "marketingTotal": sum(d["marketing"] for d in detalhes),
        "totalCobrado": sum(d["totalCobrado"] for d in detalhes),
        "nfsEmitidas": nfs,
        "status": "concluido",
        "detalhes": detalhes,
    }


ciclos_historico: list[dict] = [
    _build_ciclo("ciclo-jan26", "Jan/2026", "Jan/26", "2026-02-03", 12, detalhes_jan26, 12),
    _build_ciclo("ciclo-dez25", "Dez/2025", "Dez/25", "2026-01-04", 12, detalhes_dez25, 12),
    _build_ciclo("ciclo-nov25", "Nov/2025", "Nov/25", "2025-12-03", 11, detalhes_nov25, 11),
    _build_ciclo("ciclo-out25", "Out/2025", "Out/25", "2025-11-04", 11, detalhes_out25, 11),
    _build_ciclo("ciclo-set25", "Set/2025", "Set/25", "2025-10-03", 10, detalhes_set25, 10),
]
