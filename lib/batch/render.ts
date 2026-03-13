import type { Channel, DunningPhase } from "@prisma/client";

export interface ChargeForRender {
  description: string;
  amountCents: number;
  dueDate: Date;
  boleto?: { publicUrl: string } | null;
}

export interface CustomerForRender {
  name: string;
}

export function formatBRL(cents: number): string {
  return "R$ " + (cents / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}

export function renderConsolidatedMessage(
  channel: Channel,
  phase: DunningPhase,
  customer: CustomerForRender,
  charges: ChargeForRender[],
  stepTemplate: string,
  runDate: Date
): string {
  const totalCents = charges.reduce((sum, c) => sum + c.amountCents, 0);
  const boletoUrl = charges.find((c) => c.boleto?.publicUrl)?.boleto?.publicUrl ?? "";

  if (charges.length === 1) {
    const charge = charges[0];
    const daysLate = Math.max(
      0,
      Math.floor((new Date(runDate).getTime() - new Date(charge.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    return interpolateTemplate(stepTemplate, {
      nome: customer.name,
      valor: formatBRL(charge.amountCents),
      vencimento: formatDate(charge.dueDate),
      total: formatBRL(totalCents),
      qtd: "1",
      link_boleto: boletoUrl,
      link: boletoUrl,
      dias_atraso: String(daysLate),
      descricao: charge.description,
    });
  }

  if (channel === "SMS") {
    return renderSmsConsolidated(customer, charges, totalCents, boletoUrl);
  }

  if (channel === "EMAIL") {
    return renderEmailConsolidated(customer, charges, totalCents, boletoUrl);
  }

  return renderWhatsappConsolidated(customer, charges, totalCents, boletoUrl);
}

function renderSmsConsolidated(
  customer: CustomerForRender,
  charges: ChargeForRender[],
  totalCents: number,
  boletoUrl: string
): string {
  const earliest = charges.reduce((min, c) =>
    new Date(c.dueDate) < new Date(min.dueDate) ? c : min
  );
  return `${customer.name}, voce tem ${charges.length} faturas em aberto totalizando ${formatBRL(totalCents)}. A mais urgente vence em ${formatDate(earliest.dueDate)}. Regularize: ${boletoUrl}`.slice(0, 160);
}

function renderWhatsappConsolidated(
  customer: CustomerForRender,
  charges: ChargeForRender[],
  totalCents: number,
  boletoUrl: string
): string {
  const lines = charges.map(
    (c) => `• ${c.description} — *${formatBRL(c.amountCents)}* (venc. ${formatDate(c.dueDate)})`
  );

  return [
    `Oi ${customer.name}, você tem faturas em aberto:`,
    "",
    ...lines,
    "",
    `*Total: ${formatBRL(totalCents)}*`,
    "",
    boletoUrl ? `Boleto atualizado: ${boletoUrl}` : "",
    "",
    "Qualquer dúvida, estamos à disposição!",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderEmailConsolidated(
  customer: CustomerForRender,
  charges: ChargeForRender[],
  totalCents: number,
  boletoUrl: string
): string {
  const items = charges.map(
    (c) => `<li>${c.description} — <strong>${formatBRL(c.amountCents)}</strong> (venc. ${formatDate(c.dueDate)})</li>`
  );

  return [
    `<p>Olá ${customer.name}, você tem faturas em aberto:</p>`,
    `<ul>${items.join("")}</ul>`,
    `<p><strong>Total: ${formatBRL(totalCents)}</strong></p>`,
    boletoUrl ? `<p><a href="${boletoUrl}">Boleto atualizado</a></p>` : "",
    `<p>Qualquer dúvida, estamos à disposição!</p>`,
  ]
    .filter(Boolean)
    .join("\n");
}
