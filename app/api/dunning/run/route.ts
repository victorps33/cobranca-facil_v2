import { NextResponse } from "next/server";

// POST /api/dunning/run — Executar régua de cobrança
export async function POST() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    // Busca a data atual (simulada ou real)
    const appState = await prisma.appState.findFirst({ where: { id: 1 } });
    const now = appState?.simulatedNow || new Date();

    // Busca steps habilitados
    const steps = await prisma.dunningStep.findMany({
      where: { enabled: true },
      include: { rule: { select: { active: true } } },
    });

    const activeSteps = steps.filter((s) => s.rule.active);

    // Busca cobranças pendentes ou vencidas
    const charges = await prisma.charge.findMany({
      where: { status: { in: ["PENDING", "OVERDUE"] } },
      include: { customer: true },
    });

    let notificationsCreated = 0;

    for (const charge of charges) {
      const dueDate = new Date(charge.dueDate);
      const diffDays = Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Marca como OVERDUE se vencida
      if (diffDays > 0 && charge.status === "PENDING") {
        await prisma.charge.update({
          where: { id: charge.id },
          data: { status: "OVERDUE" },
        });
      }

      for (const step of activeSteps) {
        let shouldTrigger = false;
        if (step.trigger === "BEFORE_DUE" && diffDays === -step.offsetDays) shouldTrigger = true;
        if (step.trigger === "ON_DUE" && diffDays === 0) shouldTrigger = true;
        if (step.trigger === "AFTER_DUE" && diffDays === step.offsetDays) shouldTrigger = true;

        if (shouldTrigger) {
          // Verifica se já existe log para esta combinação
          const existing = await prisma.notificationLog.findFirst({
            where: { chargeId: charge.id, stepId: step.id },
          });

          if (!existing) {
            const rendered = step.template
              .replace("{{nome}}", charge.customer.name)
              .replace("{{valor}}", `R$ ${(charge.amountCents / 100).toFixed(2)}`)
              .replace("{{vencimento}}", dueDate.toLocaleDateString("pt-BR"))
              .replace("{{descricao}}", charge.description);

            await prisma.notificationLog.create({
              data: {
                chargeId: charge.id,
                stepId: step.id,
                channel: step.channel,
                status: "SENT",
                scheduledFor: now,
                sentAt: now,
                renderedMessage: rendered,
                metaJson: JSON.stringify({ trigger: step.trigger, offsetDays: step.offsetDays }),
              },
            });
            notificationsCreated++;
          }
        }
      }
    }

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      notificationsCreated,
      processedCharges: charges.length,
    });
  } catch (error) {
    return NextResponse.json({ error: "Falha ao executar régua" }, { status: 500 });
  }
}
