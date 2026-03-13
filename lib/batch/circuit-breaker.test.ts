import { describe, it, expect } from "vitest";
import { shouldHalt } from "./circuit-breaker";

describe("shouldHalt", () => {
  it("returns false when no failures", () => {
    expect(shouldHalt({ total: 10, failed: 0 })).toBe(false);
  });

  it("returns false when failure rate is below 20%", () => {
    expect(shouldHalt({ total: 10, failed: 1 })).toBe(false);
  });

  it("returns true when failure rate exceeds 20%", () => {
    expect(shouldHalt({ total: 10, failed: 3 })).toBe(true);
  });

  it("returns false when total is 0", () => {
    expect(shouldHalt({ total: 0, failed: 0 })).toBe(false);
  });

  it("returns false at exactly 20%", () => {
    expect(shouldHalt({ total: 5, failed: 1 })).toBe(false);
  });
});
