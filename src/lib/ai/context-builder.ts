import { createClient } from "@/lib/supabase/server";
import { sumBy, topN } from "@/lib/aggregations";
import { shapeContextForAI, type AiContext, type ClientBalance, type MonthBucket } from "@/lib/ai-context";

// Build 12-month rolling window: start = first day of (currentMonth - 11), end = first day of next month
function lastTwelveMonthsRange(now: Date = new Date()): { start: Date; end: Date; months: Array<{ key: string; start: Date; end: Date }> } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m - 11, 1);
  const end   = new Date(y, m + 1, 1);

  const months: Array<{ key: string; start: Date; end: Date }> = [];
  for (let i = 0; i < 12; i++) {
    const s = new Date(y, m - 11 + i, 1);
    const e = new Date(y, m - 11 + i + 1, 1);
    const key = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, start: s, end: e });
  }
  return { start, end, months };
}

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function buildAiContext(): Promise<AiContext> {
  const supabase = await createClient();
  const { start, end, months } = lastTwelveMonthsRange();

  const [visitsRes, expensesRes, prodRes, clientsRes, balanceRes, replRes, productsRes] = await Promise.all([
    supabase.from("visits")
      .select("client_id, visited_at, clients(name), visit_lines(line_type, qty, unit_price, product_id, products(name_ar))")
      .gte("visited_at", start.toISOString()).lt("visited_at", end.toISOString()),
    supabase.from("expenses").select("category, amount, spent_at")
      .gte("spent_at", start.toISOString()).lt("spent_at", end.toISOString()),
    supabase.from("production").select("qty_wasted, produced_at, products(base_cost)")
      .gte("produced_at", start.toISOString()).lt("produced_at", end.toISOString()),
    supabase.from("clients").select("id, name").is("merged_into_client_id", null),
    // Outstanding balances — NOT scoped to period; reflects all-time accumulated debt
    supabase.from("v_client_money_balance").select("client_id, balance"),
    supabase.from("v_client_replacement_debt").select("client_id, product_id, owed_base_qty"),
    supabase.from("products").select("id, name_ar"),
  ]);

  type V = {
    client_id: string;
    visited_at: string;
    clients: { name: string } | null;
    visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null }>;
  };
  const visits = ((visitsRes.data ?? []) as unknown as V[]);

  type SaleLine = { line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null };
  const saleLines: Array<{ visitedAt: string; line: SaleLine }> = [];
  for (const v of visits) for (const l of v.visit_lines) if (l.line_type === "sale") saleLines.push({ visitedAt: v.visited_at, line: l });

  // === Year aggregates ===
  const sales = sumBy(saleLines, (s) => Number(s.line.qty) * Number(s.line.unit_price ?? 0));

  const expRows  = (expensesRes.data ?? []) as Array<{ category: string; amount: number; spent_at: string }>;
  const expenses = sumBy(expRows, (e) => Number(e.amount));

  type ProdRow = { qty_wasted: number; produced_at: string; products: { base_cost: number | null } | null };
  const prodRows = (prodRes.data ?? []) as unknown as ProdRow[];
  const wasteCost = sumBy(prodRows, (p) => Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0));
  const netProfit = sales - (expenses + wasteCost);

  // === Top products (year) ===
  const productMap = new Map<string, { name: string; units: number; revenue: number }>();
  for (const { line: l } of saleLines) {
    const cur = productMap.get(l.product_id) ?? { name: l.products?.name_ar ?? "?", units: 0, revenue: 0 };
    cur.units   += Number(l.qty);
    cur.revenue += Number(l.qty) * Number(l.unit_price ?? 0);
    productMap.set(l.product_id, cur);
  }
  const salesByProduct = topN(Array.from(productMap.values()), (p) => p.revenue, 15);

  // === Top clients (year) ===
  const clientNameLookup = new Map<string, string>(((clientsRes.data ?? []) as Array<{id:string;name:string}>).map((c) => [c.id, c.name]));
  const clientMap = new Map<string, { name: string; revenue: number }>();
  for (const v of visits) {
    const lines = v.visit_lines.filter((l) => l.line_type === "sale");
    const total = sumBy(lines, (l) => Number(l.qty) * Number(l.unit_price ?? 0));
    const name = v.clients?.name ?? clientNameLookup.get(v.client_id) ?? "?";
    const cur = clientMap.get(v.client_id) ?? { name, revenue: 0 };
    cur.revenue += total;
    clientMap.set(v.client_id, cur);
  }
  const topClients = topN(Array.from(clientMap.values()), (c) => c.revenue, 15);

  // === Returns (year) ===
  const returnMap = new Map<string, number>();
  for (const v of visits) for (const l of v.visit_lines.filter((l) => l.line_type === "return_in")) {
    const name = l.products?.name_ar ?? "?";
    returnMap.set(name, (returnMap.get(name) ?? 0) + Number(l.qty));
  }
  const returns = Array.from(returnMap.entries()).map(([product, units]) => ({ product, units }));

  // === Expenses by category (year) ===
  const expCats = new Map<string, number>();
  for (const e of expRows) expCats.set(e.category, (expCats.get(e.category) ?? 0) + Number(e.amount));
  const expensesByCategory = Array.from(expCats.entries()).map(([category, amount]) => ({ category, amount }));

  // === Monthly breakdown ===
  type Agg = { sales: number; expenses: number; wasteCost: number };
  const byMonth = new Map<string, Agg>();
  for (const m of months) byMonth.set(m.key, { sales: 0, expenses: 0, wasteCost: 0 });
  for (const { visitedAt, line } of saleLines) {
    const agg = byMonth.get(monthKeyOf(visitedAt));
    if (agg) agg.sales += Number(line.qty) * Number(line.unit_price ?? 0);
  }
  for (const e of expRows) {
    const agg = byMonth.get(monthKeyOf(e.spent_at));
    if (agg) agg.expenses += Number(e.amount);
  }
  for (const p of prodRows) {
    const agg = byMonth.get(monthKeyOf(p.produced_at));
    if (agg) agg.wasteCost += Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0);
  }
  const monthlyHistory: MonthBucket[] = months.map((m) => {
    const a = byMonth.get(m.key)!;
    return { month: m.key, sales: a.sales, expenses: a.expenses, netProfit: a.sales - (a.expenses + a.wasteCost) };
  });

  // === Outstanding client balances (all-time, not period-scoped) ===
  const balRows  = (balanceRes.data ?? []) as Array<{ client_id: string; balance: number }>;
  const replRows = (replRes.data ?? []) as Array<{ client_id: string; product_id: string; owed_base_qty: number }>;
  const allProducts = (productsRes.data ?? []) as Array<{ id: string; name_ar: string }>;
  const productNameById = new Map<string, string>(allProducts.map((p) => [p.id, p.name_ar]));

  const moneyByClient = new Map<string, number>(balRows.map((r) => [r.client_id, Number(r.balance)]));
  const replByClient = new Map<string, Array<{ product: string; units: number }>>();
  for (const r of replRows) {
    const arr = replByClient.get(r.client_id) ?? [];
    arr.push({ product: productNameById.get(r.product_id) ?? "?", units: Number(r.owed_base_qty) });
    replByClient.set(r.client_id, arr);
  }

  const allClientIds = new Set<string>([...moneyByClient.keys(), ...replByClient.keys()]);
  const clientBalances: ClientBalance[] = [];
  for (const cid of allClientIds) {
    const money = moneyByClient.get(cid) ?? 0;
    const repl  = replByClient.get(cid) ?? [];
    if (money !== 0 || repl.length > 0) {
      clientBalances.push({
        name: clientNameLookup.get(cid) ?? "?",
        money_owed: money,
        replacement_debt: repl,
      });
    }
  }

  const startLabel = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const endLabel   = months[months.length - 1].key;
  return shapeContextForAI({
    periodLabel: `آخر 12 شهر (${startLabel} → ${endLabel})`,
    sales, expenses, netProfit,
    salesByProduct, topClients, returns, expensesByCategory,
    clientBalances,
    monthlyHistory,
  });
}
