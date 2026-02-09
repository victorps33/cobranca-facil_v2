FRANQUEADORA = {
    "nome": "Menlo Franchising",
    "razaoSocial": "Menlo Franchising Ltda",
    "cnpj": "26.054.117/0001-41",
    "inscricaoMunicipal": "1.234.567-8",
    "endereco": "Av. Paulista, 1000, 10º andar — Bela Vista, São Paulo/SP — CEP 01310-100",
}


def fmt(cents: int) -> str:
    return f"R$ {cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_date(iso: str) -> str:
    from datetime import datetime
    dt = datetime.fromisoformat(iso + "T12:00:00")
    return dt.strftime("%d/%m/%Y")
