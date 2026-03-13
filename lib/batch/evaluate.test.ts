import { describe, it, expect } from "vitest";
import { findNextStep } from "./evaluate";

const steps = [
  { id: "s1", trigger: "BEFORE_DUE" as const, offsetDays: 5, channel: "EMAIL" as const, phase: "LEMBRETE" as const },
  { id: "s2", trigger: "BEFORE_DUE" as const, offsetDays: 3, channel: "SMS" as const, phase: "LEMBRETE" as const },
  { id: "s3", trigger: "BEFORE_DUE" as const, offsetDays: 1, channel: "WHATSAPP" as const, phase: "LEMBRETE" as const },
  { id: "s4", trigger: "ON_DUE" as const, offsetDays: 0, channel: "WHATSAPP" as const, phase: "VENCIMENTO" as const },
  { id: "s5", trigger: "AFTER_DUE" as const, offsetDays: 3, channel: "SMS" as const, phase: "ATRASO" as const },
  { id: "s6", trigger: "AFTER_DUE" as const, offsetDays: 7, channel: "WHATSAPP" as const, phase: "ATRASO" as const },
  { id: "s7", trigger: "AFTER_DUE" as const, offsetDays: 10, channel: "LIGACAO" as const, phase: "ATRASO" as const },
];

describe("findNextStep", () => {
  const dueDate = new Date("2026-03-20");

  it("fires BEFORE_DUE step 5 days before due date", () => {
    const runDate = new Date("2026-03-15");
    const result = findNextStep(steps, dueDate, runDate, []);
    expect(result?.id).toBe("s1");
  });

  it("fires ON_DUE step on due date", () => {
    const runDate = new Date("2026-03-20");
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3"]);
    expect(result?.id).toBe("s4");
  });

  it("fires AFTER_DUE step 3 business days after due", () => {
    const runDate = new Date("2026-03-25");
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3", "s4"]);
    expect(result?.id).toBe("s5");
  });

  it("returns null when all steps already fired", () => {
    const runDate = new Date("2026-04-15");
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    expect(result).toBeNull();
  });

  it("returns null when no step is due yet", () => {
    const runDate = new Date("2026-03-10");
    const result = findNextStep(steps, dueDate, runDate, []);
    expect(result).toBeNull();
  });

  it("skips already-fired steps and finds the next one", () => {
    const runDate = new Date("2026-03-17");
    const result = findNextStep(steps, dueDate, runDate, ["s1"]);
    expect(result?.id).toBe("s2");
  });

  it("AFTER_DUE steps do not fire for PENDING (future-due) charges", () => {
    const runDate = new Date("2026-03-18");
    const result = findNextStep(steps, dueDate, runDate, ["s1", "s2", "s3"]);
    expect(result).toBeNull();
  });
});
