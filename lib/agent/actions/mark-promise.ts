import { prisma } from "@/lib/prisma";

export async function executeMarkPromise(
  customerId: string,
  franqueadoraId: string,
  promiseDate: string,
  chargeId?: string | null
): Promise<void> {
  const systemUser = await prisma.user.findFirst({
    where: { franqueadoraId, role: "ADMINISTRADOR" },
  });

  if (!systemUser) return;

  const followUpDate = new Date(promiseDate);
  followUpDate.setDate(followUpDate.getDate() + 1);

  await prisma.collectionTask.create({
    data: {
      customerId,
      chargeId: chargeId || undefined,
      title: `[PROMESSA] Verificar pagamento prometido para ${promiseDate}`,
      description: `Cliente prometeu pagar em ${promiseDate}. Verificar se pagamento foi realizado.`,
      status: "PENDENTE",
      priority: "ALTA",
      dueDate: followUpDate,
      createdById: systemUser.id,
    },
  });
}
