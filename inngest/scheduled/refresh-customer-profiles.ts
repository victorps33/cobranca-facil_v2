import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { computeCustomerProfile } from "@/lib/intelligence/stats";

export const refreshCustomerProfiles = inngest.createFunction(
  {
    id: "refresh-customer-profiles",
    name: "Intelligence: Refresh Customer Profiles",
  },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const customerIds = await step.run(
      "find-active-customers",
      async () => {
        const events = await prisma.engagementEvent.findMany({
          where: { createdAt: { gte: sixHoursAgo } },
          select: { customerId: true },
          distinct: ["customerId"],
        });
        return events.map((e) => e.customerId);
      }
    );

    const BATCH_SIZE = 100;
    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
      const batch = customerIds.slice(i, i + BATCH_SIZE);
      await step.run(`profiles-batch-${i}`, async () => {
        for (const customerId of batch) {
          await computeCustomerProfile(customerId);
        }
      });
    }

    return { customersProcessed: customerIds.length };
  }
);
