import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export async function GET() {
  const { session, tenantId, error } = await requireTenant();
  if (error) return error;

  const userId = session!.user.id;

  const [user, customerCount, chargeCount, dunningRuleCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true, checklistDismissedAt: true },
    }),
    prisma.customer.count({ where: { franqueadoraId: tenantId! } }),
    prisma.charge.count({
      where: { customer: { franqueadoraId: tenantId! } },
    }),
    prisma.dunningRule.count({ where: { franqueadoraId: tenantId! } }),
  ]);

  const showWizard = !user?.onboardingCompletedAt;
  const checklist = {
    hasCustomer: customerCount > 0,
    hasCharge: chargeCount > 0,
    hasDunningRule: dunningRuleCount > 0,
    hasVisitedInsights: false, // tracked via localStorage on client
  };

  const allComplete = checklist.hasCustomer && checklist.hasCharge && checklist.hasDunningRule;
  const showChecklist = !showWizard && !user?.checklistDismissedAt && !allComplete;

  return NextResponse.json({
    showWizard,
    showChecklist,
    checklist,
  });
}
