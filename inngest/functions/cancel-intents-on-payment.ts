import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

export const cancelIntentsOnPayment = inngest.createFunction(
  { id: "cancel-intents-on-payment", retries: 3 },
  [{ event: "charge/paid" }, { event: "charge/canceled" }],
  async ({ event, step }) => {
    const { chargeId } = event.data;

    return await step.run("cancel-intents", async () => {
      // 1. Find pending intents for this charge
      const intents = await prisma.communicationIntent.findMany({
        where: { chargeId, status: { in: ["PENDING", "GROUPED"] } },
        select: { id: true, messageGroupId: true },
      });

      if (intents.length === 0) return { cancelled: 0 };

      // 2. Mark as SKIPPED
      await prisma.communicationIntent.updateMany({
        where: { id: { in: intents.map((i) => i.id) } },
        data: { status: "SKIPPED" },
      });

      // 3. Check if any MessageGroups are now fully skipped
      const groupIds = Array.from(new Set(intents.map((i) => i.messageGroupId).filter(Boolean))) as string[];
      let groupsSkipped = 0;

      for (const groupId of groupIds) {
        const remaining = await prisma.communicationIntent.count({
          where: { messageGroupId: groupId, status: { notIn: ["SKIPPED"] } },
        });
        if (remaining === 0) {
          await prisma.messageGroup.update({
            where: { id: groupId },
            data: { status: "SKIPPED" },
          });
          groupsSkipped++;
        }
      }

      return { cancelled: intents.length, groupsSkipped };
    });
  }
);
