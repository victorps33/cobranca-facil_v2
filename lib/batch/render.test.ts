import { describe, it, expect } from "vitest";
import { renderConsolidatedMessage, interpolateTemplate, formatBRL } from "./render";

describe("formatBRL", () => {
  it("formats cents to BRL", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });

  it("formats zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});

describe("interpolateTemplate", () => {
  it("replaces simple variables", () => {
    const result = interpolateTemplate("Olá {{nome}}, valor {{valor}}", {
      nome: "João",
      valor: "R$ 100,00",
    });
    expect(result).toBe("Olá João, valor R$ 100,00");
  });

  it("leaves unknown variables as-is", () => {
    const result = interpolateTemplate("{{nome}} {{unknown}}", { nome: "João" });
    expect(result).toBe("João {{unknown}}");
  });
});

describe("renderConsolidatedMessage", () => {
  const customer = { name: "João Silva" };
  const runDate = new Date("2026-03-20");
  const singleCharge = [
    {
      description: "Mensalidade Mar/2026",
      amountCents: 50000,
      dueDate: new Date("2026-03-15"),
      boleto: { publicUrl: "https://boleto.example.com/1" },
    },
  ];

  it("uses step template for single charge", () => {
    const result = renderConsolidatedMessage(
      "WHATSAPP",
      "ATRASO",
      customer,
      singleCharge,
      "Oi {{nome}}, sua fatura de *{{valor}}* vence em *{{vencimento}}*. {{dias_atraso}} dias. Boleto: {{link_boleto}}",
      runDate
    );
    expect(result).toContain("João Silva");
    expect(result).toContain("R$ 500,00");
    expect(result).toContain("15/03/2026");
    expect(result).toContain("5 dias");
    expect(result).toContain("https://boleto.example.com/1");
  });

  const multipleCharges = [
    {
      description: "Mensalidade Mar/2026",
      amountCents: 50000,
      dueDate: new Date("2026-03-15"),
      boleto: { publicUrl: "https://boleto.example.com/1" },
    },
    {
      description: "Mensalidade Fev/2026",
      amountCents: 50000,
      dueDate: new Date("2026-02-15"),
      boleto: null,
    },
  ];

  it("renders consolidated message for multiple charges on WhatsApp", () => {
    const result = renderConsolidatedMessage(
      "WHATSAPP",
      "ATRASO",
      customer,
      multipleCharges,
      "ignored template",
      runDate
    );
    expect(result).toContain("João Silva");
    expect(result).toContain("Mensalidade Mar/2026");
    expect(result).toContain("Mensalidade Fev/2026");
    expect(result).toContain("R$ 1.000,00");
  });

  it("renders short SMS for multiple charges", () => {
    const result = renderConsolidatedMessage(
      "SMS",
      "ATRASO",
      customer,
      multipleCharges,
      "ignored",
      runDate
    );
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toContain("2 faturas");
    expect(result).toContain("R$ 1.000,00");
  });

  it("renders HTML email for multiple charges", () => {
    const result = renderConsolidatedMessage(
      "EMAIL",
      "ATRASO",
      customer,
      multipleCharges,
      "ignored",
      runDate
    );
    expect(result).toContain("<li>");
    expect(result).toContain("Mensalidade Mar/2026");
    expect(result).toContain("R$ 1.000,00");
  });
});
