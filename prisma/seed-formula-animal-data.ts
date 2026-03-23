import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GRUPO_ID = "cmmajhwvi0001y2v7d95gaplj"; // Fórmula Animal

// ── Fórmula franquia data ──
const formulaCustomers = [
  { franquia: "Franquia 01", nome: "Ana" },
  { franquia: "Franquia 02", nome: "Bianca" },
  { franquia: "Franquia 03", nome: "Carol" },
  { franquia: "Franquia 04", nome: "Elisabete" },
  { franquia: "Franquia 05", nome: "Eloisa" },
  { franquia: "Franquia 06", nome: "Jayne" },
  { franquia: "Franquia 07", nome: "Jéssica" },
  { franquia: "Franquia 08", nome: "João" },
  { franquia: "Franquia 09", nome: "Katia" },
  { franquia: "Franquia 10", nome: "Luciana" },
  { franquia: "Franquia 11", nome: "Milena" },
  { franquia: "Franquia 12", nome: "Thiago" },
];

const formulaCharges = [
  { franquia: "Franquia 01", vencimento: "2026-02-07", valor: 350.17, tipo: "Compras Fórmula" },
  { franquia: "Franquia 02", vencimento: "2026-02-09", valor: 1841.38, tipo: "Compras Fórmula" },
  { franquia: "Franquia 02", vencimento: "2024-02-15", valor: 3168.00, tipo: "Compras Fórmula" },
  { franquia: "Franquia 02", vencimento: "2024-01-05", valor: 963.00, tipo: "Compras Fórmula" },
  { franquia: "Franquia 02", vencimento: "2024-01-08", valor: 133.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 02", vencimento: "2024-01-13", valor: 107.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 02", vencimento: "2024-01-13", valor: 860.97, tipo: "Compras Fórmula" },
  { franquia: "Franquia 02", vencimento: "2024-03-15", valor: 3168.00, tipo: "Compras Fórmula" },
  { franquia: "Franquia 03", vencimento: "2024-03-31", valor: 12039.94, tipo: "Compras Fórmula" },
  { franquia: "Franquia 03", vencimento: "2024-04-01", valor: 21146.97, tipo: "Compras Fórmula" },
  { franquia: "Franquia 04", vencimento: "2025-01-20", valor: 1159.45, tipo: "Compras Fórmula" },
  { franquia: "Franquia 04", vencimento: "2025-10-25", valor: 1456.63, tipo: "Compras Fórmula" },
  { franquia: "Franquia 05", vencimento: "2025-01-17", valor: 1220.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 05", vencimento: "2025-01-19", valor: 370.60, tipo: "Compras Fórmula" },
  { franquia: "Franquia 05", vencimento: "2025-01-21", valor: 584.57, tipo: "Compras Fórmula" },
  { franquia: "Franquia 05", vencimento: "2025-01-23", valor: 277.30, tipo: "Compras Fórmula" },
  { franquia: "Franquia 05", vencimento: "2025-06-23", valor: 989.17, tipo: "Compras Fórmula" },
  { franquia: "Franquia 05", vencimento: "2025-07-08", valor: 5598.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 06", vencimento: "2025-11-18", valor: 3215.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 06", vencimento: "2025-12-18", valor: 418.94, tipo: "Compras Fórmula" },
  { franquia: "Franquia 06", vencimento: "2025-12-30", valor: 1847.41, tipo: "Compras Fórmula" },
  { franquia: "Franquia 07", vencimento: "2024-03-01", valor: 888.00, tipo: "Compras Fórmula" },
  { franquia: "Franquia 07", vencimento: "2024-03-12", valor: 296.25, tipo: "Compras Fórmula" },
  { franquia: "Franquia 07", vencimento: "2024-03-13", valor: 509.75, tipo: "Compras Fórmula" },
  { franquia: "Franquia 07", vencimento: "2024-03-15", valor: 446.79, tipo: "Compras Fórmula" },
  { franquia: "Franquia 07", vencimento: "2025-12-06", valor: 367.21, tipo: "Compras Fórmula" },
  { franquia: "Franquia 07", vencimento: "2025-12-07", valor: 500.38, tipo: "Compras Fórmula" },
  { franquia: "Franquia 08", vencimento: "2026-02-03", valor: 4198.39, tipo: "Compras Fórmula" },
  { franquia: "Franquia 08", vencimento: "2026-02-10", valor: 3802.60, tipo: "Compras Fórmula" },
  { franquia: "Franquia 08", vencimento: "2026-02-05", valor: 9658.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 08", vencimento: "2025-11-18", valor: 426.18, tipo: "Compras Fórmula" },
  { franquia: "Franquia 08", vencimento: "2025-12-18", valor: 5500.95, tipo: "Compras Fórmula" },
  { franquia: "Franquia 08", vencimento: "2025-12-30", valor: 841.57, tipo: "Compras Fórmula" },
  { franquia: "Franquia 09", vencimento: "2025-12-30", valor: 3250.00, tipo: "Compras Fórmula" },
  { franquia: "Franquia 09", vencimento: "2023-09-11", valor: 339.53, tipo: "Compras Fórmula" },
  { franquia: "Franquia 09", vencimento: "2026-01-31", valor: 365.51, tipo: "Compras Fórmula" },
  { franquia: "Franquia 09", vencimento: "2026-02-01", valor: 500.75, tipo: "Compras Fórmula" },
  { franquia: "Franquia 09", vencimento: "2026-02-03", valor: 489.84, tipo: "Compras Fórmula" },
  { franquia: "Franquia 10", vencimento: "2026-02-07", valor: 150.87, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-01-15", valor: 288.42, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-04-10", valor: 260.75, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-04-11", valor: 114.00, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-04-20", valor: 388.85, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-04-24", valor: 268.75, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-04-24", valor: 258.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2024-06-15", valor: 370.33, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-01-30", valor: 288.42, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2025-02-15", valor: 258.50, tipo: "Compras Fórmula" },
  { franquia: "Franquia 11", vencimento: "2024-07-15", valor: 370.33, tipo: "Compras Fórmula" },
  { franquia: "Franquia 12", vencimento: "2025-12-30", valor: 1500.00, tipo: "Compras Fórmula" },
];

// ── Remar franquia data ──
const remarCustomers = [
  { franquia: "Franquia 01", nome: "Alessandro" },
  { franquia: "Franquia 02", nome: "Carla" },
  { franquia: "Franquia 03", nome: "Deise" },
  { franquia: "Franquia 03b", nome: "Diego" }, // same franquia, different person
  { franquia: "Franquia 04", nome: "Gabriel" },
  { franquia: "Franquia 05", nome: "Juliana" },
  { franquia: "Franquia 06", nome: "Julio" },
  { franquia: "Franquia 07", nome: "Keyla" },
  { franquia: "Franquia 08", nome: "Leticia" },
  { franquia: "Franquia 09", nome: "Luana" },
  { franquia: "Franquia 10", nome: "Maria" },
  { franquia: "Franquia 11", nome: "Mariano" },
  { franquia: "Franquia 12", nome: "Sabrina" },
];

const remarCharges = [
  { franquia: "Franquia 01", nome: "Alessandro", vencimento: "2025-05-09", valor: 1412, tipo: "Royalties" },
  { franquia: "Franquia 01", nome: "Alessandro", vencimento: "2025-05-13", valor: 1412, tipo: "Marketing" },
  { franquia: "Franquia 02", nome: "Carla", vencimento: "2025-04-13", valor: 7814.22, tipo: "Marketing" },
  { franquia: "Franquia 02", nome: "Carla", vencimento: "2025-04-25", valor: 1518, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 03", nome: "Deise", vencimento: "2025-10-10", valor: 855.66, tipo: "Royalties" },
  { franquia: "Franquia 03", nome: "Diego", vencimento: "2025-06-05", valor: 1412, tipo: "Royalties" },
  { franquia: "Franquia 03", nome: "Diego", vencimento: "2025-06-25", valor: 7766.54, tipo: "Royalties" },
  { franquia: "Franquia 04", nome: "Gabriel", vencimento: "2024-03-10", valor: 555.75, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 04", nome: "Gabriel", vencimento: "2025-12-10", valor: 3009.47, tipo: "Royalties" },
  { franquia: "Franquia 04", nome: "Gabriel", vencimento: "2026-01-25", valor: 2710.45, tipo: "Royalties" },
  { franquia: "Franquia 04", nome: "Gabriel", vencimento: "2026-02-10", valor: 941.34, tipo: "Marketing" },
  { franquia: "Franquia 05", nome: "Juliana", vencimento: "2023-12-25", valor: 9667.31, tipo: "Marketing" },
  { franquia: "Franquia 05", nome: "Juliana", vencimento: "2024-04-01", valor: 659, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 05", nome: "Juliana", vencimento: "2024-05-10", valor: 1518, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 05", nome: "Juliana", vencimento: "2024-06-05", valor: 658.1, tipo: "Royalties" },
  { franquia: "Franquia 05", nome: "Juliana", vencimento: "2025-04-10", valor: 466.82, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 06", nome: "Julio", vencimento: "2024-02-02", valor: 3660, tipo: "Royalties" },
  { franquia: "Franquia 06", nome: "Julio", vencimento: "2024-02-16", valor: 1621, tipo: "Royalties" },
  { franquia: "Franquia 06", nome: "Julio", vencimento: "2024-03-29", valor: 2910.7, tipo: "Royalties" },
  { franquia: "Franquia 06", nome: "Julio", vencimento: "2024-05-10", valor: 1250, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 06", nome: "Julio", vencimento: "2024-07-10", valor: 1060.93, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 06", nome: "Julio", vencimento: "2026-01-19", valor: 1003.16, tipo: "Marketing" },
  { franquia: "Franquia 07", nome: "Keyla", vencimento: "2025-02-26", valor: 1621, tipo: "Marketing" },
  { franquia: "Franquia 08", nome: "Leticia", vencimento: "2024-03-14", valor: 875.98, tipo: "Royalties" },
  { franquia: "Franquia 08", nome: "Leticia", vencimento: "2024-03-25", valor: 4927.2, tipo: "Royalties" },
  { franquia: "Franquia 08", nome: "Leticia", vencimento: "2024-06-25", valor: 1518, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 09", nome: "Luana", vencimento: "2024-01-25", valor: 300, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 09", nome: "Luana", vencimento: "2024-04-10", valor: 5285.88, tipo: "Royalties" },
  { franquia: "Franquia 09", nome: "Luana", vencimento: "2024-07-22", valor: 1518, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 09", nome: "Luana", vencimento: "2025-05-09", valor: 7423.37, tipo: "Royalties" },
  { franquia: "Franquia 09", nome: "Luana", vencimento: "2025-06-30", valor: 1518, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2023-11-25", valor: 10869.91, tipo: "Royalties" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2024-01-10", valor: 1518, tipo: "Royalties" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2024-02-25", valor: 1220, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2024-02-27", valor: 10046.13, tipo: "Royalties" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2024-05-21", valor: 11891.57, tipo: "Royalties" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2024-06-10", valor: 265.76, tipo: "Marketing" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2024-07-16", valor: 1450, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2025-04-10", valor: 1621, tipo: "Royalties" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2025-05-07", valor: 7661.31, tipo: "Royalties" },
  { franquia: "Franquia 10", nome: "Maria", vencimento: "2025-06-10", valor: 780, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 11", nome: "Mariano", vencimento: "2023-12-12", valor: 1518, tipo: "Marketing" },
  { franquia: "Franquia 11", nome: "Mariano", vencimento: "2024-03-10", valor: 5942.64, tipo: "Marketing" },
  { franquia: "Franquia 11", nome: "Mariano", vencimento: "2024-04-30", valor: 5250.48, tipo: "Marketing" },
  { franquia: "Franquia 11", nome: "Mariano", vencimento: "2024-05-31", valor: 555, tipo: "Marketing" },
  { franquia: "Franquia 12", nome: "Sabrina", vencimento: "2024-04-15", valor: 1122.88, tipo: "Marketing" },
  { franquia: "Franquia 12", nome: "Sabrina", vencimento: "2024-04-29", valor: 1322.59, tipo: "Royalties" },
  { franquia: "Franquia 12", nome: "Sabrina", vencimento: "2024-05-29", valor: 1518, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 12", nome: "Sabrina", vencimento: "2024-06-10", valor: 1412, tipo: "Taxa de Publicidade" },
  { franquia: "Franquia 12", nome: "Sabrina", vencimento: "2024-06-29", valor: 565.22, tipo: "Marketing" },
];

async function main() {
  console.log("Populating Fórmula Animal with spreadsheet data...\n");

  // 1. Clean up existing data for both emails
  const emails = ["formula@formulaanimal.com.br", "remar@formulaanimal.com.br"];
  const existing = await prisma.franqueadora.findMany({ where: { email: { in: emails } } });
  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing franqueadoras. Cleaning up...`);
    for (const f of existing) {
      await prisma.charge.deleteMany({ where: { customer: { franqueadoraId: f.id } } });
      await prisma.customer.deleteMany({ where: { franqueadoraId: f.id } });
      await prisma.dunningStep.deleteMany({ where: { rule: { franqueadoraId: f.id } } });
      await prisma.dunningRule.deleteMany({ where: { franqueadoraId: f.id } });
      await prisma.agentConfig.deleteMany({ where: { franqueadoraId: f.id } });
    }
    await prisma.franqueadora.deleteMany({ where: { email: { in: emails } } });
    console.log("Cleaned up.\n");
  }

  // 2. Create Franqueadora: Fórmula
  const formula = await prisma.franqueadora.create({
    data: {
      nome: "Fórmula",
      razaoSocial: "Fórmula Ltda",
      email: "formula@formulaanimal.com.br",
      grupoId: GRUPO_ID,
    },
  });
  console.log(`  Franqueadora: ${formula.nome} (${formula.id})`);

  // 3. Create Franqueadora: Remar
  const remar = await prisma.franqueadora.create({
    data: {
      nome: "Remar",
      razaoSocial: "Remar Ltda",
      email: "remar@formulaanimal.com.br",
      grupoId: GRUPO_ID,
    },
  });
  console.log(`  Franqueadora: ${remar.nome} (${remar.id})`);

  // 4. Create dunning rules for both
  for (const franqueadora of [formula, remar]) {
    const rule = await prisma.dunningRule.create({
      data: {
        name: "Régua Padrão",
        active: true,
        timezone: "America/Sao_Paulo",
        franqueadoraId: franqueadora.id,
      },
    });
    await prisma.dunningStep.createMany({
      data: [
        { ruleId: rule.id, trigger: "BEFORE_DUE", offsetDays: 5, channel: "EMAIL", template: "Olá, {{nome}}! Lembrete: {{descricao}} ({{valor}}) vence em {{vencimento}}. Boleto: {{link_boleto}}", enabled: true },
        { ruleId: rule.id, trigger: "BEFORE_DUE", offsetDays: 1, channel: "WHATSAPP", template: "Oi, {{nome}}! {{descricao}} ({{valor}}) vence amanhã ({{vencimento}}). Boleto: {{link_boleto}}", enabled: true },
        { ruleId: rule.id, trigger: "AFTER_DUE", offsetDays: 3, channel: "SMS", template: "{{nome}}, a cobrança {{descricao}} ({{valor}}) venceu em {{vencimento}}. Boleto: {{link_boleto}}", enabled: true },
        { ruleId: rule.id, trigger: "AFTER_DUE", offsetDays: 7, channel: "WHATSAPP", template: "Oi, {{nome}}. {{descricao}} ({{valor}}) segue em aberto desde {{vencimento}}. 2ª via: {{link_boleto}}", enabled: true },
      ],
    });
  }
  console.log("  Dunning rules created for both");

  // 5. Create agent configs
  await prisma.agentConfig.create({ data: { franqueadoraId: formula.id, enabled: true } });
  await prisma.agentConfig.create({ data: { franqueadoraId: remar.id, enabled: true } });
  console.log("  Agent configs created for both");

  // 6. Create Fórmula customers and charges
  console.log("\n  --- Fórmula ---");
  const formulaCustomerMap = new Map<string, string>();
  for (const c of formulaCustomers) {
    const customer = await prisma.customer.create({
      data: {
        name: `${c.franquia} - ${c.nome}`,
        doc: `00.000.000/0001-${c.franquia.replace("Franquia ", "").padStart(2, "0")}`,
        email: `${c.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@formula.com.br`,
        phone: `(11) 99999-${String(formulaCustomers.indexOf(c) + 1).padStart(4, "0")}`,
        responsavel: c.nome,
        franqueadoraId: formula.id,
        statusLoja: "Aberta",
      },
    });
    formulaCustomerMap.set(c.franquia, customer.id);
    console.log(`    Customer: ${customer.name}`);
  }

  const now = new Date();
  const formulaChargeData = formulaCharges
    .filter((ch) => formulaCustomerMap.has(ch.franquia))
    .map((ch) => {
      const dueDate = new Date(ch.vencimento + "T12:00:00Z");
      return {
        customerId: formulaCustomerMap.get(ch.franquia)!,
        description: ch.tipo,
        amountCents: Math.round(ch.valor * 100),
        dueDate,
        status: dueDate < now ? ("OVERDUE" as const) : ("PENDING" as const),
        categoria: ch.tipo,
        formaPagamento: "Boleto",
      };
    });
  await prisma.charge.createMany({ data: formulaChargeData });
  console.log(`    ${formulaChargeData.length} charges created`);

  // 7. Create Remar customers and charges
  console.log("\n  --- Remar ---");
  const remarCustomerMap = new Map<string, string>();
  for (const c of remarCustomers) {
    const customer = await prisma.customer.create({
      data: {
        name: `${c.franquia.replace("b", "")} - ${c.nome}`,
        doc: `11.111.111/0001-${String(remarCustomers.indexOf(c) + 1).padStart(2, "0")}`,
        email: `${c.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@remar.com.br`,
        phone: `(11) 98888-${String(remarCustomers.indexOf(c) + 1).padStart(4, "0")}`,
        responsavel: c.nome,
        franqueadoraId: remar.id,
        statusLoja: "Aberta",
      },
    });
    remarCustomerMap.set(c.nome, customer.id);
    console.log(`    Customer: ${customer.name}`);
  }

  const remarChargeData = remarCharges
    .filter((ch) => remarCustomerMap.has(ch.nome))
    .map((ch) => {
      const dueDate = new Date(ch.vencimento + "T12:00:00Z");
      return {
        customerId: remarCustomerMap.get(ch.nome)!,
        description: ch.tipo,
        amountCents: Math.round(ch.valor * 100),
        dueDate,
        status: dueDate < now ? ("OVERDUE" as const) : ("PENDING" as const),
        categoria: ch.tipo,
        formaPagamento: "Boleto",
      };
    });
  await prisma.charge.createMany({ data: remarChargeData });
  console.log(`    ${remarChargeData.length} charges created`);

  console.log("\n✓ Done! Login with: admin@formulaanimal.com.br / formula2024");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
