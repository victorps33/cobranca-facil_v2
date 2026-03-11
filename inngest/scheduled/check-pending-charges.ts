import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const checkPendingCharges = inngest.createFunction(
  {
    id: "check-pending-charges",
    retries: 3,
  },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    const overdueCharges = await step.run("find-overdue-charges", async () => {
      const now = new Date();
      return prisma.charge.findMany({
        where: {
          status: "PENDING",
          dueDate: { lt: now },
        },
        select: {
          id: true,
          customerId: true,
          dueDate: true,
          customer: { select: { franqueadoraId: true } },
        },
      });
    });

    if (overdueCharges.length === 0) {
      return { processed: 0 };
    }

    // Mark as OVERDUE
    await step.run("mark-overdue", async () => {
      await prisma.charge.updateMany({
        where: {
          id: { in: overdueCharges.map((c) => c.id) },
          status: "PENDING",
        },
        data: { status: "OVERDUE" },
      });
    });

    // Emit charge/overdue event for each (filter out charges without franqueadoraId)
    const validCharges = overdueCharges.filter((c) => c.customer.franqueadoraId != null);
    await step.sendEvent(
      "emit-overdue-events",
      validCharges.map((charge) => ({
        name: "charge/overdue" as const,
        data: {
          chargeId: charge.id,
          customerId: charge.customerId,
          daysPastDue: Math.floor(
            (Date.now() - new Date(charge.dueDate).getTime()) / (1000 * 60 * 60 * 24)
          ),
          franqueadoraId: charge.customer.franqueadoraId!,
        },
      }))
    );

    return { processed: overdueCharges.length };
  }
);
