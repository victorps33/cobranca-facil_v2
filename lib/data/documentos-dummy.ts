import { cobrancasDummy, type Cobranca } from "./cobrancas-dummy";
import { franqueadosDummy } from "./clientes-dummy";
import { FRANQUEADORA } from "../constants";

// ── Helpers ────────────────────────────────────────────────

function hashIndex(str: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % mod;
}

function padNum(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

// ── Nota Fiscal (NFS-e) ───────────────────────────────────

export interface NotaFiscal {
  id: string;
  numero: string;
  serie: string;
  cobrancaId: string;
  dataEmissao: string;
  competencia: string;
  naturezaOperacao: string;
  regimeEspecialTributacao: string;
  codigoServico: string;
  cnaeAtividade: string;
  // Prestador
  prestador: {
    razaoSocial: string;
    cnpj: string;
    inscricaoMunicipal: string;
    endereco: string;
  };
  // Tomador
  tomador: {
    razaoSocial: string;
    cnpj: string;
    endereco: string;
  };
  // Serviço
  discriminacao: string;
  valorServicos: number;     // centavos
  valorDeducoes: number;
  baseCalculo: number;
  // Tributos
  aliquotaIss: number;       // ex: 5 → 5%
  valorIss: number;
  valorPis: number;
  valorCofins: number;
  valorInss: number;
  valorIr: number;
  valorCsll: number;
  valorLiquido: number;
  // Meta
  codigoVerificacao: string;
  status: "Normal" | "Cancelada";
}

// ── Boleto Bancário ───────────────────────────────────────

export interface BoletoBancario {
  id: string;
  cobrancaId: string;
  // Banco
  bancoNumero: string;
  bancoNome: string;
  agencia: string;
  conta: string;
  // Documento
  nossoNumero: string;
  numeroDocumento: string;
  especieDocumento: string;
  especieMoeda: string;
  dataDocumento: string;
  dataProcessamento: string;
  dataVencimento: string;
  // Valores
  valorDocumento: number;    // centavos
  valorDesconto: number;
  valorDeducoes: number;
  valorMulta: number;
  valorJuros: number;
  valorCobrado: number;
  // Participantes
  cedente: {
    razaoSocial: string;
    cnpj: string;
    endereco: string;
  };
  sacado: {
    razaoSocial: string;
    cnpj: string;
    endereco: string;
  };
  // Códigos
  linhaDigitavel: string;
  codigoBarra: string;
  // Instruções
  instrucoes: string[];
  // Meta
  aceite: string;
  carteira: string;
  status: "Pendente" | "Pago" | "Vencido" | "Cancelado";
}

// ── Invoice Pix (Cobrança Pix) ────────────────────────────

export interface InvoicePix {
  id: string;
  cobrancaId: string;
  txId: string;
  endToEndId: string | null;  // preenchido quando pago
  // Chave e QR
  chavePix: string;
  tipoChave: "CNPJ" | "EMAIL" | "TELEFONE" | "EVP";
  qrCodePayload: string;
  locationUrl: string;
  // Valores
  valorOriginal: number;     // centavos
  valorPago: number | null;
  // Datas
  dataCriacao: string;
  dataExpiracao: string;
  dataPagamento: string | null;
  // Participantes
  beneficiario: {
    razaoSocial: string;
    cnpj: string;
    nomeFantasia: string;
    cidade: string;
  };
  pagador: {
    razaoSocial: string;
    cnpj: string;
    nome: string;
  };
  // Info
  descricao: string;
  infoAdicionais: { nome: string; valor: string }[];
  status: "ATIVA" | "CONCLUIDA" | "REMOVIDA_PELO_USUARIO_RECEBEDOR" | "EXPIRADA";
}

// ── Comprovante Pix ───────────────────────────────────────

export interface ComprovantePix {
  id: string;
  cobrancaId: string;
  endToEndId: string;
  txId: string;
  // Pagamento
  valorPago: number;          // centavos
  dataPagamento: string;
  horaPagamento: string;
  // Participantes
  pagador: {
    nome: string;
    cnpj: string;
    banco: string;
    agencia: string;
    conta: string;
  };
  recebedor: {
    nome: string;
    cnpj: string;
    banco: string;
    agencia: string;
    conta: string;
    chavePix: string;
  };
  // Meta
  descricao: string;
  autenticacao: string;
}

// ═══════════════════════════════════════════════════════════
// Geração de dados dummy
// ═══════════════════════════════════════════════════════════

const bancos = [
  { numero: "237", nome: "Bradesco" },
  { numero: "001", nome: "Banco do Brasil" },
  { numero: "341", nome: "Itaú Unibanco" },
  { numero: "033", nome: "Santander" },
  { numero: "104", nome: "Caixa Econômica" },
];

const bancosCompletos = [
  { nome: "Bradesco S.A.", agencia: "0237", conta: "12345-6" },
  { nome: "Itaú Unibanco S.A.", agencia: "1234", conta: "56789-0" },
  { nome: "Banco do Brasil S.A.", agencia: "3456", conta: "78901-2" },
  { nome: "Santander S.A.", agencia: "4567", conta: "89012-3" },
  { nome: "Nubank S.A.", agencia: "0001", conta: "34567-8" },
  { nome: "Sicoob", agencia: "7890", conta: "45678-9" },
];

function gerarNotasFiscais(): NotaFiscal[] {
  const nfs: NotaFiscal[] = [];
  let nfSeq = 2024000001;

  for (const cob of cobrancasDummy) {
    // Só gera NF para cobranças com nfEmitida = true
    if (!cob.nfEmitida) continue;

    const franqueado = franqueadosDummy.find((f) => f.id === cob.clienteId);
    if (!franqueado) continue;

    const valorServicos = cob.valorOriginal;
    const iss = Math.round(valorServicos * 0.05);
    const pis = Math.round(valorServicos * 0.0065);
    const cofins = Math.round(valorServicos * 0.03);
    const ir = Math.round(valorServicos * 0.015);
    const csll = Math.round(valorServicos * 0.01);

    const hashBase = cob.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const verificacao = hashBase.padEnd(32, "0").slice(0, 8) + "-" +
      hashBase.slice(8, 12).padEnd(4, "A") + "-" +
      hashBase.slice(12, 16).padEnd(4, "B") + "-" +
      hashBase.slice(16, 24).padEnd(8, "C");

    nfs.push({
      id: `NF-${nfSeq}`,
      numero: String(nfSeq),
      serie: "RPS",
      cobrancaId: cob.id,
      dataEmissao: cob.dataEmissao,
      competencia: cob.competencia,
      naturezaOperacao: "Tributação no Município",
      regimeEspecialTributacao: "Microempresa Municipal",
      codigoServico: "17.08",
      cnaeAtividade: "7020-4/00",
      prestador: {
        razaoSocial: FRANQUEADORA.razaoSocial,
        cnpj: FRANQUEADORA.cnpj,
        inscricaoMunicipal: FRANQUEADORA.inscricaoMunicipal,
        endereco: FRANQUEADORA.endereco,
      },
      tomador: {
        razaoSocial: franqueado.razaoSocial,
        cnpj: franqueado.cnpj,
        endereco: `${franqueado.bairro}, ${franqueado.cidade}/${franqueado.estado}`,
      },
      discriminacao: cob.categoria === "Royalties"
        ? `Prestação de serviços de gestão e suporte operacional de rede de franquias — ${cob.descricao}. Competência: ${cob.competencia}.`
        : cob.categoria === "FNP"
          ? `Contribuição ao Fundo Nacional de Propaganda para ações de marketing e publicidade da rede — ${cob.descricao}. Competência: ${cob.competencia}.`
          : `${cob.descricao}. Competência: ${cob.competencia}.`,
      valorServicos,
      valorDeducoes: 0,
      baseCalculo: valorServicos,
      aliquotaIss: 5,
      valorIss: iss,
      valorPis: pis,
      valorCofins: cofins,
      valorInss: 0,
      valorIr: ir,
      valorCsll: csll,
      valorLiquido: valorServicos - iss,
      codigoVerificacao: verificacao,
      status: "Normal",
    });

    nfSeq++;
  }

  return nfs;
}

function gerarBoletos(): BoletoBancario[] {
  const boletos: BoletoBancario[] = [];

  for (const cob of cobrancasDummy) {
    if (cob.formaPagamento !== "Boleto") continue;

    const franqueado = franqueadosDummy.find((f) => f.id === cob.clienteId);
    if (!franqueado) continue;

    const banco = bancos[hashIndex(cob.id, bancos.length)];
    const agencia = padNum(hashIndex(cob.id + "ag", 9999) + 1, 4);
    const conta = padNum(hashIndex(cob.id + "ct", 99999) + 10000, 5) + "-" + (hashIndex(cob.id + "dg", 9) + 1);
    const nossoNumero = `${banco.numero}/${cob.id.replace(/[^0-9]/g, "").slice(0, 11).padStart(11, "0")}`;
    const numDoc = cob.id.slice(0, 8).toUpperCase();

    const vencNum = cob.dataVencimento.replace(/-/g, "");
    const valorNum = String(cob.valorOriginal).padStart(10, "0");

    // Linha digitável realista (47 dígitos formatados)
    const campo1 = `${banco.numero}9${hashIndex(cob.id + "c1", 9)}.${padNum(hashIndex(cob.id + "c1b", 99999), 5)}`;
    const campo2 = `${padNum(hashIndex(cob.id + "c2", 9999999999), 10)}.${padNum(hashIndex(cob.id + "c2b", 99999), 5)}`;
    const campo3 = `${padNum(hashIndex(cob.id + "c3", 9999999999), 10)}.${padNum(hashIndex(cob.id + "c3b", 99999), 5)}`;
    const dac = hashIndex(cob.id + "dac", 9) + 1;
    const linhaDigitavel = `${campo1} ${campo2} ${campo3} ${dac} ${vencNum}${valorNum}`;

    // Código de barras (44 dígitos)
    const codigoBarra = `${banco.numero}9${dac}${vencNum}${valorNum}${padNum(hashIndex(cob.id + "bar", 9999999999), 10)}${padNum(hashIndex(cob.id + "bar2", 9999999999), 10)}`;

    const isVencido = cob.status === "Vencida";
    const isPago = cob.status === "Paga";

    boletos.push({
      id: `BOL-${cob.id}`,
      cobrancaId: cob.id,
      bancoNumero: banco.numero,
      bancoNome: banco.nome,
      agencia,
      conta,
      nossoNumero,
      numeroDocumento: numDoc,
      especieDocumento: "DM",
      especieMoeda: "R$",
      dataDocumento: cob.dataEmissao,
      dataProcessamento: cob.dataEmissao,
      dataVencimento: cob.dataVencimento,
      valorDocumento: cob.valorOriginal,
      valorDesconto: 0,
      valorDeducoes: 0,
      valorMulta: isVencido ? Math.round(cob.valorOriginal * 0.02) : 0,
      valorJuros: isVencido ? Math.round(cob.valorOriginal * 0.01) : 0,
      valorCobrado: isPago ? cob.valorPago : 0,
      cedente: {
        razaoSocial: FRANQUEADORA.razaoSocial,
        cnpj: FRANQUEADORA.cnpj,
        endereco: FRANQUEADORA.endereco,
      },
      sacado: {
        razaoSocial: franqueado.razaoSocial,
        cnpj: franqueado.cnpj,
        endereco: `${franqueado.bairro}, ${franqueado.cidade}/${franqueado.estado}`,
      },
      linhaDigitavel,
      codigoBarra,
      instrucoes: [
        "Após o vencimento, cobrar multa de 2% sobre o valor do documento.",
        "Juros de mora de 1% ao mês (pro rata die).",
        "Não receber após 30 dias do vencimento.",
        `Beneficiário: ${FRANQUEADORA.razaoSocial} — CNPJ ${FRANQUEADORA.cnpj}`,
      ],
      aceite: "N",
      carteira: "09",
      status: isPago ? "Pago" : isVencido ? "Vencido" : cob.status === "Cancelada" ? "Cancelado" : "Pendente",
    });
  }

  return boletos;
}

function gerarInvoicesPix(): InvoicePix[] {
  const invoices: InvoicePix[] = [];

  for (const cob of cobrancasDummy) {
    if (cob.formaPagamento !== "Pix") continue;

    const franqueado = franqueadosDummy.find((f) => f.id === cob.clienteId);
    if (!franqueado) continue;

    const txId = cob.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25).toUpperCase();
    const isPago = cob.status === "Paga";
    const isVencido = cob.status === "Vencida";

    const e2eId = isPago
      ? `E${FRANQUEADORA.cnpj.replace(/\D/g, "")}${cob.dataPagamento?.replace(/-/g, "") ?? "20260207"}${padNum(hashIndex(cob.id + "e2e", 9999999999), 10)}`
      : null;

    const qrPayload = `00020126580014br.gov.bcb.pix0136${FRANQUEADORA.cnpj.replace(/\D/g, "")}5204000053039865405${(cob.valorOriginal / 100).toFixed(2)}5802BR5925${FRANQUEADORA.razaoSocial.slice(0, 25)}6009SAO PAULO62070503***6304`;

    // Expiração: 7 dias após criação
    const dataCriacao = cob.dataEmissao;
    const expiracaoDate = new Date(dataCriacao + "T12:00:00");
    expiracaoDate.setDate(expiracaoDate.getDate() + 7);
    const dataExpiracao = expiracaoDate.toISOString().split("T")[0];

    invoices.push({
      id: `PIX-${cob.id}`,
      cobrancaId: cob.id,
      txId,
      endToEndId: e2eId,
      chavePix: FRANQUEADORA.cnpj,
      tipoChave: "CNPJ",
      qrCodePayload: qrPayload,
      locationUrl: `https://pix.menlo.com.br/cobv/${txId}`,
      valorOriginal: cob.valorOriginal,
      valorPago: isPago ? cob.valorPago : null,
      dataCriacao,
      dataExpiracao,
      dataPagamento: cob.dataPagamento ?? null,
      beneficiario: {
        razaoSocial: FRANQUEADORA.razaoSocial,
        cnpj: FRANQUEADORA.cnpj,
        nomeFantasia: FRANQUEADORA.nome,
        cidade: "São Paulo",
      },
      pagador: {
        razaoSocial: franqueado.razaoSocial,
        cnpj: franqueado.cnpj,
        nome: franqueado.nome,
      },
      descricao: cob.descricao,
      infoAdicionais: [
        { nome: "Competência", valor: cob.competencia },
        { nome: "Categoria", valor: cob.categoria },
        { nome: "ID Cobrança", valor: cob.id },
      ],
      status: isPago ? "CONCLUIDA" : isVencido ? "EXPIRADA" : cob.status === "Cancelada" ? "REMOVIDA_PELO_USUARIO_RECEBEDOR" : "ATIVA",
    });
  }

  return invoices;
}

function gerarComprovantesPix(): ComprovantePix[] {
  const comprovantes: ComprovantePix[] = [];

  for (const cob of cobrancasDummy) {
    if (cob.formaPagamento !== "Pix" || cob.status !== "Paga" || !cob.dataPagamento) continue;

    const franqueado = franqueadosDummy.find((f) => f.id === cob.clienteId);
    if (!franqueado) continue;

    const txId = cob.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25).toUpperCase();
    const e2eId = `E${FRANQUEADORA.cnpj.replace(/\D/g, "")}${cob.dataPagamento.replace(/-/g, "")}${padNum(hashIndex(cob.id + "e2e", 9999999999), 10)}`;

    const bancoPagador = bancosCompletos[hashIndex(cob.id + "bpag", bancosCompletos.length)];
    const bancoRecebedor = bancosCompletos[hashIndex(cob.id + "brec", bancosCompletos.length)];

    // Horário aleatório entre 08:00 e 20:00
    const hora = 8 + hashIndex(cob.id + "hora", 12);
    const minuto = hashIndex(cob.id + "min", 60);
    const segundo = hashIndex(cob.id + "seg", 60);
    const horaPagamento = `${padNum(hora, 2)}:${padNum(minuto, 2)}:${padNum(segundo, 2)}`;

    const authHash = cob.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const autenticacao = `${authHash.slice(0, 8)}-${authHash.slice(8, 12)}-${authHash.slice(12, 16)}-${authHash.slice(16, 20)}-${authHash.slice(20, 32).padEnd(12, "0")}`;

    comprovantes.push({
      id: `COMP-${cob.id}`,
      cobrancaId: cob.id,
      endToEndId: e2eId,
      txId,
      valorPago: cob.valorPago,
      dataPagamento: cob.dataPagamento,
      horaPagamento,
      pagador: {
        nome: franqueado.razaoSocial,
        cnpj: franqueado.cnpj,
        banco: bancoPagador.nome,
        agencia: bancoPagador.agencia,
        conta: bancoPagador.conta,
      },
      recebedor: {
        nome: FRANQUEADORA.razaoSocial,
        cnpj: FRANQUEADORA.cnpj,
        banco: bancoRecebedor.nome,
        agencia: bancoRecebedor.agencia,
        conta: bancoRecebedor.conta,
      },
      descricao: cob.descricao,
      autenticacao,
    });
  }

  return comprovantes;
}

// ═══════════════════════════════════════════════════════════
// Exportações
// ═══════════════════════════════════════════════════════════

export const notasFiscaisDummy: NotaFiscal[] = gerarNotasFiscais();
export const boletosDummy: BoletoBancario[] = gerarBoletos();
export const invoicesPixDummy: InvoicePix[] = gerarInvoicesPix();
export const comprovantesPixDummy: ComprovantePix[] = gerarComprovantesPix();

// ── Lookup helpers ────────────────────────────────────────

export function getNfByCobranca(cobrancaId: string): NotaFiscal | undefined {
  return notasFiscaisDummy.find((nf) => nf.cobrancaId === cobrancaId);
}

export function getBoletoByCobranca(cobrancaId: string): BoletoBancario | undefined {
  return boletosDummy.find((b) => b.cobrancaId === cobrancaId);
}

export function getInvoicePixByCobranca(cobrancaId: string): InvoicePix | undefined {
  return invoicesPixDummy.find((p) => p.cobrancaId === cobrancaId);
}

export function getComprovantePixByCobranca(cobrancaId: string): ComprovantePix | undefined {
  return comprovantesPixDummy.find((c) => c.cobrancaId === cobrancaId);
}

// ── Stats ─────────────────────────────────────────────────

export function getDocumentosStats() {
  return {
    notasFiscais: {
      total: notasFiscaisDummy.length,
      valorTotal: notasFiscaisDummy.reduce((s, nf) => s + nf.valorServicos, 0),
    },
    boletos: {
      total: boletosDummy.length,
      pendentes: boletosDummy.filter((b) => b.status === "Pendente").length,
      pagos: boletosDummy.filter((b) => b.status === "Pago").length,
      vencidos: boletosDummy.filter((b) => b.status === "Vencido").length,
      valorTotal: boletosDummy.reduce((s, b) => s + b.valorDocumento, 0),
    },
    invoicesPix: {
      total: invoicesPixDummy.length,
      ativas: invoicesPixDummy.filter((p) => p.status === "ATIVA").length,
      concluidas: invoicesPixDummy.filter((p) => p.status === "CONCLUIDA").length,
      expiradas: invoicesPixDummy.filter((p) => p.status === "EXPIRADA").length,
      valorTotal: invoicesPixDummy.reduce((s, p) => s + p.valorOriginal, 0),
    },
    comprovantes: {
      total: comprovantesPixDummy.length,
      valorTotal: comprovantesPixDummy.reduce((s, c) => s + c.valorPago, 0),
    },
  };
}
