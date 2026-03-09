import { prisma } from "@/lib/prisma";
import { RiskProfile } from "@prisma/client";

// ── Types ──

export interface RiskMetrics {
  defaultRate: number;
  avgDaysLate: number;
  totalOutstanding: number;
}

export interface RiskResult extends RiskMetrics {
  riskProfile: RiskProfile;
}

export interface CustomerRiskResult extends RiskResult {
  customerId: string;
}

// ── Helpers ──

function classifyMetric(
  value: number,
  lowThreshold: number,
  highThreshold: number
): RiskProfile {
  if (value < lowThreshold) return RiskProfile.BOM_PAGADOR;
  if (value <= highThreshold) return RiskProfile.DUVIDOSO;
  return RiskProfile.MAU_PAGADOR;
}

const RISK_ORDER: Record<RiskProfile, number> = {
  [RiskProfile.BOM_PAGADOR]: 0,
  [RiskProfile.DUVIDOSO]: 1,
  [RiskProfile.MAU_PAGADOR]: 2,
};

function worstProfile(profiles: RiskProfile[]): RiskProfile {
  return profiles.reduce((worst, current) =>
    RISK_ORDER[current] > RISK_ORDER[worst] ? current : worst
  );
}

// ── Public API ──

/**
 * Classify risk based on metrics. The WORST metric defines the profile.
 *
 * | Metric           | BOM_PAGADOR | DUVIDOSO       | MAU_PAGADOR |
 * |------------------|-------------|----------------|-------------|
 * | defaultRate      | < 0.1       | 0.1–0.3        | > 0.3       |
 * | avgDaysLate      | < 5         | 5–15           | > 15        |
 * | totalOutstanding | < 500000    | 500000–2000000 | > 2000000   |
 */
export function classifyRisk(metrics: RiskMetrics): RiskProfile {
  const byDefault = classifyMetric(metrics.defaultRate, 0.1, 0.3);
  const byDays = classifyMetric(metrics.avgDaysLate, 5, 15);
  const byOutstanding = classifyMetric(metrics.totalOutstanding, 500000, 2000000);

  return worstProfile([byDefault, byDays, byOutstanding]);
}

/**
 * Calculate risk metrics and profile for a single customer.
 *
 * 1. Query all charges for the customer from the last 12 months (excluding CANCELED)
 * 2. If no charges → BOM_PAGADOR with zeroed metrics
 * 3. Calculate defaultRate, avgDaysLate, totalOutstanding
 * 4. Apply classifyRisk
 */
export async function calculateRiskForCustomer(
  customerId: string
): Promise<CustomerRiskResult> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const charges = await prisma.charge.findMany({
    where: {
      customerId,
      status: { not: "CANCELED" },
      dueDate: { gte: twelveMonthsAgo },
    },
  });

  if (charges.length === 0) {
    return {
      customerId,
      defaultRate: 0,
      avgDaysLate: 0,
      totalOutstanding: 0,
      riskProfile: RiskProfile.BOM_PAGADOR,
    };
  }

  const now = new Date();

  // defaultRate = charges with atraso > 5 days OR status OVERDUE / total charges
  const defaultCount = charges.filter((c) => {
    if (c.status === "OVERDUE") return true;
    if (c.paidAt && c.dueDate) {
      const daysLate = Math.floor(
        (c.paidAt.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysLate > 5;
    }
    return false;
  }).length;

  const defaultRate = defaultCount / charges.length;

  // avgDaysLate = average of (paidAt - dueDate) in days for charges paid late (0 for on time)
  let totalDaysLate = 0;
  let lateChargeCount = 0;

  for (const c of charges) {
    if (c.paidAt && c.dueDate) {
      const daysLate = Math.floor(
        (c.paidAt.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysLate > 0) {
        totalDaysLate += daysLate;
        lateChargeCount++;
      }
    }
  }

  const avgDaysLate = lateChargeCount > 0 ? totalDaysLate / lateChargeCount : 0;

  // totalOutstanding = sum of amountCents for OVERDUE charges or PENDING charges past due date
  const totalOutstanding = charges
    .filter((c) => {
      if (c.status === "OVERDUE") return true;
      if (c.status === "PENDING" && c.dueDate < now) return true;
      return false;
    })
    .reduce((sum, c) => sum + c.amountCents, 0);

  const riskProfile = classifyRisk({ defaultRate, avgDaysLate, totalOutstanding });

  return {
    customerId,
    defaultRate,
    avgDaysLate,
    totalOutstanding,
    riskProfile,
  };
}

/**
 * Recalculate risk scores for all customers of the given franqueadora IDs.
 *
 * 1. Find all customers for the given franqueadora IDs
 * 2. For each customer, call calculateRiskForCustomer
 * 3. Upsert FranchiseeRiskScore in the database
 * 4. Return array of results
 */
export async function recalculateAllRiskScores(
  franqueadoraIds: string[]
): Promise<CustomerRiskResult[]> {
  const customers = await prisma.customer.findMany({
    where: { franqueadoraId: { in: franqueadoraIds } },
    select: { id: true },
  });

  const results: CustomerRiskResult[] = [];

  for (const customer of customers) {
    const result = await calculateRiskForCustomer(customer.id);

    await prisma.franchiseeRiskScore.upsert({
      where: { customerId: customer.id },
      create: {
        customerId: customer.id,
        defaultRate: result.defaultRate,
        avgDaysLate: result.avgDaysLate,
        totalOutstanding: result.totalOutstanding,
        riskProfile: result.riskProfile,
      },
      update: {
        defaultRate: result.defaultRate,
        avgDaysLate: result.avgDaysLate,
        totalOutstanding: result.totalOutstanding,
        riskProfile: result.riskProfile,
        calculatedAt: new Date(),
      },
    });

    results.push(result);
  }

  return results;
}
