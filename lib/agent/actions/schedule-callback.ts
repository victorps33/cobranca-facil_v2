import { prisma } from "@/lib/prisma";

export async function executeScheduleCallback(
  customerId: string,
  franqueadoraId: string,
  callbackDate: string
): Promise<string> {
  const systemUser = await prisma.user.findFirst({
    where: { franqueadoraId, role: "ADMINISTRADOR" },
  });

  if (!systemUser) {
    return "Nao foi possivel agendar o callback — entre em contato novamente.";
  }

  let scheduledDate = new Date(callbackDate);

  const hour = scheduledDate.getHours();
  if (hour < 8) {
    scheduledDate.setHours(9, 0, 0, 0);
  } else if (hour >= 20) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    scheduledDate.setHours(9, 0, 0, 0);
  }

  const day = scheduledDate.getDay();
  if (day === 0) scheduledDate.setDate(scheduledDate.getDate() + 1);
  if (day === 6) scheduledDate.setDate(scheduledDate.getDate() + 2);

  await prisma.collectionTask.create({
    data: {
      customerId,
      title: `[CALLBACK] Cliente solicitou retorno`,
      description: `Cliente pediu que um atendente ligue de volta.\nAgendado para: ${scheduledDate.toISOString()}`,
      status: "PENDENTE",
      priority: "ALTA",
      dueDate: scheduledDate,
      createdById: systemUser.id,
    },
  });

  const formatted = scheduledDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return formatted;
}
