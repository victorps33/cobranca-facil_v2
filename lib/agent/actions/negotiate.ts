import type { NegotiationConfig, NegotiationRuleTier } from "../types";
import { formatCurrency } from "@/lib/utils";

export interface NegotiateResult {
  approved: boolean;
  message: string;
  escalateReason?: string;
}

function findTier(
  amountCents: number,
  tiers: NegotiationRuleTier[]
): NegotiationRuleTier | null {
  for (const tier of tiers) {
    const aboveMin = amountCents >= tier.minCents;
    const belowMax = tier.maxCents === null || amountCents <= tier.maxCents;
    if (aboveMin && belowMax) return tier;
  }
  return null;
}

export function validateNegotiation(
  requestedInstallments: number,
  amountCents: number,
  config: NegotiationConfig
): NegotiateResult {
  const tier =
    config.tiers.length > 0
      ? findTier(amountCents, config.tiers)
      : null;

  const maxInstallments = tier?.maxInstallments ?? config.maxInstallments;
  const interestRate = tier?.interestRate ?? config.monthlyInterestRate;

  if (requestedInstallments > maxInstallments) {
    return {
      approved: false,
      message: "",
      escalateReason: `Cliente pediu ${requestedInstallments}x, maximo permitido e ${maxInstallments}x para esta faixa de valor`,
    };
  }

  let installmentCents: number;
  if (interestRate > 0 && requestedInstallments > 1) {
    const rate = interestRate;
    const n = requestedInstallments;
    const factor = (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    installmentCents = Math.ceil(amountCents * factor);
  } else {
    installmentCents = Math.ceil(amountCents / requestedInstallments);
  }

  if (installmentCents < config.minInstallmentCents) {
    return {
      approved: false,
      message: "",
      escalateReason: `Parcela de ${formatCurrency(installmentCents)} abaixo do minimo de ${formatCurrency(config.minInstallmentCents)}`,
    };
  }

  const totalWithInterest = installmentCents * requestedInstallments;

  let message: string;
  if (requestedInstallments === 1) {
    message = `Podemos fazer em 1x de ${formatCurrency(amountCents)}.`;
  } else if (interestRate > 0) {
    message = `Podemos parcelar em ${requestedInstallments}x de ${formatCurrency(installmentCents)} (total: ${formatCurrency(totalWithInterest)}, juros de ${(interestRate * 100).toFixed(1)}% a.m.).`;
  } else {
    message = `Podemos parcelar em ${requestedInstallments}x de ${formatCurrency(installmentCents)} sem juros.`;
  }

  return { approved: true, message };
}
