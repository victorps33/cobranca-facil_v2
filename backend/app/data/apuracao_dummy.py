from datetime import datetime

fontes_dummy = [
    {"id": "pdv", "nome": "PDV", "unidades": 45, "conectado": True},
    {"id": "ifood", "nome": "iFood", "unidades": 42, "conectado": True},
    {"id": "rappi", "nome": "Rappi", "unidades": 0, "conectado": False},
    {"id": "outras", "nome": "Outras fontes", "unidades": 0, "conectado": False},
]

franqueados_apuracao_dummy = [
    {"id": "f1", "nome": "Franquia Morumbi", "pdv": 18500000, "ifood": 4200000, "rappiw": 0, "total": 22700000, "mesAnterior": 21500000, "status": "ok"},
    {"id": "f2", "nome": "Franquia Vila Mariana", "pdv": 14200000, "ifood": 3800000, "rappiw": 0, "total": 18000000, "mesAnterior": 17200000, "status": "ok"},
    {"id": "f3", "nome": "Franquia Santo Amaro", "pdv": 11800000, "ifood": 2900000, "rappiw": 0, "total": 14700000, "mesAnterior": 14000000, "status": "ok"},
    {"id": "f4", "nome": "Franquia Campo Belo", "pdv": 9500000, "ifood": 2100000, "rappiw": 0, "total": 11600000, "mesAnterior": 11200000, "status": "ok"},
    {"id": "f5", "nome": "Franquia Itaim Bibi", "pdv": 21000000, "ifood": 5500000, "rappiw": 0, "total": 26500000, "mesAnterior": 20000000, "status": "alerta"},
    {"id": "f6", "nome": "Franquia Moema", "pdv": 7800000, "ifood": 1900000, "rappiw": 0, "total": 9700000, "mesAnterior": 13000000, "status": "alerta"},
    {"id": "f7", "nome": "Franquia Brooklin", "pdv": 15600000, "ifood": 4100000, "rappiw": 0, "total": 19700000, "mesAnterior": 18800000, "status": "ok"},
    {"id": "f8", "nome": "Franquia Saude", "pdv": 6200000, "ifood": 1500000, "rappiw": 0, "total": 7700000, "mesAnterior": 7400000, "status": "ok"},
    {"id": "f9", "nome": "Franquia Recife", "pdv": 8900000, "ifood": 2200000, "rappiw": 0, "total": 11100000, "mesAnterior": 10800000, "status": "ok"},
    {"id": "f10", "nome": "Franquia Fortaleza", "pdv": 7600000, "ifood": 1800000, "rappiw": 0, "total": 9400000, "mesAnterior": 9100000, "status": "ok"},
    {"id": "f11", "nome": "Franquia Salvador", "pdv": 6800000, "ifood": 1600000, "rappiw": 0, "total": 8400000, "mesAnterior": 8100000, "status": "ok"},
    {"id": "f12", "nome": "Franquia Curitiba", "pdv": 9350000, "ifood": 2400000, "rappiw": 0, "total": 11750000, "mesAnterior": 11200000, "status": "ok"},
]

regras_default = {
    "royaltyPercent": 5,
    "marketingPercent": 2,
    "baseCalculo": "bruto",
    "exceções": [],
    "descontos": [],
}

nf_config_default = {
    "royalty": True,
    "marketing": False,
    "exceçõesRoyalty": [],
    "exceçõesMarketing": [],
}


def calcular_apuracao(franqueados: list[dict], regras: dict, nf_config: dict | None = None) -> list[dict]:
    if nf_config is None:
        nf_config = nf_config_default
    result = []
    for f in franqueados:
        faturamento = f["total"]
        royalty = round(faturamento * (regras["royaltyPercent"] / 100))
        marketing = round(faturamento * (regras["marketingPercent"] / 100))
        total_cobrar = royalty + marketing
        variacao = round(((faturamento - f["mesAnterior"]) / f["mesAnterior"]) * 100) if f["mesAnterior"] > 0 else 0
        flag_revisao = abs(variacao) > 20
        is_exc_royalty = f["id"] in nf_config.get("exceçõesRoyalty", [])
        is_exc_marketing = f["id"] in nf_config.get("exceçõesMarketing", [])
        result.append({
            "id": f["id"],
            "nome": f["nome"],
            "faturamento": faturamento,
            "royalty": royalty,
            "marketing": marketing,
            "totalCobrar": total_cobrar,
            "variacao": variacao,
            "flagRevisao": flag_revisao,
            "nfRoyalty": (not nf_config["royalty"]) if is_exc_royalty else nf_config["royalty"],
            "nfMarketing": (not nf_config["marketing"]) if is_exc_marketing else nf_config["marketing"],
        })
    return result


def get_competencia_atual() -> str:
    now = datetime.now()
    meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    return f"{meses[now.month - 1]}/{now.year}"


def get_dias_para_emissao() -> int:
    now = datetime.now()
    if now.month == 12:
        fim_mes = datetime(now.year + 1, 1, 1)
    else:
        fim_mes = datetime(now.year, now.month + 1, 1)
    return max(0, (fim_mes - now).days - 1)
