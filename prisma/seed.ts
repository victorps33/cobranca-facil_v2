import { PrismaClient } from "@prisma/client";
import { addDays, subDays } from "date-fns";
import { createHash } from "crypto";

const prisma = new PrismaClient();

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

// Customers data
const customersData = [
  { name: "Maria Silva", doc: "123.456.789-00", email: "maria@email.com", phone: "(11) 99999-1111" },
  { name: "João Santos", doc: "234.567.890-11", email: "joao@email.com", phone: "(11) 99999-2222" },
  { name: "Ana Oliveira", doc: "345.678.901-22", email: "ana@email.com", phone: "(11) 99999-3333" },
  { name: "Pedro Costa", doc: "456.789.012-33", email: "pedro@email.com", phone: "(11) 99999-4444" },
  { name: "Lucia Ferreira", doc: "567.890.123-44", email: "lucia@email.com", phone: "(11) 99999-5555" },
  { name: "Carlos Souza", doc: "678.901.234-55", email: "carlos@email.com", phone: "(11) 99999-6666" },
  { name: "Fernanda Lima", doc: "789.012.345-66", email: "fernanda@email.com", phone: "(11) 99999-7777" },
  { name: "Ricardo Alves", doc: "890.123.456-77", email: "ricardo@email.com", phone: "(11) 99999-8888" },
  { name: "Patrícia Nunes", doc: "901.234.567-88", email: "patricia@email.com", phone: "(11) 99999-9999" },
  { name: "Tech Solutions LTDA", doc: "12.345.678/0001-99", email: "financeiro@techsolutions.com", phone: "(11) 3333-1111" },
];

// Template presets
const TEMPLATE_EMAIL_D5 = `Olá, {{nome}}! 😊
Só um lembrete de que a cobrança **{{descricao}}** no valor de **{{valor}}** vence em **{{vencimento}}**.
Boleto: {{link_boleto}}
Se já estiver tudo certo, pode ignorar esta mensagem. Obrigado!`;

const TEMPLATE_WHATSAPP_D1 = `Oi, {{nome}}! Lembrete: **{{descricao}}** ({{valor}}) vence amanhã ({{vencimento}}). Boleto: {{link_boleto}}`;

const TEMPLATE_SMS_D3 = `{{nome}}, a cobrança {{descricao}} ({{valor}}) venceu em {{vencimento}}. Para pagar: {{link_boleto}}`;

const TEMPLATE_WHATSAPP_D7 = `Oi, {{nome}}. A cobrança **{{descricao}}** ({{valor}}) segue em aberto desde **{{vencimento}}**. 2ª via: {{link_boleto}}. Se precisar negociar, me avise.`;

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data
  await prisma.notificationLog.deleteMany();
  await prisma.dunningStep.deleteMany();
  await prisma.dunningRule.deleteMany();
  await prisma.boleto.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.appState.deleteMany();

  console.log("🧹 Cleared existing data");

  // Create AppState
  await prisma.appState.create({
    data: { id: 1, simulatedNow: null },
  });

  // Create customers
  const customers = await Promise.all(
    customersData.map((data) =>
      prisma.customer.create({ data })
    )
  );

  console.log(`✅ Created ${customers.length} customers`);

  // Create charges
  const now = new Date();
  const chargeDescriptions = [
    "Mensalidade Janeiro",
    "Mensalidade Fevereiro",
    "Mensalidade Março",
    "Serviços de Consultoria",
    "Licença de Software",
    "Manutenção Mensal",
    "Suporte Técnico",
    "Hospedagem de Site",
    "Serviços de Marketing",
    "Assessoria Contábil",
  ];

  const charges: Array<{
    id: string;
    customerId: string;
    description: string;
    amountCents: number;
    dueDate: Date;
    status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  }> = [];

  // Future charges (PENDING)
  for (let i = 0; i < 8; i++) {
    const customer = customers[i % customers.length];
    const dueDate = addDays(now, 5 + i * 3);
    charges.push({
      id: `charge-future-${i}`,
      customerId: customer.id,
      description: chargeDescriptions[i % chargeDescriptions.length],
      amountCents: (100 + i * 50) * 100,
      dueDate,
      status: "PENDING",
    });
  }

  // Past charges (OVERDUE)
  for (let i = 0; i < 6; i++) {
    const customer = customers[(i + 3) % customers.length];
    const dueDate = subDays(now, 3 + i * 2);
    charges.push({
      id: `charge-overdue-${i}`,
      customerId: customer.id,
      description: `${chargeDescriptions[(i + 2) % chargeDescriptions.length]} (Atrasado)`,
      amountCents: (150 + i * 30) * 100,
      dueDate,
      status: "OVERDUE",
    });
  }

  // Paid charges
  for (let i = 0; i < 8; i++) {
    const customer = customers[(i + 5) % customers.length];
    const dueDate = subDays(now, 10 + i * 5);
    charges.push({
      id: `charge-paid-${i}`,
      customerId: customer.id,
      description: `${chargeDescriptions[(i + 4) % chargeDescriptions.length]} (Pago)`,
      amountCents: (200 + i * 25) * 100,
      dueDate,
      status: "PAID",
    });
  }

  // Canceled charges
  for (let i = 0; i < 3; i++) {
    const customer = customers[(i + 7) % customers.length];
    const dueDate = subDays(now, 20 + i * 3);
    charges.push({
      id: `charge-canceled-${i}`,
      customerId: customer.id,
      description: `${chargeDescriptions[(i + 6) % chargeDescriptions.length]} (Cancelado)`,
      amountCents: (80 + i * 40) * 100,
      dueDate,
      status: "CANCELED",
    });
  }

  // Create all charges
  const createdCharges = await Promise.all(
    charges.map((data) =>
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

  // Generate boletos for ~60% of charges (skip canceled)
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
          publicUrl: "", // Will update after creation
        },
      });
    })
  );

  // Update publicUrls
  await Promise.all(
    boletos.map((boleto) =>
      prisma.boleto.update({
        where: { id: boleto.id },
        data: { publicUrl: `/boleto/${boleto.id}` },
      })
    )
  );

  console.log(`✅ Created ${boletos.length} boletos`);

  // Create dunning rule
  const dunningRule = await prisma.dunningRule.create({
    data: {
      name: "Régua Padrão",
      active: true,
      timezone: "America/Sao_Paulo",
    },
  });

  // Create dunning steps
  const steps = [
    {
      ruleId: dunningRule.id,
      trigger: "BEFORE_DUE" as const,
      offsetDays: 5,
      channel: "EMAIL" as const,
      template: TEMPLATE_EMAIL_D5,
      enabled: true,
    },
    {
      ruleId: dunningRule.id,
      trigger: "BEFORE_DUE" as const,
      offsetDays: 1,
      channel: "WHATSAPP" as const,
      template: TEMPLATE_WHATSAPP_D1,
      enabled: true,
    },
    {
      ruleId: dunningRule.id,
      trigger: "AFTER_DUE" as const,
      offsetDays: 3,
      channel: "SMS" as const,
      template: TEMPLATE_SMS_D3,
      enabled: true,
    },
    {
      ruleId: dunningRule.id,
      trigger: "AFTER_DUE" as const,
      offsetDays: 7,
      channel: "WHATSAPP" as const,
      template: TEMPLATE_WHATSAPP_D7,
      enabled: true,
    },
  ];

  await Promise.all(
    steps.map((step) => prisma.dunningStep.create({ data: step }))
  );

  console.log(`✅ Created dunning rule with ${steps.length} steps`);

  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
