import { createClient } from "@/lib/supabase/server";
import { periodStartEnd, previousPeriod, type Period } from "@/lib/periods";
import { bucketByDay, sumBy, topN, calcNetProfit } from "@/lib/aggregations";

export interface DashboardData {
  period: Period;
  windowStart: Date;
  windowEnd: Date;
  hero: { netProfit: number; deltaPct: number | null };
  stats: {
    sales: number; salesDeltaPct: number | null;
    expenses: number; expensesDeltaPct: number | null;
    wasteUnits: number;
    returnsUnits: number;
  };
  revenueByDay: Array<{ date: string; value: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  topClients:  Array<{ id: string; name: string; revenue: number }>;
  topProducts: Array<{ id: string; name_ar: string; revenue: number }>;
}

type SupabaseSrv = Awaited<ReturnType<typeof createClient>>;
type VisitRow = {
  visited_at: string; client_id: string;
  visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null }>;
};

async function periodRevenue(supabase: SupabaseSrv, start: Date, end: Date): Promise<VisitRow[]> {
  const { data } = await supabase
    .from("visits")
    .select("visited_at, client_id, visit_lines(line_type, qty, unit_price, product_id, products(name_ar))")
    .gte("visited_at", start.toISOString())
    .lt("visited_at",  end.toISOString());
  return (data ?? []) as unknown as VisitRow[];
}

export async function getDashboardData(period: Period, ref: Date = new Date()): Promise<DashboardData> {
  const supabase = await createClient();
  const { start, end } = periodStartEnd(period, ref);
  const prevEnd = start;
  const { start: prevStart } = periodStartEnd(period, previousPeriod(period, ref));

  const [visits, prevVisits, expenses, prevExpenses, production, clientsList] = await Promise.all([
    periodRevenue(supabase, start, end),
    periodRevenue(supabase, prevStart, prevEnd),
    supabase.from("expenses").select("amount, category, spent_at").gte("spent_at", start.toISOString()).lt("spent_at", end.toISOString()),
    supabase.from("expenses").select("amount").gte("spent_at", prevStart.toISOString()).lt("spent_at", prevEnd.toISOString()),
    supabase.from("production").select("qty_wasted, product_id, products(base_cost)").gte("produced_at", start.toISOString()).lt("produced_at", end.toISOString()),
    supabase.from("clients").select("id, name").is("merged_into_client_id", null),
  ]);

  const clientNameMap = new Map<string, string>(((clientsList.data ?? []) as Array<{id:string;name:string}>).map((c) => [c.id, c.name]));

  // Sales
  const saleLinesNow  = visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "sale"));
  const saleLinesPrev = prevVisits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "sale"));
  const salesNow  = sumBy(saleLinesNow,  (l) => Number(l.qty) * Number(l.unit_price ?? 0));
  const salesPrev = sumBy(saleLinesPrev, (l) => Number(l.qty) * Number(l.unit_price ?? 0));
  const salesDelta = salesPrev > 0 ? Math.round(((salesNow - salesPrev) / salesPrev) * 100) : null;

  // Expenses
  const expRows  = (expenses.data ?? []) as Array<{ amount: number; category: string }>;
  const expRowsP = (prevExpenses.data ?? []) as Array<{ amount: number }>;
  const expensesNow  = sumBy(expRows,  (e) => Number(e.amount));
  const expensesPrev = sumBy(expRowsP, (e) => Number(e.amount));
  const expensesDelta = expensesPrev > 0 ? Math.round(((expensesNow - expensesPrev) / expensesPrev) * 100) : null;

  // Waste (units + cost)
  type ProdRow = { qty_wasted: number; product_id: string; products: { base_cost: number | null } | null };
  const prodRows = (production.data ?? []) as unknown as ProdRow[];
  const wasteUnits = sumBy(prodRows, (p) => Number(p.qty_wasted));
  const wasteCost  = sumBy(prodRows, (p) => Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0));

  // Returns count (units)
  const returnsUnits = sumBy(
    visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "return_in")),
    (l) => Number(l.qty),
  );

  // Net profit
  const netProfit  = calcNetProfit({ revenue: salesNow,  expenses: expensesNow,  wasteCost });
  const netProfitP = calcNetProfit({ revenue: salesPrev, expenses: expensesPrev, wasteCost: 0 });
  const profitDelta = netProfitP !== 0 ? Math.round(((netProfit - netProfitP) / Math.abs(netProfitP)) * 100) : null;

  // Revenue by day (link each sale line back to its visit's date)
  const revenueDailyRows: Array<{ day: Date; amount: number }> = [];
  for (const v of visits) {
    const day = new Date(v.visited_at);
    for (const l of v.visit_lines) {
      if (l.line_type === "sale") {
        revenueDailyRows.push({ day, amount: Number(l.qty) * Number(l.unit_price ?? 0) });
      }
    }
  }
  const revenueByDay = bucketByDay(revenueDailyRows, (r) => r.day, (r) => r.amount);

  // Expense pie
  const expCats = new Map<string, number>();
  for (const e of expRows) expCats.set(e.category, (expCats.get(e.category) ?? 0) + Number(e.amount));
  const expensesByCategory = Array.from(expCats.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Top clients
  const clientRevMap = new Map<string, number>();
  for (const v of visits) {
    const total = sumBy(v.visit_lines.filter((l) => l.line_type === "sale"), (l) => Number(l.qty) * Number(l.unit_price ?? 0));
    clientRevMap.set(v.client_id, (clientRevMap.get(v.client_id) ?? 0) + total);
  }
  const topClients = topN(
    Array.from(clientRevMap.entries()).map(([id, revenue]) => ({ id, name: clientNameMap.get(id) ?? "?", revenue })),
    (r) => r.revenue, 5,
  );

  // Top products
  const productRevMap = new Map<string, { name: string; revenue: number }>();
  for (const l of saleLinesNow) {
    const cur = productRevMap.get(l.product_id) ?? { name: l.products?.name_ar ?? "?", revenue: 0 };
    cur.revenue += Number(l.qty) * Number(l.unit_price ?? 0);
    productRevMap.set(l.product_id, cur);
  }
  const topProducts = topN(
    Array.from(productRevMap.entries()).map(([id, v]) => ({ id, name_ar: v.name, revenue: v.revenue })),
    (r) => r.revenue, 5,
  );

  return {
    period, windowStart: start, windowEnd: end,
    hero: { netProfit, deltaPct: profitDelta },
    stats: { sales: salesNow, salesDeltaPct: salesDelta, expenses: expensesNow, expensesDeltaPct: expensesDelta, wasteUnits, returnsUnits },
    revenueByDay, expensesByCategory, topClients, topProducts,
  };
}
