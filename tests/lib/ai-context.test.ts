import { describe, it, expect } from "vitest";
import { shapeContextForAI, type RawAiData } from "@/lib/ai-context";

describe("shapeContextForAI", () => {
  const baseMonth = {
    month: "2026-06",
    sales: 1200,
    expenses: 700,
    waste_cost: 50,
    payments_received: 800,
    net_profit: 450,
    top_products: [{ name: "لبن", units: 247, revenue: 1200 }],
    returns: [{ product: "لبن", units: 3 }],
    expenses_by_category: [{ category: "fuel", amount: 200 }],
  };

  const raw: RawAiData = {
    periodLabel: "آخر 12 شهر (2025-07 → 2026-06)",
    today: "2026-06-20",
    yearTotals: { sales: 14000, expenses: 8500, waste_cost: 600, payments_received: 9500, net_profit: 4900 },
    topProductsYear: [
      { name: "لبن",  units: 2470, revenue: 12350 },
      { name: "لبنة", units: 500,  revenue: 9000 },
    ],
    topClientsYear: [
      { name: "سوبر ماركت الأخوة", revenue: 8000 },
      { name: "محلات أبو خالد",    revenue: 6000 },
    ],
    returnsYear: [{ product: "لبن", units: 24 }],
    expensesByCategoryYear: [
      { category: "fuel",   amount: 2000 },
      { category: "salary", amount: 5500 },
    ],
    monthlyHistory: [baseMonth],
  };

  it("emits period, today, and year_totals at top level", () => {
    const out = shapeContextForAI(raw);
    expect(out.period).toMatch(/آخر 12 شهر/);
    expect(out.today).toBe("2026-06-20");
    expect(out.year_totals.sales).toBe(14000);
    expect(out.year_totals.net_profit).toBe(4900);
    expect(out.year_totals.payments_received).toBe(9500);
  });

  it("preserves the monthly_breakdown verbatim", () => {
    const out = shapeContextForAI(raw);
    expect(out.monthly_breakdown).toHaveLength(1);
    expect(out.monthly_breakdown[0].month).toBe("2026-06");
    expect(out.monthly_breakdown[0].waste_cost).toBe(50);
    expect(out.monthly_breakdown[0].top_products[0].name).toBe("لبن");
    expect(out.monthly_breakdown[0].returns[0].units).toBe(3);
    expect(out.monthly_breakdown[0].expenses_by_category[0].category).toBe("fuel");
  });

  it("truncates year top_products and top_clients to top 10", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ name: `P${i}`, units: i, revenue: i * 10 }));
    const out  = shapeContextForAI({ ...raw, topProductsYear: many });
    expect(out.top_products_year).toHaveLength(10);

    const manyClients = Array.from({ length: 15 }, (_, i) => ({ name: `C${i}`, revenue: i * 10 }));
    const out2 = shapeContextForAI({ ...raw, topClientsYear: manyClients });
    expect(out2.top_clients_year).toHaveLength(10);
  });

  it("handles empty arrays gracefully", () => {
    const out = shapeContextForAI({ ...raw, returnsYear: [], topClientsYear: [] });
    expect(out.returns_year).toEqual([]);
    expect(out.top_clients_year).toEqual([]);
  });

  it("includes outstanding balances and totals when provided", () => {
    const out = shapeContextForAI({
      ...raw,
      clientBalances: [
        { name: "أبو سامي",  money_owed: 500,  replacement_debt: [] },
        { name: "أبو محمود", money_owed: 300,  replacement_debt: [{ product: "لبن", units: 5 }] },
        { name: "أبو هاني",  money_owed: -100, replacement_debt: [] },
      ],
    });
    expect(out.clients_with_outstanding_balance).toHaveLength(2);
    expect(out.clients_with_outstanding_balance![0].money_owed).toBe(500);
    expect(out.total_outstanding_money).toBe(800);
  });

  it("includes replacement_debt_by_product when provided", () => {
    const out = shapeContextForAI({
      ...raw,
      replacementDebtByProduct: [{ product: "لبن", units: 12 }, { product: "لبنة", units: 4 }],
    });
    expect(out.total_replacement_debt_by_product).toHaveLength(2);
    expect(out.total_replacement_debt_by_product![0].units).toBe(12);
  });

  it("includes products_catalog and active_clients_count when provided", () => {
    const out = shapeContextForAI({
      ...raw,
      productsCatalog: [{
        name: "لبن", base_unit: "L", base_price: 5, base_cost: 3,
        packages: [{ name: "كرتونة (24 لتر)", price: 110, contains_qty: 24 }],
      }],
      activeClientsCount: 23,
    });
    expect(out.products_catalog).toHaveLength(1);
    expect(out.products_catalog![0].packages[0].name).toContain("كرتونة");
    expect(out.active_clients_count).toBe(23);
  });

  it("omits optional sections when not provided", () => {
    const out = shapeContextForAI(raw);
    expect(out.clients_with_outstanding_balance).toBeUndefined();
    expect(out.total_outstanding_money).toBeUndefined();
    expect(out.total_replacement_debt_by_product).toBeUndefined();
    expect(out.products_catalog).toBeUndefined();
    expect(out.active_clients_count).toBeUndefined();
  });
});
