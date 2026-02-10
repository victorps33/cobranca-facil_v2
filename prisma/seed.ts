import { PrismaClient } from "@prisma/client";
import { addDays, subDays } from "date-fns";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

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
  profile: "healthy" | "controlled" | "attention" | "critical" | "zero" | "all_paid";
}> = [
  // ── healthy (12) ──
  { name: "Maria Silva", doc: "123.456.789-00", email: "maria@email.com", phone: "(11) 99999-1111", profile: "healthy" },
  { name: "João Santos", doc: "234.567.890-11", email: "joao@email.com", phone: "(21) 99999-2222", profile: "healthy" },
  { name: "Ana Oliveira", doc: "345.678.901-22", email: "ana@email.com", phone: "(31) 99999-3333", profile: "healthy" },
  { name: "Fernanda Lima", doc: "789.012.345-66", email: "fernanda@email.com", phone: "(48) 99999-7777", profile: "healthy" },
  { name: "Ricardo Alves", doc: "890.123.456-77", email: "ricardo@email.com", phone: "(51) 99999-8888", profile: "healthy" },
  { name: "Patrícia Nunes", doc: "901.234.567-88", email: "patricia@email.com", phone: "(41) 99999-9999", profile: "healthy" },
  { name: "Thiago Barbosa", doc: "112.345.678-01", email: "thiago@email.com", phone: "(62) 99888-1111", profile: "healthy" },
  { name: "Camila Rocha", doc: "223.456.789-12", email: "camila@email.com", phone: "(71) 99888-2222", profile: "healthy" },
  { name: "Rafael Mendes", doc: "334.567.890-23", email: "rafael@email.com", phone: "(85) 99888-3333", profile: "healthy" },
  { name: "Juliana Cardoso", doc: "445.678.901-34", email: "juliana@email.com", phone: "(92) 99888-4444", profile: "healthy" },
  { name: "Marcelo Teixeira", doc: "556.789.012-45", email: "marcelo@email.com", phone: "(11) 98888-5555", profile: "healthy" },
  { name: "Beatriz Araújo", doc: "667.890.123-56", email: "beatriz@email.com", phone: "(21) 98888-6666", profile: "healthy" },

  // ── controlled (8) ──
  { name: "Pedro Costa", doc: "456.789.012-33", email: "pedro@email.com", phone: "(11) 99999-4444", profile: "controlled" },
  { name: "Carlos Souza", doc: "678.901.234-55", email: "carlos@email.com", phone: "(31) 99999-6666", profile: "controlled" },
  { name: "Renata Dias", doc: "778.901.234-67", email: "renata@email.com", phone: "(41) 98888-7777", profile: "controlled" },
  { name: "Lucas Ferreira", doc: "889.012.345-78", email: "lucas@email.com", phone: "(48) 98888-8888", profile: "controlled" },
  { name: "Mariana Gomes", doc: "990.123.456-89", email: "mariana@email.com", phone: "(51) 98888-9999", profile: "controlled" },
  { name: "Vinícius Correia", doc: "101.234.567-90", email: "vinicius@email.com", phone: "(62) 97777-1111", profile: "controlled" },
  { name: "Isabela Martins", doc: "212.345.678-01", email: "isabela@email.com", phone: "(71) 97777-2222", profile: "controlled" },
  { name: "Soluções Digitais LTDA", doc: "23.456.789/0001-10", email: "financeiro@solucoesdigitais.com", phone: "(11) 3333-2222", profile: "controlled" },

  // ── attention (6) ──
  { name: "Lucia Ferreira", doc: "567.890.123-44", email: "lucia@email.com", phone: "(11) 99999-5555", profile: "attention" },
  { name: "Roberto Nascimento", doc: "323.456.789-23", email: "roberto@email.com", phone: "(85) 97777-3333", profile: "attention" },
  { name: "Vanessa Pereira", doc: "434.567.890-34", email: "vanessa@email.com", phone: "(92) 97777-4444", profile: "attention" },
  { name: "Gustavo Ribeiro", doc: "545.678.901-45", email: "gustavo@email.com", phone: "(21) 97777-5555", profile: "attention" },
  { name: "Tech Solutions LTDA", doc: "12.345.678/0001-99", email: "financeiro@techsolutions.com", phone: "(11) 3333-1111", profile: "attention" },
  { name: "Alfa Consultoria LTDA", doc: "34.567.890/0001-21", email: "contato@alfaconsultoria.com", phone: "(31) 3333-3333", profile: "attention" },

  // ── critical (4) ──
  { name: "Marcos Vieira", doc: "656.789.012-56", email: "marcos@email.com", phone: "(41) 97777-6666", profile: "critical" },
  { name: "Sandra Lopes", doc: "767.890.123-67", email: "sandra@email.com", phone: "(48) 97777-7777", profile: "critical" },
  { name: "Eduardo Almeida", doc: "878.901.234-78", email: "eduardo@email.com", phone: "(62) 97777-8888", profile: "critical" },
  { name: "Beta Serviços EIRELI", doc: "45.678.901/0001-32", email: "financeiro@betaservicos.com", phone: "(11) 3333-4444", profile: "critical" },

  // ── zero (1 client with 0 charges) ──
  { name: "Helena Castro", doc: "989.012.345-89", email: "helena@email.com", phone: "(71) 97777-9999", profile: "zero" },

  // ── all_paid (1 client with all PAID) ──
  { name: "Diego Monteiro", doc: "090.123.456-90", email: "diego@email.com", phone: "(85) 96666-1111", profile: "all_paid" },
];

// Template presets
const TEMPLATE_EMAIL_D5 = `Olá, {{nome}}! 😊
Só um lembrete de que a cobrança **{{descricao}}** no valor de **{{valor}}** vence em **{{vencimento}}**.
Boleto: {{link_boleto}}
Se já estiver tudo certo, pode ignorar esta mensagem. Obrigado!`;

const TEMPLATE_WHATSAPP_D1 = `Oi, {{nome}}! Lembrete: **{{descricao}}** ({{valor}}) vence amanhã ({{vencimento}}). Boleto: {{link_boleto}}`;

const TEMPLATE_SMS_D3 = `{{nome}}, a cobrança {{descricao}} ({{valor}}) venceu em {{vencimento}}. Para pagar: {{link_boleto}}`;

const TEMPLATE_WHATSAPP_D7 = `Oi, {{nome}}. A cobrança **{{descricao}}** ({{valor}}) segue em aberto desde **{{vencimento}}**. 2ª via: {{link_boleto}}. Se precisar negociar, me avise.`;

// ── Charge helper ──
const chargeDescriptions = [
  "Mensalidade",
  "Consultoria",
  "Licença Software",
  "Manutenção",
  "Suporte Técnico",
  "Hospedagem",
  "Marketing Digital",
  "Assessoria Contábil",
  "Treinamento",
  "Implantação",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface ChargeSpec {
  customerId: string;
  description: string;
  amountCents: number;
  dueDate: Date;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
}

function generateChargesForCustomer(
  customerId: string,
  profile: "healthy" | "controlled" | "attention" | "critical" | "zero" | "all_paid",
  now: Date
): ChargeSpec[] {
  const charges: ChargeSpec[] = [];

  const addCharge = (status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED") => {
    const desc = pickRandom(chargeDescriptions);
    const amount = randInt(50000, 500000); // R$ 500 to R$ 5.000
    let dueDate: Date;
    switch (status) {
      case "PAID":
        dueDate = subDays(now, randInt(10, 60));
        break;
      case "OVERDUE":
        dueDate = subDays(now, randInt(10, 90));
        break;
      case "PENDING":
        dueDate = addDays(now, randInt(5, 30));
        break;
      case "CANCELED":
        dueDate = subDays(now, randInt(20, 40));
        break;
    }
    charges.push({ customerId, description: desc, amountCents: amount, dueDate, status });
  };

  switch (profile) {
    case "healthy":
      // 2 PAID, 1-2 PENDING, 0 OVERDUE
      addCharge("PAID");
      addCharge("PAID");
      addCharge("PENDING");
      if (Math.random() > 0.5) addCharge("PENDING");
      break;
    case "controlled":
      // 2 PAID, 1 PENDING, 1 OVERDUE (small)
      addCharge("PAID");
      addCharge("PAID");
      addCharge("PENDING");
      charges.push({
        customerId,
        description: pickRandom(chargeDescriptions),
        amountCents: randInt(50000, 150000), // smaller overdue
        dueDate: subDays(now, randInt(10, 25)),
        status: "OVERDUE",
      });
      break;
    case "attention":
      // 1 PAID, 1 PENDING, 2-3 OVERDUE (medium)
      addCharge("PAID");
      addCharge("PENDING");
      addCharge("OVERDUE");
      addCharge("OVERDUE");
      if (Math.random() > 0.5) addCharge("OVERDUE");
      break;
    case "critical":
      // 1 PAID, 0-1 PENDING, 3-5 OVERDUE (large)
      addCharge("PAID");
      if (Math.random() > 0.5) addCharge("PENDING");
      addCharge("OVERDUE");
      addCharge("OVERDUE");
      addCharge("OVERDUE");
      if (Math.random() > 0.4) addCharge("OVERDUE");
      if (Math.random() > 0.6) addCharge("OVERDUE");
      break;
    case "all_paid":
      // 3 PAID
      addCharge("PAID");
      addCharge("PAID");
      addCharge("PAID");
      break;
    case "zero":
      // No charges
      break;
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
      },
    }),
    prisma.user.create({
      data: {
        name: "Maria Financeiro",
        email: "financeiro@menlo.com.br",
        password: userPassword,
        role: "FINANCEIRO",
        franqueadoraId: franqueadora.id,
      },
    }),
    prisma.user.create({
      data: {
        name: "João Operacional",
        email: "operacional@menlo.com.br",
        password: userPassword,
        role: "OPERACIONAL",
        franqueadoraId: franqueadora.id,
      },
    }),
    prisma.user.create({
      data: {
        name: "Ana Visualizador",
        email: "visualizador@menlo.com.br",
        password: userPassword,
        role: "VISUALIZADOR",
        franqueadoraId: franqueadora.id,
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
          franqueadoraId: franqueadora.id,
        },
      })
    )
  );

  console.log(`✅ Created ${customers.length} customers`);

  // Create charges using profile-based generation
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
        },
      })
    )
  );

  console.log(`✅ Created ${createdCharges.length} charges`);

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

  console.log("\n📋 Test users:");
  console.log("  admin@menlo.com.br / admin123 (ADMINISTRADOR)");
  console.log("  financeiro@menlo.com.br / user123 (FINANCEIRO)");
  console.log("  operacional@menlo.com.br / user123 (OPERACIONAL)");
  console.log("  visualizador@menlo.com.br / user123 (VISUALIZADOR)");

  console.log(`\n📊 Summary: ${customers.length} customers, ${createdCharges.length} charges, ${allInteractions.length} interactions, ${allTasks.length} tasks`);
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
