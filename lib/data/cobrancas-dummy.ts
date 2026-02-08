import { ciclosHistorico } from "./apuracao-historico-dummy";

export interface Cobranca {
  id: string;
  cliente: string;
  clienteId: string;
  categoria: "Royalties" | "FNP" | "Taxa de Franquia" | "Produto" | "Serviço";
  descricao: string;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string;
  valorOriginal: number;
  valorPago: number;
  valorAberto: number;
  formaPagamento: "Boleto" | "Pix" | "Cartão";
  status: "Aberta" | "Vencida" | "Paga" | "Cancelada";
  nfEmitida: boolean;
  competencia: string;
}

// ---------------------------------------------------------------------------
// IDs estáveis por franqueado
// ---------------------------------------------------------------------------

const clienteIds: Record<string, string> = {
  "Franquia Morumbi":     "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "Franquia Vila Mariana": "c2b3c4d5-e6f7-8901-bcde-f23456789012",
  "Franquia Santo Amaro":  "c3c4d5e6-f789-0123-cdef-345678901234",
  "Franquia Campo Belo":   "c4d5e6f7-8901-2345-def0-456789012345",
  "Franquia Itaim Bibi":   "c5e6f789-0123-4567-ef01-567890123456",
  "Franquia Moema":        "c6f78901-2345-6789-f012-678901234567",
  "Franquia Brooklin":     "c7890123-4567-8901-0123-789012345678",
  "Franquia Saude":        "c8901234-5678-9012-1234-890123456789",
  "Franquia Recife":       "c9012345-6789-0123-2345-901234567890",
  "Franquia Fortaleza":    "ca123456-7890-1234-3456-012345678901",
  "Franquia Salvador":     "cb234567-8901-2345-4567-123456789012",
  "Franquia Curitiba":     "cc345678-9012-3456-5678-234567890123",
};

const mesesExtenso: Record<string, string> = {
  Jan: "Janeiro", Fev: "Fevereiro", Mar: "Março", Abr: "Abril",
  Mai: "Maio",   Jun: "Junho",     Jul: "Julho",  Ago: "Agosto",
  Set: "Setembro", Out: "Outubro", Nov: "Novembro", Dez: "Dezembro",
};

const formasPagamento: Cobranca["formaPagamento"][] = ["Boleto", "Pix", "Cartão"];

// ---------------------------------------------------------------------------
// Gera cobranças derivadas dos ciclos de apuração
// ---------------------------------------------------------------------------

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// Seed determinístico simples baseado em string
function hashIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % mod;
}

// ---------------------------------------------------------------------------
// Perfil de pagamento realista — curva S de maturação
// ---------------------------------------------------------------------------
// Retorna o dia (relativo à emissão) em que a cobrança será paga, ou null se
// nunca for paga. Distribui pagamentos ao longo de ~D+3 até D+100, gerando
// uma curva de recebimento por safra com formato S natural.
// ---------------------------------------------------------------------------

function getPaymentDay(seed: string): number | null {
  const h = hashIndex(seed, 100);

  // ~12% nunca pagam
  if (h >= 88) return null;

  // Sub-hash para variar o dia dentro de cada faixa
  const h2 = hashIndex(seed + "day", 1000);

  if (h < 5) {
    // 5%: antecipados via Pix (D+2 a D+6)
    return 2 + (h2 % 5);
  } else if (h < 15) {
    // 10%: adiantados (D+7 a D+12)
    return 7 + (h2 % 6);
  } else if (h < 48) {
    // 33%: em torno do vencimento (D+13 a D+18)
    return 13 + (h2 % 6);
  } else if (h < 65) {
    // 17%: atrasados leves (D+20 a D+35)
    return 20 + (h2 % 16);
  } else if (h < 78) {
    // 13%: atrasados moderados (D+36 a D+55)
    return 36 + (h2 % 20);
  } else {
    // 10%: recuperação tardia (D+60 a D+100)
    return 60 + (h2 % 41);
  }
}

function gerarCobrancasDosCliclos(): Cobranca[] {
  const cobrancas: Cobranca[] = [];
  let counter = 1;

  // Ordenar ciclos do mais antigo ao mais recente
  const ciclosOrdenados = [...ciclosHistorico].reverse();
  const hoje = new Date("2026-02-07");

  for (const ciclo of ciclosOrdenados) {
    const [mesAbrev, ano] = ciclo.competencia.split("/");
    const mesExtenso = mesesExtenso[mesAbrev] ?? mesAbrev;
    const dataEmissao = ciclo.dataApuracao;
    const dataVencimento = addDays(dataEmissao, 15);
    const venc = new Date(dataVencimento + "T12:00:00");
    const vencido = venc < hoje;

    for (let i = 0; i < ciclo.detalhes.length; i++) {
      const d = ciclo.detalhes[i];
      const cid = clienteIds[d.franqueado] ?? `cgen-${hashIndex(d.franqueado, 99999)}`;
      const seed = `${ciclo.id}-${d.franqueado}`;

      const formaR = formasPagamento[hashIndex(seed + "R", 3)];
      const formaM = formasPagamento[hashIndex(seed + "M", 3)];

      // Perfil de pagamento para cada cobrança
      const payDayR = getPaymentDay(seed + "R");
      const payDayM = getPaymentDay(seed + "M");

      // Determinar status e data de pagamento relativo a "hoje"
      const resolveStatus = (
        payDay: number | null,
      ): { status: Cobranca["status"]; dataPagamento?: string; pago: boolean } => {
        if (payDay === null) {
          // Nunca vai pagar
          return { status: vencido ? "Vencida" : "Aberta", pago: false };
        }
        const payDate = addDays(dataEmissao, payDay);
        const payDateObj = new Date(payDate + "T12:00:00");
        if (payDateObj <= hoje) {
          return { status: "Paga", dataPagamento: payDate, pago: true };
        }
        // Vai pagar no futuro mas ainda não pagou
        return { status: vencido ? "Vencida" : "Aberta", pago: false };
      };

      const resR = resolveStatus(payDayR);
      const resM = resolveStatus(payDayM);

      // Cobrança de Royalties
      cobrancas.push({
        id: `COB-${ano}-${String(counter++).padStart(3, "0")}`,
        cliente: d.franqueado,
        clienteId: cid,
        categoria: "Royalties",
        descricao: `Cobrança de Royalties - ${mesExtenso} ${ano}`,
        dataEmissao,
        dataVencimento,
        dataPagamento: resR.dataPagamento,
        valorOriginal: d.royalties,
        valorPago: resR.pago ? d.royalties : 0,
        valorAberto: resR.pago ? 0 : d.royalties,
        formaPagamento: formaR,
        status: resR.status,
        nfEmitida: d.nfEmitida,
        competencia: `${mesAbrev}/${ano}`,
      });

      // Cobrança de FNP (Marketing)
      cobrancas.push({
        id: `COB-${ano}-${String(counter++).padStart(3, "0")}`,
        cliente: d.franqueado,
        clienteId: cid,
        categoria: "FNP",
        descricao: `Fundo Nacional de Propaganda - ${mesExtenso} ${ano}`,
        dataEmissao,
        dataVencimento,
        dataPagamento: resM.dataPagamento,
        valorOriginal: d.marketing,
        valorPago: resM.pago ? d.marketing : 0,
        valorAberto: resM.pago ? 0 : d.marketing,
        formaPagamento: formaM,
        status: resM.status,
        nfEmitida: d.nfEmitida,
        competencia: `${mesAbrev}/${ano}`,
      });
    }
  }

  // Cobrança avulsa (Taxa de Franquia) para manter variedade de categorias
  cobrancas.push({
    id: `COB-2026-${String(counter++).padStart(3, "0")}`,
    cliente: "Franquia Morumbi",
    clienteId: clienteIds["Franquia Morumbi"],
    categoria: "Taxa de Franquia",
    descricao: "Taxa de Franquia - Parcela 3/12",
    dataEmissao: "2026-02-01",
    dataVencimento: "2026-02-10",
    valorOriginal: 500000,
    valorPago: 0,
    valorAberto: 500000,
    formaPagamento: "Boleto",
    status: "Vencida",
    nfEmitida: false,
    competencia: "Fev/2026",
  });

  // Ordenar: mais recente primeiro
  cobrancas.sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));

  return cobrancas;
}

export const cobrancasDummy: Cobranca[] = gerarCobrancasDosCliclos();

// ---------------------------------------------------------------------------
// Estatísticas agregadas
// ---------------------------------------------------------------------------

export function getCobrancasStats(cobrancas: Cobranca[]) {
  const total = cobrancas.length;
  const totalEmitido = cobrancas.reduce((acc, c) => acc + c.valorOriginal, 0);
  const totalPago = cobrancas.reduce((acc, c) => acc + c.valorPago, 0);
  const totalAberto = cobrancas.reduce((acc, c) => acc + c.valorAberto, 0);

  const byStatus = {
    aberta: cobrancas.filter((c) => c.status === "Aberta").length,
    vencida: cobrancas.filter((c) => c.status === "Vencida").length,
    paga: cobrancas.filter((c) => c.status === "Paga").length,
    cancelada: cobrancas.filter((c) => c.status === "Cancelada").length,
  };

  const byCategoria = {
    royalties: cobrancas.filter((c) => c.categoria === "Royalties").reduce((acc, c) => acc + c.valorOriginal, 0),
    fnp: cobrancas.filter((c) => c.categoria === "FNP").reduce((acc, c) => acc + c.valorOriginal, 0),
    taxaFranquia: cobrancas.filter((c) => c.categoria === "Taxa de Franquia").reduce((acc, c) => acc + c.valorOriginal, 0),
  };

  const byFormaPagamento = {
    boleto: cobrancas.filter((c) => c.formaPagamento === "Boleto").length,
    pix: cobrancas.filter((c) => c.formaPagamento === "Pix").length,
    cartao: cobrancas.filter((c) => c.formaPagamento === "Cartão").length,
  };

  const taxaRecebimento = totalEmitido > 0 ? (totalPago / totalEmitido) * 100 : 0;
  const valorVencido = cobrancas
    .filter((c) => c.status === "Vencida")
    .reduce((acc, c) => acc + c.valorAberto, 0);

  return {
    total,
    totalEmitido,
    totalPago,
    totalAberto,
    byStatus,
    byCategoria,
    byFormaPagamento,
    taxaRecebimento,
    valorVencido,
  };
}
