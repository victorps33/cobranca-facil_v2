import { PrismaClient } from "@prisma/client";
import { addDays, subDays } from "date-fns";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import {
  TEMPLATE_EMAIL_D5,
  TEMPLATE_WHATSAPP_D1,
  TEMPLATE_SMS_D3,
  TEMPLATE_WHATSAPP_D7,
} from "../lib/default-dunning-rule";

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Helper to generate deterministic boleto data
function generateBoletoData(
  chargeId: string,
  amountCents: number,
  dueDate: Date
): { linhaDigitavel: string; barcodeValue: string } {
  const dataString = `${chargeId}-${amountCents}-${dueDate.toISOString()}`;
  const hash = createHash("sha256").update(dataString).digest("hex");

  const linhaDigitavel = hash
    .replace(/[a-f]/gi, (m) => String(m.charCodeAt(0) % 10))
    .slice(0, 47)
    .replace(
      /(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d{1})(\d{14})/,
      "$1.$2 $3.$4 $5.$6 $7 $8"
    );

  const barcodeValue = hash
    .replace(/[a-f]/gi, (m) => String(m.charCodeAt(0) % 10))
    .slice(0, 44);

  return { linhaDigitavel, barcodeValue };
}

// ── Customers (30 total) ──
// profile: healthy (~12), controlled (~8), attention (~6), critical (~4), zero (1), all_paid (1)
const customersData: Array<{
  name: string;
  doc: string;
  email: string;
  phone: string;
  cidade: string;
  estado: string;
  bairro: string;
  responsavel: string;
  razaoSocial?: string;
  statusLoja: string;
  profile: "healthy" | "controlled" | "attention" | "critical" | "zero" | "all_paid";
}> = [
  // ── healthy (12) ──
  { name: "Pinheiros", doc: "11.111.111/0001-01", email: "pinheiros@menlo.com.br", phone: "(11) 99999-1111", cidade: "São Paulo", estado: "SP", bairro: "Pinheiros", responsavel: "Maria Silva", razaoSocial: "Menlo Pinheiros Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Botafogo", doc: "22.222.222/0001-02", email: "botafogo@menlo.com.br", phone: "(21) 99999-2222", cidade: "Rio de Janeiro", estado: "RJ", bairro: "Botafogo", responsavel: "João Santos", razaoSocial: "Menlo Botafogo Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Savassi", doc: "33.333.333/0001-03", email: "savassi@menlo.com.br", phone: "(31) 99999-3333", cidade: "Belo Horizonte", estado: "MG", bairro: "Savassi", responsavel: "Ana Oliveira", razaoSocial: "Menlo Savassi Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Lagoa da Conceição", doc: "44.444.444/0001-04", email: "lagoa@menlo.com.br", phone: "(48) 99999-7777", cidade: "Florianópolis", estado: "SC", bairro: "Lagoa da Conceição", responsavel: "Fernanda Lima", razaoSocial: "Menlo Lagoa Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Moinhos de Vento", doc: "55.555.555/0001-05", email: "moinhos@menlo.com.br", phone: "(51) 99999-8888", cidade: "Porto Alegre", estado: "RS", bairro: "Moinhos de Vento", responsavel: "Ricardo Alves", razaoSocial: "Menlo Moinhos Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Batel", doc: "66.666.666/0001-06", email: "batel@menlo.com.br", phone: "(41) 99999-9999", cidade: "Curitiba", estado: "PR", bairro: "Batel", responsavel: "Patrícia Nunes", razaoSocial: "Menlo Batel Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Setor Bueno", doc: "77.777.777/0001-07", email: "setorbueno@menlo.com.br", phone: "(62) 99888-1111", cidade: "Goiânia", estado: "GO", bairro: "Setor Bueno", responsavel: "Thiago Barbosa", razaoSocial: "Menlo Setor Bueno Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Pituba", doc: "88.888.888/0001-08", email: "pituba@menlo.com.br", phone: "(71) 99888-2222", cidade: "Salvador", estado: "BA", bairro: "Pituba", responsavel: "Camila Rocha", razaoSocial: "Menlo Pituba Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Aldeota", doc: "99.999.999/0001-09", email: "aldeota@menlo.com.br", phone: "(85) 99888-3333", cidade: "Fortaleza", estado: "CE", bairro: "Aldeota", responsavel: "Rafael Mendes", razaoSocial: "Menlo Aldeota Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Adrianópolis", doc: "10.101.010/0001-10", email: "adrianopolis@menlo.com.br", phone: "(92) 99888-4444", cidade: "Manaus", estado: "AM", bairro: "Adrianópolis", responsavel: "Juliana Cardoso", razaoSocial: "Menlo Adrianópolis Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Cambuí", doc: "11.121.314/0001-11", email: "cambui@menlo.com.br", phone: "(11) 98888-5555", cidade: "Campinas", estado: "SP", bairro: "Cambuí", responsavel: "Marcelo Teixeira", razaoSocial: "Menlo Cambuí Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },
  { name: "Icaraí", doc: "12.131.415/0001-12", email: "icarai@menlo.com.br", phone: "(21) 98888-6666", cidade: "Niterói", estado: "RJ", bairro: "Icaraí", responsavel: "Beatriz Araújo", razaoSocial: "Menlo Icaraí Franquias LTDA", statusLoja: "Aberta", profile: "healthy" },

  // ── controlled (8) ──
  { name: "Vila Mariana", doc: "13.141.516/0001-13", email: "vilamariana@menlo.com.br", phone: "(11) 99999-4444", cidade: "São Paulo", estado: "SP", bairro: "Vila Mariana", responsavel: "Pedro Costa", razaoSocial: "Menlo Vila Mariana Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },
  { name: "Lourdes", doc: "14.151.617/0001-14", email: "lourdes@menlo.com.br", phone: "(31) 99999-6666", cidade: "Belo Horizonte", estado: "MG", bairro: "Lourdes", responsavel: "Carlos Souza", razaoSocial: "Menlo Lourdes Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },
  { name: "Água Verde", doc: "15.161.718/0001-15", email: "aguaverde@menlo.com.br", phone: "(41) 98888-7777", cidade: "Curitiba", estado: "PR", bairro: "Água Verde", responsavel: "Renata Dias", razaoSocial: "Menlo Água Verde Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },
  { name: "Trindade", doc: "16.171.819/0001-16", email: "trindade@menlo.com.br", phone: "(48) 98888-8888", cidade: "Florianópolis", estado: "SC", bairro: "Trindade", responsavel: "Lucas Ferreira", razaoSocial: "Menlo Trindade Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },
  { name: "Petrópolis", doc: "17.181.920/0001-17", email: "petropolis@menlo.com.br", phone: "(51) 98888-9999", cidade: "Porto Alegre", estado: "RS", bairro: "Petrópolis", responsavel: "Mariana Gomes", razaoSocial: "Menlo Petrópolis Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },
  { name: "Marista", doc: "18.192.021/0001-18", email: "marista@menlo.com.br", phone: "(62) 97777-1111", cidade: "Goiânia", estado: "GO", bairro: "Marista", responsavel: "Vinícius Correia", razaoSocial: "Menlo Marista Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },
  { name: "Horto Florestal", doc: "19.202.122/0001-19", email: "horto@menlo.com.br", phone: "(71) 97777-2222", cidade: "Salvador", estado: "BA", bairro: "Horto Florestal", responsavel: "Isabela Martins", razaoSocial: "Menlo Horto Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },
  { name: "Itaim Bibi", doc: "23.456.789/0001-10", email: "itaim@menlo.com.br", phone: "(11) 3333-2222", cidade: "São Paulo", estado: "SP", bairro: "Itaim Bibi", responsavel: "Rodrigo Pinto", razaoSocial: "Menlo Itaim Franquias LTDA", statusLoja: "Aberta", profile: "controlled" },

  // ── attention (6) ──
  { name: "Mooca", doc: "20.212.223/0001-20", email: "mooca@menlo.com.br", phone: "(11) 99999-5555", cidade: "São Paulo", estado: "SP", bairro: "Mooca", responsavel: "Lucia Ferreira", razaoSocial: "Menlo Mooca Franquias LTDA", statusLoja: "Aberta", profile: "attention" },
  { name: "Meireles", doc: "21.222.324/0001-21", email: "meireles@menlo.com.br", phone: "(85) 97777-3333", cidade: "Fortaleza", estado: "CE", bairro: "Meireles", responsavel: "Roberto Nascimento", razaoSocial: "Menlo Meireles Franquias LTDA", statusLoja: "Aberta", profile: "attention" },
  { name: "Flores", doc: "22.232.425/0001-22", email: "flores@menlo.com.br", phone: "(92) 97777-4444", cidade: "Manaus", estado: "AM", bairro: "Flores", responsavel: "Vanessa Pereira", razaoSocial: "Menlo Flores Franquias LTDA", statusLoja: "Aberta", profile: "attention" },
  { name: "Tijuca", doc: "23.242.526/0001-23", email: "tijuca@menlo.com.br", phone: "(21) 97777-5555", cidade: "Rio de Janeiro", estado: "RJ", bairro: "Tijuca", responsavel: "Gustavo Ribeiro", razaoSocial: "Menlo Tijuca Franquias LTDA", statusLoja: "Aberta", profile: "attention" },
  { name: "Faria Lima", doc: "12.345.678/0001-99", email: "farialima@menlo.com.br", phone: "(11) 3333-1111", cidade: "São Paulo", estado: "SP", bairro: "Faria Lima", responsavel: "André Machado", razaoSocial: "Menlo Faria Lima Franquias LTDA", statusLoja: "Aberta", profile: "attention" },
  { name: "Funcionários", doc: "34.567.890/0001-21", email: "funcionarios@menlo.com.br", phone: "(31) 3333-3333", cidade: "Belo Horizonte", estado: "MG", bairro: "Funcionários", responsavel: "Felipe Ramos", razaoSocial: "Menlo Funcionários Franquias LTDA", statusLoja: "Aberta", profile: "attention" },

  // ── critical (4) ──
  { name: "Campo Comprido", doc: "24.252.627/0001-24", email: "campocomprido@menlo.com.br", phone: "(41) 97777-6666", cidade: "Curitiba", estado: "PR", bairro: "Campo Comprido", responsavel: "Marcos Vieira", razaoSocial: "Menlo Campo Comprido Franquias LTDA", statusLoja: "Aberta", profile: "critical" },
  { name: "Coqueiros", doc: "25.262.728/0001-25", email: "coqueiros@menlo.com.br", phone: "(48) 97777-7777", cidade: "Florianópolis", estado: "SC", bairro: "Coqueiros", responsavel: "Sandra Lopes", razaoSocial: "Menlo Coqueiros Franquias LTDA", statusLoja: "Aberta", profile: "critical" },
  { name: "Jardim América", doc: "26.272.829/0001-26", email: "jardimamerica@menlo.com.br", phone: "(62) 97777-8888", cidade: "Goiânia", estado: "GO", bairro: "Jardim América", responsavel: "Eduardo Almeida", razaoSocial: "Menlo Jardim América Franquias LTDA", statusLoja: "Aberta", profile: "critical" },
  { name: "República", doc: "45.678.901/0001-32", email: "republica@menlo.com.br", phone: "(11) 3333-4444", cidade: "São Paulo", estado: "SP", bairro: "República", responsavel: "Carlos Mendes", razaoSocial: "Menlo República Franquias LTDA", statusLoja: "Aberta", profile: "critical" },

  // ── zero (1 client with 0 charges) ──
  { name: "Barra", doc: "27.282.930/0001-27", email: "barra@menlo.com.br", phone: "(71) 97777-9999", cidade: "Salvador", estado: "BA", bairro: "Barra", responsavel: "Helena Castro", razaoSocial: "Menlo Barra Franquias LTDA", statusLoja: "Aberta", profile: "zero" },

  // ── all_paid (1 client with all PAID) ──
  { name: "Varjota", doc: "28.293.031/0001-28", email: "varjota@menlo.com.br", phone: "(85) 96666-1111", cidade: "Fortaleza", estado: "CE", bairro: "Varjota", responsavel: "Diego Monteiro", razaoSocial: "Menlo Varjota Franquias LTDA", statusLoja: "Aberta", profile: "all_paid" },
];

// ── Charge helper ──
const categorias = ["Royalties", "FNP", "Taxa de Franquia"];
const formasPagamento = ["Boleto", "Pix", "Cartão"];
const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function competenciaFromDate(d: Date): string {
  return `${mesesAbrev[d.getMonth()]}/${d.getFullYear()}`;
}

function descriptionFromCategoria(cat: string): string {
  switch (cat) {
    case "Royalties": return "Royalties mensal";
    case "FNP": return "Fundo Nacional de Propaganda";
    case "Taxa de Franquia": return "Taxa de franquia";
    default: return cat;
  }
}

interface ChargeSpec {
  customerId: string;
  description: string;
  amountCents: number;
  dueDate: Date;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  categoria: string;
  formaPagamento: string;
  competencia: string;
  paidAt: Date | null;
  amountPaidCents: number;
  nfEmitida: boolean;
}

// Generate charges across 6 months for each customer
function generateChargesForCustomer(
  customerId: string,
  profile: "healthy" | "controlled" | "attention" | "critical" | "zero" | "all_paid",
  now: Date
): ChargeSpec[] {
  if (profile === "zero") return [];

  const charges: ChargeSpec[] = [];

  // Generate charges for the last 6 months (including current)
  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    const refDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const dueDay = randInt(5, 25);
    const dueDate = new Date(refDate.getFullYear(), refDate.getMonth(), dueDay);
    const competencia = competenciaFromDate(refDate);
    const isPast = dueDate < now;
    const isCurrentMonth = monthOffset === 0;

    // Each customer gets 1-2 charges per month (Royalties always, FNP sometimes)
    const monthCategorias = ["Royalties"];
    if (Math.random() > 0.4) monthCategorias.push("FNP");
    // Taxa de Franquia only for some months
    if (monthOffset === 4 && Math.random() > 0.5) monthCategorias.push("Taxa de Franquia");

    for (const cat of monthCategorias) {
      const amount = cat === "Royalties"
        ? randInt(150000, 450000)  // R$ 1.500 – R$ 4.500
        : cat === "FNP"
          ? randInt(50000, 150000) // R$ 500 – R$ 1.500
          : randInt(800000, 2000000); // R$ 8.000 – R$ 20.000 (Taxa de Franquia)

      const forma = pickRandom(formasPagamento);

      let status: ChargeSpec["status"];
      let paidAt: Date | null = null;
      let amountPaidCents = 0;
      let nfEmitida = false;

      if (profile === "all_paid") {
        if (isPast) {
          status = "PAID";
          paidAt = addDays(dueDate, randInt(0, 3));
          amountPaidCents = amount;
          nfEmitida = cat === "Royalties" || cat === "FNP" ? Math.random() > 0.3 : false;
        } else {
          status = "PENDING";
        }
      } else if (isCurrentMonth) {
        // Current month: mostly PENDING
        if (profile === "healthy") {
          status = dueDate < now ? (Math.random() > 0.3 ? "PAID" : "PENDING") : "PENDING";
        } else if (profile === "controlled") {
          status = dueDate < now ? (Math.random() > 0.5 ? "PAID" : "OVERDUE") : "PENDING";
        } else if (profile === "attention") {
          status = dueDate < now ? (Math.random() > 0.7 ? "PAID" : "OVERDUE") : "PENDING";
        } else {
          // critical
          status = dueDate < now ? "OVERDUE" : "PENDING";
        }

        if (status === "PAID") {
          paidAt = addDays(dueDate, randInt(0, 5));
          amountPaidCents = amount;
          nfEmitida = (cat === "Royalties" || cat === "FNP") && Math.random() > 0.5;
        }
      } else {
        // Past months
        switch (profile) {
          case "healthy":
            // 90% paid on time, 10% paid late
            status = "PAID";
            paidAt = addDays(dueDate, Math.random() > 0.9 ? randInt(3, 8) : randInt(0, 2));
            amountPaidCents = amount;
            nfEmitida = (cat === "Royalties" || cat === "FNP") && Math.random() > 0.3;
            break;
          case "controlled":
            // 75% paid (some late), 15% overdue, 10% canceled
            if (Math.random() < 0.75) {
              status = "PAID";
              paidAt = addDays(dueDate, randInt(1, 15));
              amountPaidCents = amount;
              nfEmitida = (cat === "Royalties" || cat === "FNP") && Math.random() > 0.5;
            } else if (Math.random() < 0.6) {
              status = "OVERDUE";
            } else {
              status = "CANCELED";
            }
            break;
          case "attention":
            // 50% paid (often late), 40% overdue, 10% canceled
            if (Math.random() < 0.5) {
              status = "PAID";
              paidAt = addDays(dueDate, randInt(5, 30));
              amountPaidCents = amount;
              nfEmitida = (cat === "Royalties" || cat === "FNP") && Math.random() > 0.6;
            } else if (Math.random() < 0.8) {
              status = "OVERDUE";
            } else {
              status = "CANCELED";
            }
            break;
          case "critical":
            // 25% paid (very late), 65% overdue, 10% canceled
            if (Math.random() < 0.25) {
              status = "PAID";
              paidAt = addDays(dueDate, randInt(15, 60));
              amountPaidCents = amount;
            } else if (Math.random() < 0.87) {
              status = "OVERDUE";
            } else {
              status = "CANCELED";
            }
            break;
          default:
            status = "PAID";
            paidAt = addDays(dueDate, randInt(0, 3));
            amountPaidCents = amount;
        }
      }

      charges.push({
        customerId,
        description: descriptionFromCategoria(cat),
        amountCents: amount,
        dueDate,
        status,
        categoria: cat,
        formaPagamento: forma,
        competencia,
        paidAt,
        amountPaidCents,
        nfEmitida,
      });
    }
  }

  return charges;
}

// ── Interaction templates ──
const interactionContents: Record<string, string[]> = {
  EMAIL_OUTBOUND: [
    "Enviado lembrete de cobrança referente a título em atraso.",
    "Encaminhado boleto atualizado conforme solicitação.",
    "Régua D-5: Lembrete automático de vencimento próximo.",
    "Enviado relatório de débitos pendentes.",
  ],
  EMAIL_INBOUND: [
    "Recebi o boleto. Vou providenciar o pagamento.",
    "Gostaria de negociar o débito. Podemos agendar uma reunião?",
    "Confirmando recebimento da notificação.",
  ],
  WHATSAPP_OUTBOUND: [
    "Régua D+3: Cobrança vencida. Solicitado contato.",
    "Oi! Lembrete de pagamento pendente. Segunda via disponível.",
    "Régua D+7: Cobrança segue em aberto. Precisamos resolver.",
  ],
  WHATSAPP_INBOUND: [
    "Boa tarde, vi o e-mail. Vou pagar até semana que vem.",
    "Recebi o boleto. Vou pagar amanhã. Obrigado!",
    "Estou com dificuldades financeiras. Podemos parcelar?",
  ],
  SMS_OUTBOUND: [
    "Régua D+3: Lembrete automático de pagamento pendente.",
    "Régua D-1: Lembrete de vencimento amanhã.",
    "Notificação: seu boleto está disponível para pagamento.",
  ],
  TELEFONE_OUTBOUND: [
    "Ligação para cobrar débito. Cliente informou que pagará em breve.",
    "Contato telefônico. Informou dificuldades financeiras e solicitou parcelamento.",
    "Tentativa de contato. Caixa postal. Deixado recado.",
  ],
  TELEFONE_INBOUND: [
    "Cliente ligou pedindo segunda via do boleto. Enviado por e-mail.",
    "Cliente ligou questionando valor cobrado. Esclarecido.",
    "Cliente retornou ligação e confirmou pagamento para esta semana.",
  ],
  NOTA_INTERNA_OUTBOUND: [
    "Cliente com atrasos recorrentes. Recomendo negociação de parcelamento.",
    "Histórico de atrasos mas sempre paga. Manter acompanhamento normal.",
    "Sem resposta há 30 dias. Verificar situação com comercial.",
    "Proposta de parcelamento enviada. Aguardando retorno.",
  ],
};

// ── Task templates ──
const taskTemplates = {
  critical: [
    { title: "Encaminhar débito para jurídico", desc: "Atrasos recorrentes. Preparar documentação para cobrança judicial." },
    { title: "Tentar contato final", desc: "Última tentativa de negociação antes de encaminhar ao jurídico." },
    { title: "Verificar proposta de parcelamento", desc: "Confirmar se proposta de parcelamento foi aceita pelo cliente." },
    { title: "Investigar situação do cliente", desc: "Sem resposta. Verificar se houve mudança de responsável ou fechamento." },
    { title: "Enviar notificação extrajudicial", desc: "Preparar e enviar notificação formal de débito." },
  ],
  attention: [
    { title: "Acompanhar pagamento parcial", desc: "Cliente prometeu pagamento parcial. Verificar se foi creditado." },
    { title: "Enviar proposta de parcelamento", desc: "Preparar proposta de parcelamento do saldo restante." },
    { title: "Ligar para cobrar débito pendente", desc: "Débito acumulado. Fazer contato para negociação." },
    { title: "Cobrar título vencido", desc: "Verificar se pagamento pendente foi realizado." },
  ],
  controlled: [
    { title: "Ligar sobre atraso recorrente", desc: "Atrasos frequentes. Sugerir pagamento antecipado com desconto." },
    { title: "Atualizar dados cadastrais", desc: "E-mail retornando bounce. Solicitar novo e-mail de contato." },
    { title: "Enviar boleto atualizado", desc: "Cliente solicitou boleto com nova data de vencimento." },
  ],
  healthy: [
    { title: "Revisar contrato de renovação", desc: "Contrato vence em breve. Preparar proposta de renovação." },
    { title: "Enviar relatório de adimplência", desc: "Cliente solicitou relatório de pagamentos do último semestre." },
    { title: "Parabenizar pela adimplência", desc: "Cliente em dia. Enviar reconhecimento e oferecer benefícios." },
  ],
};

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data (order matters for FK constraints)
  await prisma.conversationRead.deleteMany();
  await prisma.message.deleteMany();
  await prisma.agentDecisionLog.deleteMany();
  await prisma.messageQueue.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.agentConfig.deleteMany();
  await prisma.collectionTask.deleteMany();
  await prisma.interactionLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.dunningStep.deleteMany();
  await prisma.dunningRule.deleteMany();
  await prisma.boleto.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.appState.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.franqueadora.deleteMany();

  console.log("🧹 Cleared existing data");

  // Create Franqueadora
  const franqueadora = await prisma.franqueadora.create({
    data: {
      nome: "Menlo Franqueadora",
      razaoSocial: "Menlo Tecnologia LTDA",
      cnpj: "12.345.678/0001-00",
      email: "contato@menlo.com.br",
      responsavel: "Victor Sundfeld",
    },
  });

  console.log(`✅ Created Franqueadora: ${franqueadora.nome}`);

  // Create Users
  const adminPassword = await hashPassword("admin123");
  const userPassword = await hashPassword("user123");

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Admin Menlo",
        email: "admin@menlo.com.br",
        password: adminPassword,
        role: "ADMINISTRADOR",
        franqueadoraId: franqueadora.id,
        onboardingCompletedAt: new Date(),
        checklistDismissedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: "Maria Financeiro",
        email: "financeiro@menlo.com.br",
        password: userPassword,
        role: "FINANCEIRO",
        franqueadoraId: franqueadora.id,
        onboardingCompletedAt: new Date(),
        checklistDismissedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: "João Operacional",
        email: "operacional@menlo.com.br",
        password: userPassword,
        role: "OPERACIONAL",
        franqueadoraId: franqueadora.id,
        onboardingCompletedAt: new Date(),
        checklistDismissedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: "Ana Visualizador",
        email: "visualizador@menlo.com.br",
        password: userPassword,
        role: "VISUALIZADOR",
        franqueadoraId: franqueadora.id,
        onboardingCompletedAt: new Date(),
        checklistDismissedAt: new Date(),
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create AppState
  await prisma.appState.create({
    data: { id: 1, simulatedNow: null },
  });

  // Create customers (linked to franqueadora)
  const customers = await Promise.all(
    customersData.map((data) =>
      prisma.customer.create({
        data: {
          name: data.name,
          doc: data.doc,
          email: data.email,
          phone: data.phone,
          cidade: data.cidade,
          estado: data.estado,
          bairro: data.bairro,
          responsavel: data.responsavel,
          razaoSocial: data.razaoSocial,
          statusLoja: data.statusLoja,
          dataAbertura: subDays(new Date(), randInt(180, 900)),
          franqueadoraId: franqueadora.id,
        },
      })
    )
  );

  console.log(`✅ Created ${customers.length} customers`);

  // Create charges using profile-based generation (6 months of data)
  const now = new Date();
  const allChargeSpecs: ChargeSpec[] = [];
  customersData.forEach((cd, idx) => {
    const specs = generateChargesForCustomer(customers[idx].id, cd.profile, now);
    allChargeSpecs.push(...specs);
  });

  const createdCharges = await Promise.all(
    allChargeSpecs.map((data) =>
      prisma.charge.create({
        data: {
          customerId: data.customerId,
          description: data.description,
          amountCents: data.amountCents,
          dueDate: data.dueDate,
          status: data.status,
          categoria: data.categoria,
          formaPagamento: data.formaPagamento,
          competencia: data.competencia,
          paidAt: data.paidAt,
          amountPaidCents: data.amountPaidCents,
          nfEmitida: data.nfEmitida,
        },
      })
    )
  );

  console.log(`✅ Created ${createdCharges.length} charges (across 6 months)`);

  // Generate boletos for ~60% of non-canceled charges
  const chargesToGenerateBoleto = createdCharges
    .filter((c) => c.status !== "CANCELED")
    .slice(0, Math.floor(createdCharges.filter((c) => c.status !== "CANCELED").length * 0.6));

  const boletos = await Promise.all(
    chargesToGenerateBoleto.map((charge) => {
      const { linhaDigitavel, barcodeValue } = generateBoletoData(
        charge.id,
        charge.amountCents,
        charge.dueDate
      );
      return prisma.boleto.create({
        data: {
          chargeId: charge.id,
          linhaDigitavel,
          barcodeValue,
          publicUrl: "",
        },
      });
    })
  );

  await Promise.all(
    boletos.map((boleto) =>
      prisma.boleto.update({
        where: { id: boleto.id },
        data: { publicUrl: `/boleto/${boleto.id}` },
      })
    )
  );

  console.log(`✅ Created ${boletos.length} boletos`);

  // Create dunning rule (linked to franqueadora)
  const dunningRule = await prisma.dunningRule.create({
    data: {
      name: "Régua Padrão",
      active: true,
      timezone: "America/Sao_Paulo",
      franqueadoraId: franqueadora.id,
    },
  });

  const steps = [
    { ruleId: dunningRule.id, trigger: "BEFORE_DUE" as const, offsetDays: 5, channel: "EMAIL" as const, template: TEMPLATE_EMAIL_D5, enabled: true },
    { ruleId: dunningRule.id, trigger: "BEFORE_DUE" as const, offsetDays: 1, channel: "WHATSAPP" as const, template: TEMPLATE_WHATSAPP_D1, enabled: true },
    { ruleId: dunningRule.id, trigger: "AFTER_DUE" as const, offsetDays: 3, channel: "SMS" as const, template: TEMPLATE_SMS_D3, enabled: true },
    { ruleId: dunningRule.id, trigger: "AFTER_DUE" as const, offsetDays: 7, channel: "WHATSAPP" as const, template: TEMPLATE_WHATSAPP_D7, enabled: true },
  ];

  await Promise.all(
    steps.map((step) => prisma.dunningStep.create({ data: step }))
  );

  console.log(`✅ Created dunning rule with ${steps.length} steps`);

  // ── CRM: Interaction Logs (~60) ──
  const [adminUser, financeiroUser, operacionalUser] = users;
  const assignableUsers = [adminUser, financeiroUser, operacionalUser];

  const interactionTypes = ["EMAIL", "WHATSAPP", "SMS", "TELEFONE", "NOTA_INTERNA"] as const;
  const interactionDirections = ["OUTBOUND", "INBOUND"] as const;

  interface InteractionSpec {
    customerId: string;
    type: (typeof interactionTypes)[number];
    direction: (typeof interactionDirections)[number];
    content: string;
    createdById: string;
    createdAt: Date;
  }

  const allInteractions: InteractionSpec[] = [];

  // Helper to generate interactions for a customer based on profile
  function generateInteractionsForCustomer(
    customerId: string,
    profile: string,
    count: number
  ) {
    for (let i = 0; i < count; i++) {
      const isOutbound = Math.random() < 0.7;
      const direction = isOutbound ? "OUTBOUND" : "INBOUND";
      const type = pickRandom([...interactionTypes]);
      // NOTA_INTERNA is always OUTBOUND
      const actualDirection = type === "NOTA_INTERNA" ? "OUTBOUND" : direction;
      const key = `${type}_${actualDirection}`;
      const contents = interactionContents[key] || interactionContents[`${type}_OUTBOUND`] || interactionContents["EMAIL_OUTBOUND"];
      const content = pickRandom(contents);
      const createdById = pickRandom(assignableUsers).id;

      allInteractions.push({
        customerId,
        type,
        direction: actualDirection,
        content,
        createdById,
        createdAt: subDays(now, randInt(1, 60)),
      });
    }
  }

  // Distribute interactions based on risk profile
  customersData.forEach((cd, idx) => {
    const custId = customers[idx].id;
    switch (cd.profile) {
      case "critical":
        generateInteractionsForCustomer(custId, cd.profile, randInt(6, 8));
        break;
      case "attention":
        generateInteractionsForCustomer(custId, cd.profile, randInt(3, 4));
        break;
      case "controlled":
        generateInteractionsForCustomer(custId, cd.profile, randInt(1, 2));
        break;
      case "healthy":
        // Some healthy clients get 0-1 automatic interactions
        if (Math.random() > 0.5) {
          generateInteractionsForCustomer(custId, cd.profile, 1);
        }
        break;
      // zero and all_paid: edge case — zero interactions for the "zero charges" client
      case "all_paid":
        if (Math.random() > 0.5) {
          generateInteractionsForCustomer(custId, cd.profile, 1);
        }
        break;
      case "zero":
        // 0 interactions — edge case
        break;
    }
  });

  await Promise.all(
    allInteractions.map((data) =>
      prisma.interactionLog.create({ data })
    )
  );

  console.log(`✅ Created ${allInteractions.length} CRM interactions`);

  // ── CRM: Collection Tasks (~40) ──
  interface TaskSpec {
    customerId: string;
    title: string;
    description: string;
    status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
    priority: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
    dueDate: Date;
    assignedToId: string;
    createdById: string;
    createdAt: Date;
    completedAt?: Date;
  }

  const allTasks: TaskSpec[] = [];

  function addTask(
    customerId: string,
    profile: string,
    template: { title: string; desc: string },
    status: TaskSpec["status"],
    priority: TaskSpec["priority"]
  ) {
    const assignedTo = pickRandom(assignableUsers);
    const createdBy = pickRandom(assignableUsers);
    let dueDate: Date;
    let completedAt: Date | undefined;
    const createdAt = subDays(now, randInt(5, 40));

    switch (status) {
      case "PENDENTE":
        // Some overdue (past), some future
        dueDate = Math.random() > 0.4 ? addDays(now, randInt(1, 20)) : subDays(now, randInt(1, 10));
        break;
      case "EM_ANDAMENTO":
        dueDate = Math.random() > 0.3 ? addDays(now, randInt(1, 10)) : subDays(now, randInt(1, 5));
        break;
      case "CONCLUIDA":
        dueDate = subDays(now, randInt(5, 30));
        completedAt = subDays(now, randInt(1, 10));
        break;
      case "CANCELADA":
        dueDate = subDays(now, randInt(10, 30));
        break;
    }

    allTasks.push({
      customerId,
      title: template.title,
      description: template.desc,
      status,
      priority,
      dueDate,
      assignedToId: assignedTo.id,
      createdById: createdBy.id,
      createdAt,
      completedAt,
    });
  }

  // Generate tasks based on profiles
  customersData.forEach((cd, idx) => {
    const custId = customers[idx].id;
    switch (cd.profile) {
      case "critical": {
        // 3-4 tasks per critical client
        const templates = taskTemplates.critical;
        addTask(custId, cd.profile, templates[0], "PENDENTE", "CRITICA");
        addTask(custId, cd.profile, templates[1], "CONCLUIDA", "ALTA");
        addTask(custId, cd.profile, templates[2], "EM_ANDAMENTO", "ALTA");
        if (Math.random() > 0.5) addTask(custId, cd.profile, templates[3], "PENDENTE", "CRITICA");
        break;
      }
      case "attention": {
        // 2-3 tasks
        const templates = taskTemplates.attention;
        addTask(custId, cd.profile, templates[0], "EM_ANDAMENTO", "ALTA");
        addTask(custId, cd.profile, templates[1], "PENDENTE", "ALTA");
        if (Math.random() > 0.4) addTask(custId, cd.profile, templates[2], "PENDENTE", "MEDIA");
        break;
      }
      case "controlled": {
        // 1-2 tasks
        const templates = taskTemplates.controlled;
        addTask(custId, cd.profile, pickRandom(templates), "PENDENTE", "MEDIA");
        if (Math.random() > 0.5) addTask(custId, cd.profile, pickRandom(templates), "CONCLUIDA", "BAIXA");
        break;
      }
      case "healthy": {
        // 0-1 tasks
        if (Math.random() > 0.6) {
          addTask(custId, cd.profile, pickRandom(taskTemplates.healthy), "PENDENTE", "BAIXA");
        }
        break;
      }
      default:
        break;
    }
  });

  // Add a few CANCELADA tasks
  for (let i = 0; i < 5; i++) {
    const profile = pickRandom(["attention", "critical"] as const);
    const templates = profile === "critical" ? taskTemplates.critical : taskTemplates.attention;
    const custIdx = customersData.findIndex((c) => c.profile === profile);
    if (custIdx >= 0) {
      addTask(
        customers[custIdx].id,
        profile,
        pickRandom(templates),
        "CANCELADA",
        pickRandom(["ALTA", "MEDIA"] as const)
      );
    }
  }

  await Promise.all(
    allTasks.map((data) =>
      prisma.collectionTask.create({ data })
    )
  );

  console.log(`✅ Created ${allTasks.length} CRM tasks`);

  // ── Agent Config ──
  await prisma.agentConfig.create({
    data: {
      franqueadoraId: franqueadora.id,
      enabled: true,
      maxDailyMessages: 100,
      escalationThreshold: 0.3,
      highValueThreshold: 1000000,
      workingHoursStart: 8,
      workingHoursEnd: 20,
      timezone: "America/Sao_Paulo",
    },
  });

  console.log("✅ Created AgentConfig");

  // ── Conversations, Messages & Agent Decisions ──
  // Create conversations for ~10 customers with varying states

  const conversationScenarios: Array<{
    customerIdx: number;
    channel: "WHATSAPP" | "EMAIL" | "SMS";
    status: "ABERTA" | "PENDENTE_IA" | "PENDENTE_HUMANO" | "RESOLVIDA";
    assignedToIdx?: number;
    messages: Array<{
      sender: "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
      content: string;
      isInternal?: boolean;
      minutesAgo: number;
    }>;
    aiDecision?: {
      action: "SEND_COLLECTION" | "RESPOND_CUSTOMER" | "ESCALATE_HUMAN" | "NEGOTIATE" | "MARK_PROMISE";
      reasoning: string;
      confidence: number;
      escalationReason?: "LEGAL_THREAT" | "EXPLICIT_REQUEST" | "AI_UNCERTAINTY" | "HIGH_VALUE" | "DISPUTE";
    };
  }> = [
    // 1. WhatsApp - Cliente prometeu pagar (ABERTA)
    {
      customerIdx: 2, // Ana Oliveira - healthy
      channel: "WHATSAPP",
      status: "ABERTA",
      messages: [
        { sender: "AI", content: "Olá Ana! Lembrete: sua mensalidade de R$ 1.500,00 vence amanhã. Precisa de algo?", minutesAgo: 120 },
        { sender: "CUSTOMER", content: "Oi! Vou pagar amanhã de manhã, obrigada pelo lembrete!", minutesAgo: 95 },
        { sender: "AI", content: "Ótimo, Ana! Fico no aguardo. Qualquer dúvida estou por aqui. Bom dia!", minutesAgo: 93 },
      ],
      aiDecision: {
        action: "MARK_PROMISE",
        reasoning: "Cliente prometeu pagamento para amanhã. Registrando promessa.",
        confidence: 0.92,
      },
    },
    // 2. WhatsApp - Cliente pedindo parcelamento (PENDENTE_IA)
    {
      customerIdx: 15, // Lucia Ferreira - attention
      channel: "WHATSAPP",
      status: "PENDENTE_IA",
      messages: [
        { sender: "AI", content: "Oi Lucia! Notamos que a cobrança de Consultoria (R$ 3.200,00) está em atraso há 15 dias. Podemos ajudar a regularizar?", minutesAgo: 60 },
        { sender: "CUSTOMER", content: "Estou com dificuldades financeiras esse mês. Tem como parcelar?", minutesAgo: 45 },
        { sender: "AI", content: "Entendo, Lucia. Posso verificar opções de parcelamento para você. O valor total é R$ 3.200,00 — conseguiríamos em até 3x sem juros. Gostaria de seguir assim?", minutesAgo: 43 },
        { sender: "CUSTOMER", content: "3x fica bom! Pode fazer?", minutesAgo: 30 },
      ],
      aiDecision: {
        action: "NEGOTIATE",
        reasoning: "Cliente aceitou parcelamento em 3x. Aguardando confirmação do sistema.",
        confidence: 0.85,
      },
    },
    // 3. Email - Cobrança formal (ABERTA)
    {
      customerIdx: 3, // Pedro Costa - controlled
      channel: "EMAIL",
      status: "ABERTA",
      messages: [
        { sender: "AI", content: "Prezado Pedro,\n\nInformamos que a cobrança referente a Licença Software no valor de R$ 2.800,00, com vencimento em 15/01/2026, encontra-se pendente.\n\nCaso já tenha efetuado o pagamento, desconsidere esta mensagem.\n\nAtenciosamente,\nEquipe Menlo", minutesAgo: 1440 },
        { sender: "CUSTOMER", content: "Recebi a notificação. Vou providenciar o pagamento até sexta-feira.", minutesAgo: 720 },
        { sender: "AI", content: "Obrigado pelo retorno, Pedro. Ficamos no aguardo e qualquer necessidade estamos à disposição.\n\nAtenciosamente,\nEquipe Menlo", minutesAgo: 718 },
      ],
      aiDecision: {
        action: "RESPOND_CUSTOMER",
        reasoning: "Cliente confirmou pagamento para sexta. Resposta de agradecimento enviada.",
        confidence: 0.88,
      },
    },
    // 4. WhatsApp - Escalação por ameaça legal (PENDENTE_HUMANO)
    {
      customerIdx: 22, // Marcos Vieira - critical
      channel: "WHATSAPP",
      status: "PENDENTE_HUMANO",
      assignedToIdx: 0, // admin
      messages: [
        { sender: "AI", content: "Olá Marcos. Gostaríamos de conversar sobre as cobranças pendentes totalizando R$ 8.500,00. Podemos encontrar uma solução juntos?", minutesAgo: 180 },
        { sender: "CUSTOMER", content: "Já falei que não devo isso! Vou procurar meu advogado se continuarem me cobrando!", minutesAgo: 150 },
        { sender: "SYSTEM", content: "⚠️ Escalação automática: LEGAL_THREAT\nPalavra-chave detectada: \"advogado\"", isInternal: true, minutesAgo: 149 },
        { sender: "AI", content: "Obrigada pelo contato. Vou transferir você para um especialista da nossa equipe que poderá ajudá-lo melhor. Em breve alguém entrará em contato.", minutesAgo: 148 },
      ],
      aiDecision: {
        action: "ESCALATE_HUMAN",
        reasoning: "Safety net: Palavra-chave detectada: \"advogado\"",
        confidence: 0.15,
        escalationReason: "LEGAL_THREAT",
      },
    },
    // 5. SMS - Lembrete simples (ABERTA)
    {
      customerIdx: 0, // Maria Silva - healthy
      channel: "SMS",
      status: "ABERTA",
      messages: [
        { sender: "AI", content: "Maria, sua cobrança Mensalidade (R$ 1.200,00) vence em 3 dias. Boleto disponível.", minutesAgo: 240 },
      ],
      aiDecision: {
        action: "SEND_COLLECTION",
        reasoning: "Lembrete D-3 para cliente saudável via SMS.",
        confidence: 0.95,
      },
    },
    // 6. WhatsApp - Cliente pediu humano (PENDENTE_HUMANO)
    {
      customerIdx: 16, // Roberto Nascimento - attention
      channel: "WHATSAPP",
      status: "PENDENTE_HUMANO",
      assignedToIdx: 1, // financeiro
      messages: [
        { sender: "AI", content: "Oi Roberto! Sua cobrança de Manutenção (R$ 4.100,00) está em atraso. Posso ajudar?", minutesAgo: 300 },
        { sender: "CUSTOMER", content: "Quero falar com um atendente humano, por favor", minutesAgo: 280 },
        { sender: "SYSTEM", content: "⚠️ Escalação automática: EXPLICIT_REQUEST\nPedido explícito detectado: \"atendente\"", isInternal: true, minutesAgo: 279 },
        { sender: "AI", content: "Obrigada pelo contato. Vou transferir você para um especialista da nossa equipe que poderá ajudá-lo melhor. Em breve alguém entrará em contato.", minutesAgo: 278 },
        { sender: "AGENT", content: "Olá Roberto, sou a Maria do financeiro. Vi que precisa de ajuda. Como posso te ajudar?", minutesAgo: 200 },
        { sender: "CUSTOMER", content: "Oi Maria! Quero entender melhor essas cobranças, acho que tem erro no valor.", minutesAgo: 180 },
      ],
      aiDecision: {
        action: "ESCALATE_HUMAN",
        reasoning: "Safety net: Pedido explícito detectado: \"atendente\"",
        confidence: 0.2,
        escalationReason: "EXPLICIT_REQUEST",
      },
    },
    // 7. Email - Conversa resolvida (RESOLVIDA)
    {
      customerIdx: 1, // João Santos - healthy
      channel: "EMAIL",
      status: "RESOLVIDA",
      messages: [
        { sender: "AI", content: "Prezado João,\n\nSua cobrança de Hospedagem (R$ 890,00) está em atraso. Pedimos a gentileza de regularizar.\n\nAtenciosamente,\nEquipe Menlo", minutesAgo: 4320 },
        { sender: "CUSTOMER", content: "Pago! Segue comprovante em anexo.", minutesAgo: 2880 },
        { sender: "AI", content: "Recebemos seu comprovante. Agradecemos o pagamento, João!\n\nAtenciosamente,\nEquipe Menlo", minutesAgo: 2878 },
      ],
      aiDecision: {
        action: "RESPOND_CUSTOMER",
        reasoning: "Cliente confirmou pagamento com comprovante. Conversa resolvida.",
        confidence: 0.94,
      },
    },
    // 8. WhatsApp - Disputa de valor (PENDENTE_HUMANO)
    {
      customerIdx: 19, // Tech Solutions LTDA - attention
      channel: "WHATSAPP",
      status: "PENDENTE_HUMANO",
      messages: [
        { sender: "AI", content: "Olá! Gostaríamos de tratar sobre a cobrança de Marketing Digital (R$ 5.600,00) em atraso há 20 dias.", minutesAgo: 500 },
        { sender: "CUSTOMER", content: "Esse valor está errado. O contrato diz R$ 3.500. Vou registrar reclamação no Reclame Aqui se não corrigirem.", minutesAgo: 480 },
        { sender: "SYSTEM", content: "⚠️ Escalação automática: LEGAL_THREAT\nPalavra-chave detectada: \"reclame aqui\"", isInternal: true, minutesAgo: 479 },
        { sender: "AI", content: "Obrigada pelo contato. Vou transferir você para um especialista da nossa equipe que poderá ajudá-lo melhor. Em breve alguém entrará em contato.", minutesAgo: 478 },
      ],
      aiDecision: {
        action: "ESCALATE_HUMAN",
        reasoning: "Safety net: Palavra-chave detectada: \"reclame aqui\"",
        confidence: 0.1,
        escalationReason: "LEGAL_THREAT",
      },
    },
    // 9. WhatsApp - Cobrança D+7 (ABERTA)
    {
      customerIdx: 7, // Camila Rocha - healthy
      channel: "WHATSAPP",
      status: "ABERTA",
      messages: [
        { sender: "AI", content: "Oi Camila! A cobrança de Suporte Técnico (R$ 1.800,00) segue em aberto desde 03/02. Segunda via disponível. Se precisar negociar, me avise.", minutesAgo: 60 },
        { sender: "CUSTOMER", content: "Desculpa o atraso! Vou pagar hoje à tarde.", minutesAgo: 35 },
        { sender: "AI", content: "Sem problemas, Camila! Obrigada pela resposta. Qualquer dúvida, estou aqui.", minutesAgo: 33 },
      ],
      aiDecision: {
        action: "RESPOND_CUSTOMER",
        reasoning: "Cliente se desculpou e prometeu pagamento para hoje. Tom positivo.",
        confidence: 0.91,
      },
    },
    // 10. Email - Alto valor (PENDENTE_HUMANO)
    {
      customerIdx: 25, // Beta Serviços EIRELI - critical
      channel: "EMAIL",
      status: "PENDENTE_HUMANO",
      messages: [
        { sender: "AI", content: "Prezados,\n\nAs cobranças pendentes da Beta Serviços EIRELI totalizam R$ 12.500,00 com atraso de 45 dias. Solicitamos regularização urgente.\n\nAtenciosamente,\nEquipe Menlo", minutesAgo: 2000 },
        { sender: "CUSTOMER", content: "Estamos passando por reestruturação financeira. Gostaríamos de negociar um desconto para quitação à vista.", minutesAgo: 1500 },
      ],
      aiDecision: {
        action: "ESCALATE_HUMAN",
        reasoning: "Valor acima do limiar de alto valor (R$ 12.500). Escalando para negociação humana.",
        confidence: 0.7,
        escalationReason: "HIGH_VALUE",
      },
    },
  ];

  let convCount = 0;
  let msgCount = 0;
  let decCount = 0;

  for (const scenario of conversationScenarios) {
    const customer = customers[scenario.customerIdx];

    const conversation = await prisma.conversation.create({
      data: {
        customerId: customer.id,
        franqueadoraId: franqueadora.id,
        channel: scenario.channel,
        status: scenario.status,
        assignedToId: scenario.assignedToIdx !== undefined ? users[scenario.assignedToIdx].id : null,
        lastMessageAt: subDays(now, 0), // Will be updated
        resolvedAt: scenario.status === "RESOLVIDA" ? subDays(now, 1) : null,
      },
    });
    convCount++;

    let lastMsgTime = now;
    for (const msg of scenario.messages) {
      const msgTime = new Date(now.getTime() - msg.minutesAgo * 60 * 1000);
      lastMsgTime = msgTime;

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          sender: msg.sender,
          senderUserId: msg.sender === "AGENT" && scenario.assignedToIdx !== undefined
            ? users[scenario.assignedToIdx].id
            : null,
          content: msg.content,
          contentType: "text",
          channel: scenario.channel,
          isInternal: msg.isInternal || false,
          createdAt: msgTime,
        },
      });
      msgCount++;
    }

    // Update lastMessageAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: lastMsgTime },
    });

    // Create AI decision log
    if (scenario.aiDecision) {
      await prisma.agentDecisionLog.create({
        data: {
          conversationId: conversation.id,
          customerId: customer.id,
          franqueadoraId: franqueadora.id,
          action: scenario.aiDecision.action,
          reasoning: scenario.aiDecision.reasoning,
          confidence: scenario.aiDecision.confidence,
          inputContext: JSON.stringify({ conversationId: conversation.id, channel: scenario.channel }),
          outputMessage: scenario.messages.find((m) => m.sender === "AI")?.content || null,
          escalationReason: scenario.aiDecision.escalationReason || null,
          executedAt: new Date(now.getTime() - (scenario.messages[0]?.minutesAgo || 0) * 60 * 1000),
        },
      });
      decCount++;
    }
  }

  console.log(`✅ Created ${convCount} conversations, ${msgCount} messages, ${decCount} agent decisions`);

  // ── MessageQueue seed (some pending, some sent) ──
  const queueCustomerIdxs = [2, 0, 7];
  let queueCount = 0;
  for (const idx of queueCustomerIdxs) {
    const cust = customers[idx];
    await prisma.messageQueue.create({
      data: {
        customerId: cust.id,
        channel: "WHATSAPP",
        content: `Lembrete: sua cobrança está pendente. Entre em contato.`,
        status: "SENT",
        priority: 0,
        scheduledFor: subDays(now, 1),
        sentAt: subDays(now, 1),
        franqueadoraId: franqueadora.id,
        providerMsgId: `mock-wa-seed-${idx}`,
      },
    });
    queueCount++;
  }

  // A few pending in queue
  await prisma.messageQueue.create({
    data: {
      customerId: customers[15].id,
      channel: "WHATSAPP",
      content: "Lucia, gostaríamos de confirmar o parcelamento. Podemos seguir?",
      status: "PENDING",
      priority: 1,
      scheduledFor: addDays(now, 0),
      franqueadoraId: franqueadora.id,
    },
  });
  queueCount++;

  console.log(`✅ Created ${queueCount} message queue items`);

  console.log("\n📋 Test users:");
  console.log("  admin@menlo.com.br / admin123 (ADMINISTRADOR)");
  console.log("  financeiro@menlo.com.br / user123 (FINANCEIRO)");
  console.log("  operacional@menlo.com.br / user123 (OPERACIONAL)");
  console.log("  visualizador@menlo.com.br / user123 (VISUALIZADOR)");

  console.log(`\n📊 Summary: ${customers.length} customers, ${createdCharges.length} charges, ${allInteractions.length} interactions, ${allTasks.length} tasks, ${convCount} conversations, ${msgCount} messages, ${decCount} agent decisions`);
  console.log("\n🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
