import { describe, it, expect } from "vitest";
import { groupIntentsByRecipient, resolveRecipient, maxPhase } from "./group";

describe("resolveRecipient", () => {
  const customer = { email: "joao@example.com", phone: "11999990000", whatsappPhone: "11888880000" };

  it("resolves EMAIL to email", () => {
    expect(resolveRecipient("EMAIL", customer)).toBe("joao@example.com");
  });

  it("resolves WHATSAPP to whatsappPhone", () => {
    expect(resolveRecipient("WHATSAPP", customer)).toBe("11888880000");
  });

  it("falls back to phone if whatsappPhone is null", () => {
    expect(resolveRecipient("WHATSAPP", { ...customer, whatsappPhone: null })).toBe("11999990000");
  });

  it("resolves SMS to phone", () => {
    expect(resolveRecipient("SMS", customer)).toBe("11999990000");
  });

  it("returns null for empty contact", () => {
    expect(resolveRecipient("EMAIL", { email: "", phone: "", whatsappPhone: null })).toBeNull();
  });
});

describe("maxPhase", () => {
  it("returns the most severe phase", () => {
    expect(maxPhase(["LEMBRETE", "ATRASO", "VENCIMENTO"])).toBe("ATRASO");
  });

  it("handles single phase", () => {
    expect(maxPhase(["LEMBRETE"])).toBe("LEMBRETE");
  });

  it("POS_PROTESTO is the highest", () => {
    expect(maxPhase(["LEMBRETE", "POS_PROTESTO", "ATRASO"])).toBe("POS_PROTESTO");
  });
});

describe("groupIntentsByRecipient", () => {
  it("groups intents by customerId and channel", () => {
    const intents = [
      { customerId: "c1", channel: "EMAIL" as const, phase: "ATRASO" as const },
      { customerId: "c1", channel: "EMAIL" as const, phase: "LEMBRETE" as const },
      { customerId: "c1", channel: "WHATSAPP" as const, phase: "ATRASO" as const },
      { customerId: "c2", channel: "EMAIL" as const, phase: "VENCIMENTO" as const },
    ];
    const groups = groupIntentsByRecipient(intents);

    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.customerId === "c1" && g.channel === "EMAIL")?.intents).toHaveLength(2);
  });
});
