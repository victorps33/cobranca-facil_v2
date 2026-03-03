import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Hash password inline since we can't use the lib import easily from seed context
async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("Creating Fórmula Animal group...\n");

  // Check if already exists
  const existing = await prisma.franqueadora.findFirst({
    where: { email: "remar@formulaanimal.com.br" },
  });

  if (existing) {
    console.log("Fórmula Animal already exists. Skipping.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create GrupoFranqueadora
    const grupo = await tx.grupoFranqueadora.create({
      data: { nome: "Fórmula Animal" },
    });
    console.log(`  Grupo: ${grupo.nome} (${grupo.id})`);

    // 2. Create Franqueadora: Remar
    const remar = await tx.franqueadora.create({
      data: {
        nome: "Remar",
        razaoSocial: "Remar Ltda",
        email: "remar@formulaanimal.com.br",
        grupoId: grupo.id,
      },
    });
    console.log(`  Franqueadora: ${remar.nome} (${remar.id})`);

    // 3. Create Franqueadora: Fórmula
    const formula = await tx.franqueadora.create({
      data: {
        nome: "Fórmula",
        razaoSocial: "Fórmula Ltda",
        email: "formula@formulaanimal.com.br",
        grupoId: grupo.id,
      },
    });
    console.log(`  Franqueadora: ${formula.nome} (${formula.id})`);

    // 4. Create default dunning rules
    for (const franqueadora of [remar, formula]) {
      const rule = await tx.dunningRule.create({
        data: {
          name: "Régua Padrão",
          active: true,
          timezone: "America/Sao_Paulo",
          franqueadoraId: franqueadora.id,
        },
      });

      const steps = [
        { trigger: "BEFORE_DUE" as const, offsetDays: 5, channel: "EMAIL" as const, template: "Olá, {{nome}}! Lembrete: {{descricao}} ({{valor}}) vence em {{vencimento}}. Boleto: {{link_boleto}}" },
        { trigger: "BEFORE_DUE" as const, offsetDays: 1, channel: "WHATSAPP" as const, template: "Oi, {{nome}}! {{descricao}} ({{valor}}) vence amanhã ({{vencimento}}). Boleto: {{link_boleto}}" },
        { trigger: "AFTER_DUE" as const, offsetDays: 3, channel: "SMS" as const, template: "{{nome}}, a cobrança {{descricao}} ({{valor}}) venceu em {{vencimento}}. Boleto: {{link_boleto}}" },
        { trigger: "AFTER_DUE" as const, offsetDays: 7, channel: "WHATSAPP" as const, template: "Oi, {{nome}}. {{descricao}} ({{valor}}) segue em aberto desde {{vencimento}}. 2ª via: {{link_boleto}}" },
      ];

      await Promise.all(
        steps.map((step) =>
          tx.dunningStep.create({
            data: {
              ruleId: rule.id,
              trigger: step.trigger,
              offsetDays: step.offsetDays,
              channel: step.channel,
              template: step.template,
              enabled: true,
            },
          })
        )
      );
    }
    console.log("  Dunning rules created for both");

    // 5. Create AgentConfig for both
    await tx.agentConfig.create({
      data: { franqueadoraId: remar.id, enabled: true },
    });
    await tx.agentConfig.create({
      data: { franqueadoraId: formula.id, enabled: true },
    });
    console.log("  Agent configs created for both");

    // 6. Create admin user
    const hashedPassword = await hashPassword("formula2024");
    const user = await tx.user.create({
      data: {
        name: "Admin Fórmula Animal",
        email: "admin@formulaanimal.com.br",
        password: hashedPassword,
        role: "ADMINISTRADOR",
        grupoFranqueadoraId: grupo.id,
      },
    });
    console.log(`  User: ${user.email} (${user.id})`);
  });

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
