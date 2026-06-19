import { describe, it, expect } from "vitest";
import { periodStartEnd, periodLabel, previousPeriod } from "@/lib/periods";

describe("periodStartEnd", () => {
  const ref = new Date(2026, 5, 19);   // Fri 19 Jun 2026 local

  it("daily returns the calendar day boundaries", () => {
    const { start, end } = periodStartEnd("daily", ref);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(19);
    expect(end.getDate()).toBe(20);
  });

  it("weekly returns Sat→next Sat (Levant week starts Saturday)", () => {
    const { start, end } = periodStartEnd("weekly", ref);
    // 19 Jun 2026 is Friday → week starts the prior Saturday (13 Jun)
    expect(start.getDate()).toBe(13);
    expect(end.getDate()).toBe(20);
  });

  it("monthly returns 1st of this month → 1st of next month", () => {
    const { start, end } = periodStartEnd("monthly", ref);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(1);
  });

  it("yearly returns Jan 1 → next Jan 1", () => {
    const { start, end } = periodStartEnd("yearly", ref);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(2026);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
  });
});

describe("previousPeriod", () => {
  const ref = new Date(2026, 5, 19);
  it("daily → previous day", () => {
    const prev = previousPeriod("daily", ref);
    expect(prev.getDate()).toBe(18);
  });
  it("monthly → previous month", () => {
    const prev = previousPeriod("monthly", ref);
    expect(prev.getMonth()).toBe(4);
  });
  it("yearly → previous year", () => {
    const prev = previousPeriod("yearly", ref);
    expect(prev.getFullYear()).toBe(2025);
  });
});

describe("periodLabel", () => {
  it("returns Arabic label for each", () => {
    expect(periodLabel("daily")).toBe("يومي");
    expect(periodLabel("weekly")).toBe("أسبوعي");
    expect(periodLabel("monthly")).toBe("شهري");
    expect(periodLabel("yearly")).toBe("سنوي");
  });
});
