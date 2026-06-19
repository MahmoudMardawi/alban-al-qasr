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

  it("truncates lists to top 5 for token economy", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, units: i, revenue: i * 10 }));
    const out = shapeContextForAI({ ...raw, salesByProduct: many });
    expect(out.top_products).toHaveLength(5);
  });

  it("handles empty arrays", () => {
    const out = shapeContextForAI({ ...raw, returns: [], topClients: [] });
    expect(out.returns).toEqual([]);
    expect(out.top_clients).toEqual([]);
  });
});
