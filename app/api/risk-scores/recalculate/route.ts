import { NextResponse } from "next/server";
import { requireTenantOrGroup, requireRole } from "@/lib/auth-helpers";
import { recalculateAllRiskScores } from "@/lib/risk-score";

export async function POST() {
  const roleCheck = await requireRole(["ADMINISTRADOR"]);
  if (roleCheck.error) return roleCheck.error;

  const { tenantIds, error } = await requireTenantOrGroup();
  if (error) return error;

  const results = await recalculateAllRiskScores(tenantIds);

  return NextResponse.json({
    recalculated: results.length,
    results,
  });
}
