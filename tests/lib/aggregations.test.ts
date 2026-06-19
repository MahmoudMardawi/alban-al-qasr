import { describe, it, expect } from "vitest";
import { bucketByDay, sumBy, topN, calcNetProfit } from "@/lib/aggregations";

describe("bucketByDay", () => {
  it("buckets timestamped values into per-day totals", () => {
    const rows = [
      { day: new Date(2026, 5, 19), amount: 50 },
      { day: new Date(2026, 5, 19), amount: 30 },
      { day: new Date(2026, 5, 20), amount: 20 },
    ];
    const out = bucketByDay(rows, (r) => r.day, (r) => r.amount);
    expect(out).toEqual([
      { date: "2026-06-19", value: 80 },
      { date: "2026-06-20", value: 20 },
    ]);
  });
  it("returns empty for no rows", () => {
    expect(bucketByDay([], (r: { day: Date }) => r.day, () => 1)).toEqual([]);
  });
});

describe("sumBy", () => {
  it("sums via accessor", () => {
    expect(sumBy([{ x: 1 }, { x: 2 }, { x: 3 }], (r) => r.x)).toBe(6);
  });
});

describe("topN", () => {
  it("returns top N by value descending", () => {
    const rows = [
      { name: "A", v: 10 }, { name: "B", v: 30 }, { name: "C", v: 20 }, { name: "D", v: 5 },
    ];
    expect(topN(rows, (r) => r.v, 2)).toEqual([
      { name: "B", v: 30 }, { name: "C", v: 20 },
    ]);
  });
});

describe("calcNetProfit", () => {
  it("revenue − (expenses + waste cost)", () => {
    expect(calcNetProfit({ revenue: 1000, expenses: 300, wasteCost: 50 })).toBe(650);
  });
  it("can go negative", () => {
    expect(calcNetProfit({ revenue: 100, expenses: 200, wasteCost: 0 })).toBe(-100);
  });
});
