import { describe, it, expect } from "vitest";
import { shapeContextForAI, type RawAiData } from "@/lib/ai-context";

describe("shapeContextForAI", () => {
  const raw: RawAiData = {
    periodLabel: "آخر 30 يوم",
    sales: 1235,
    expenses: 720,
    netProfit: 515,
    salesByProduct: [{ name: "لبن", units: 247, revenue: 1235 }, { name: "لبنة", units: 50, revenue: 900 }],
    topClients:     [{ name: "سوبر ماركت الأخوة", revenue: 800 }, { name: "محلات أبو خالد", revenue: 600 }],
    returns:        [{ product: "لبن", units: 3 }],
    expensesByCategory: [{ category: "fuel", amount: 200 }, { category: "salary", amount: 520 }],
  };

  it("emits a compact JSON-friendly object", () => {
    const out = shapeContextForAI(raw);
    expect(out.period).toBe("آخر 30 يوم");
    expect(out.totals.sales).toBe(1235);
    expect(out.totals.net_profit).toBe(515);
    expect(out.top_products[0].name).toBe("لبن");
  });

  it("truncates lists to top 10 for token economy", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ name: `P${i}`, units: i, revenue: i * 10 }));
    const out = shapeContextForAI({ ...raw, salesByProduct: many });
    expect(out.top_products).toHaveLength(10);
  });

  it("handles empty arrays", () => {
    const out = shapeContextForAI({ ...raw, returns: [], topClients: [] });
    expect(out.returns).toEqual([]);
    expect(out.top_clients).toEqual([]);
  });

  it("emits monthly_breakdown when monthlyHistory is provided", () => {
    const out = shapeContextForAI({
      ...raw,
      monthlyHistory: [
        { month: "2026-05", sales: 1000, expenses: 600, netProfit: 400 },
        { month: "2026-06", sales: 1200, expenses: 700, netProfit: 500 },
      ],
    });
    expect(out.monthly_breakdown).toHaveLength(2);
    expect(out.monthly_breakdown![0]).toEqual({ month: "2026-05", sales: 1000, expenses: 600, net_profit: 400 });
  });

  it("omits monthly_breakdown when monthlyHistory is missing or empty", () => {
    expect(shapeContextForAI(raw).monthly_breakdown).toBeUndefined();
    expect(shapeContextForAI({ ...raw, monthlyHistory: [] }).monthly_breakdown).toBeUndefined();
  });
});
