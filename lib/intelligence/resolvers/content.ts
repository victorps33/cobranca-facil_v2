import { prisma } from "@/lib/prisma";
import { ResolverMode, OptimizeMetric, StepVariant } from "@prisma/client";
import { ResolverContext, ContentResult } from "./types";

interface ContentConfig {
  mode: ResolverMode;
  fixedTemplate: string;
  optimizeFor: OptimizeMetric;
  stepId: string;
}

function getRate(variant: StepVariant, metric: OptimizeMetric): number {
  switch (metric) {
    case "PAYMENT":
      return variant.conversionRate;
    case "RESPONSE":
      return variant.replyRate;
    case "OPEN":
      return variant.openRate;
  }
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return items[Math.floor(Math.random() * items.length)];

  let random = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

export async function resolveContent(
  config: ContentConfig,
  ctx: ResolverContext
): Promise<ContentResult> {
  if (config.mode === "MANUAL") {
    return {
      template: config.fixedTemplate,
      variantId: null,
      variantLabel: null,
      source: "manual",
    };
  }

  // SMART: select from active variants
  const variants = await prisma.stepVariant.findMany({
    where: { stepId: config.stepId, active: true },
  });

  if (variants.length === 0) {
    return {
      template: config.fixedTemplate,
      variantId: null,
      variantLabel: null,
      source: "manual",
    };
  }

  if (variants.length === 1) {
    return {
      template: variants[0].template,
      variantId: variants[0].id,
      variantLabel: variants[0].label,
      source: "variant",
    };
  }

  // Weighted random: explore new variants, exploit proven ones
  const weights = variants.map((v) => {
    if (v.sends < 100) return 1; // exploration: equal weight for new variants
    return getRate(v, config.optimizeFor) + 0.05; // 5% floor
  });

  const selected = weightedRandom(variants, weights);

  return {
    template: selected.template,
    variantId: selected.id,
    variantLabel: selected.label,
    source: "variant",
  };
}
