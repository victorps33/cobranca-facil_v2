import { describe, it, expect } from "vitest";
import { computeFireDate } from "./fire-date";

describe("computeFireDate", () => {
  const dueDate = new Date("2026-03-20");

  describe("BEFORE_DUE", () => {
    it("subtracts 5 business days", () => {
      const result = computeFireDate("BEFORE_DUE", 5, dueDate);
      expect(result).toEqual(new Date("2026-03-13"));
    });

    it("skips weekends when subtracting", () => {
      const monday = new Date("2026-03-16");
      const result = computeFireDate("BEFORE_DUE", 1, monday);
      expect(result).toEqual(new Date("2026-03-13"));
    });

    it("handles offsetDays 0", () => {
      const result = computeFireDate("BEFORE_DUE", 0, dueDate);
      expect(result).toEqual(dueDate);
    });
  });

  describe("ON_DUE", () => {
    it("returns dueDate regardless of offsetDays", () => {
      const result = computeFireDate("ON_DUE", 0, dueDate);
      expect(result).toEqual(dueDate);
    });
  });

  describe("AFTER_DUE", () => {
    it("adds 7 business days", () => {
      const result = computeFireDate("AFTER_DUE", 7, dueDate);
      expect(result).toEqual(new Date("2026-03-31"));
    });

    it("adds 3 business days from a Thursday", () => {
      const thursday = new Date("2026-03-19");
      const result = computeFireDate("AFTER_DUE", 3, thursday);
      expect(result).toEqual(new Date("2026-03-24"));
    });

    it("handles offsetDays 0", () => {
      const result = computeFireDate("AFTER_DUE", 0, dueDate);
      expect(result).toEqual(dueDate);
    });
  });
});
