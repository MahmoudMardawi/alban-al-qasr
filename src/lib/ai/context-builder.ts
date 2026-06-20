import { createClient } from "@/lib/supabase/server";
import { sumBy, topN } from "@/lib/aggregations";
import {
  shapeContextForAI,
  type AiContext,
  type ClientBalance,
  type MonthBucket,
  type ProductCatalogEntry,
  type ProductSummary,
  type ReturnEntry,
  type ExpenseCategoryEntry,
} from "@/lib/ai-context";

function lastTwelveMonthsRange(now: Date = new Date()): { start: Date; end: Date; months: string[] } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m - 11, 1);
  const end   = new Date(y, m + 1, 1);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const s = new Date(y, m - 11 + i, 1);
    months.push(`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`);
  }
  return { start, end, months };
}

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function buildAiContext(): Promise<AiContext> {
  const supabase = await createClient();
  const { start, end, months } = lastTwelveMonthsRange();

  const [visitsRes, expensesRes, prodRes, paymentsRes, clientsRes, balanceRes, replRes, productsRes, packagesRes] = await Promise.all([
    supabase.from("visits")
      .select("client_id, visited_at, clients(name), visit_lines(line_type, qty, unit_price, product_id, products(name_ar))")
      .gte("visited_at", start.toISOString()).lt("visited_at", end.toISOString()),
    supabase.from("expenses").select("category, amount, spent_at")
      .gte("spent_at", start.toISOString()).lt("spent_at", end.toISOString()),
    supabase.from("production").select("qty_wasted, produced_at, products(base_cost)")
      .gte("produced_at", start.toISOString()).lt("produced_at", end.toISOString()),
    supabase.from("payments").select("amount, paid_at")
      .gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()),
    supabase.from("clients").select("id, name").is("merged_into_client_id", null),
    supabase.from("v_client_money_balance").select("client_id, balance"),
    supabase.from("v_client_replacement_debt").select("client_id, product_id, owed_base_qty"),
    supabase.from("products").select("id, name_ar, base_unit, base_price, base_cost, is_active").eq("is_active", true),
    supabase.from("product_packages").select("product_id, package_name, package_price, contains_qty, is_active").eq("is_active", true),
  ]);

  type V = {
    client_id: string;
    visited_at: string;
    clients: { name: string } | null;
    visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null }>;
  };
  const visits = ((visitsRes.data ?? []) as unknown as V[]);

  type SaleLine = { line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null };
  const allLines: Array<{ visitedAt: string; line: SaleLine }> = [];
  for (const v of visits) for (const l of v.visit_lines) allLines.push({ visitedAt: v.visited_at, line: l });

  const saleLines    = allLines.filter((x) => x.line.line_type === "sale");
  const returnLines  = allLines.filter((x) => x.line.line_type === "return_in");

  const expRows    = (expensesRes.data ?? []) as Array<{ category: string; amount: number; spent_at: string }>;
  type ProdRow     = { qty_wasted: number; produced_at: string; products: { base_cost: number | null } | null };
  const prodRows   = (prodRes.data ?? []) as unknown as ProdRow[];
  const payRows    = (paymentsRes.data ?? []) as Array<{ amount: number; paid_at: string }>;

  // ============================================================
  // YEAR AGGREGATES
  // ============================================================
  const yearSales    = sumBy(saleLines, (s) => Number(s.line.qty) * Number(s.line.unit_price ?? 0));
  const yearExpenses = sumBy(expRows,   (e) => Number(e.amount));
  const yearWaste    = sumBy(prodRows,  (p) => Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0));
  const yearPayments = sumBy(payRows,   (p) => Number(p.amount));
  const yearNetProfit = yearSales - (yearExpenses + yearWaste);

  // Year top products
  const yearProductMap = new Map<string, ProductSummary>();
  for (const { line: l } of saleLines) {
    const cur = yearProductMap.get(l.product_id) ?? { name: l.products?.name_ar ?? "?", units: 0, revenue: 0 };
    cur.units   += Number(l.qty);
    cur.revenue += Number(l.qty) * Number(l.unit_price ?? 0);
    yearProductMap.set(l.product_id, cur);
  }
  const topProductsYear = topN(Array.from(yearProductMap.values()), (p) => p.revenue, 15);

  // Year top clients
  const clientNameLookup = new Map<string, string>(((clientsRes.data ?? []) as Array<{id:string;name:string}>).map((c) => [c.id, c.name]));
  const yearClientMap = new Map<string, { name: string; revenue: number }>();
  for (const v of visits) {
    const lines = v.visit_lines.filter((l) => l.line_type === "sale");
    const total = sumBy(lines, (l) => Number(l.qty) * Number(l.unit_price ?? 0));
    const name = v.clients?.name ?? clientNameLookup.get(v.client_id) ?? "?";
    const cur = yearClientMap.get(v.client_id) ?? { name, revenue: 0 };
    cur.revenue += total;
    yearClientMap.set(v.client_id, cur);
  }
  const topClientsYear = topN(Array.from(yearClientMap.values()), (c) => c.revenue, 15);

  // Year returns
  const yearReturnMap = new Map<string, number>();
  for (const { line: l } of returnLines) {
    const name = l.products?.name_ar ?? "?";
    yearReturnMap.set(name, (yearReturnMap.get(name) ?? 0) + Number(l.qty));
  }
  const returnsYear: ReturnEntry[] = Array.from(yearReturnMap.entries()).map(([product, units]) => ({ product, units }));

  // Year expenses by category
  const yearExpCats = new Map<string, number>();
  for (const e of expRows) yearExpCats.set(e.category, (yearExpCats.get(e.category) ?? 0) + Number(e.amount));
  const expensesByCategoryYear: ExpenseCategoryEntry[] = Array.from(yearExpCats.entries()).map(([category, amount]) => ({ category, amount }));

  // ============================================================
  // MONTHLY BREAKDOWN — full detail per month
  // ============================================================
  type MonthAccumulator = {
    sales: number;
    expenses: number;
    waste_cost: number;
    payments_received: number;
    productMap: Map<string, ProductSummary>;
    returnMap: Map<string, number>;
    expByCat: Map<string, number>;
  };
  const newAcc = (): MonthAccumulator => ({
    sales: 0, expenses: 0, waste_cost: 0, payments_received: 0,
    productMap: new Map(), returnMap: new Map(), expByCat: new Map(),
  });
  const byMonth = new Map<string, MonthAccumulator>();
  for (const k of months) byMonth.set(k, newAcc());

  // Sales + monthly product map
  for (const { visitedAt, line: l } of saleLines) {
    const acc = byMonth.get(monthKeyOf(visitedAt));
    if (!acc) continue;
    const value = Number(l.qty) * Number(l.unit_price ?? 0);
    acc.sales += value;
    const cur = acc.productMap.get(l.product_id) ?? { name: l.products?.name_ar ?? "?", units: 0, revenue: 0 };
    cur.units   += Number(l.qty);
    cur.revenue += value;
    acc.productMap.set(l.product_id, cur);
  }
  // Returns
  for (const { visitedAt, line: l } of returnLines) {
    const acc = byMonth.get(monthKeyOf(visitedAt));
    if (!acc) continue;
    const name = l.products?.name_ar ?? "?";
    acc.returnMap.set(name, (acc.returnMap.get(name) ?? 0) + Number(l.qty));
  }
  // Expenses
  for (const e of expRows) {
    const acc = byMonth.get(monthKeyOf(e.spent_at));
    if (!acc) continue;
    acc.expenses += Number(e.amount);
    acc.expByCat.set(e.category, (acc.expByCat.get(e.category) ?? 0) + Number(e.amount));
  }
  // Waste cost
  for (const p of prodRows) {
    const acc = byMonth.get(monthKeyOf(p.produced_at));
    if (!acc) continue;
    acc.waste_cost += Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0);
  }
  // Payments received
  for (const p of payRows) {
    const acc = byMonth.get(monthKeyOf(p.paid_at));
    if (!acc) continue;
    acc.payments_received += Number(p.amount);
  }

  const monthlyHistory: MonthBucket[] = months.map((month) => {
    const a = byMonth.get(month)!;
    return {
      month,
      sales:             a.sales,
      expenses:          a.expenses,
      waste_cost:        a.waste_cost,
      payments_received: a.payments_received,
      net_profit:        a.sales - (a.expenses + a.waste_cost),
      top_products:      topN(Array.from(a.productMap.values()), (p) => p.revenue, 5),
      returns:           Array.from(a.returnMap.entries()).map(([product, units]) => ({ product, units })),
      expenses_by_category: Array.from(a.expByCat.entries()).map(([category, amount]) => ({ category, amount })),
    };
  });

  // ============================================================
  // OUTSTANDING BALANCES (all-time)
  // ============================================================
  const balRows  = (balanceRes.data ?? []) as Array<{ client_id: string; balance: number }>;
  const replRows = (replRes.data ?? []) as Array<{ client_id: string; product_id: string; owed_base_qty: number }>;
  const allProductRows = (productsRes.data ?? []) as Array<{ id: string; name_ar: string; base_unit: string; base_price: number; base_cost: number | null; is_active: boolean }>;
  const productNameById = new Map<string, string>(allProductRows.map((p) => [p.id, p.name_ar]));

  const moneyByClient = new Map<string, number>(balRows.map((r) => [r.client_id, Number(r.balance)]));
  const replByClient = new Map<string, Array<{ product: string; units: number }>>();
  const replByProductTotal = new Map<string, number>();
  for (const r of replRows) {
    const productName = productNameById.get(r.product_id) ?? "?";
    const units = Number(r.owed_base_qty);
    const arr = replByClient.get(r.client_id) ?? [];
    arr.push({ product: productName, units });
    replByClient.set(r.client_id, arr);
    replByProductTotal.set(productName, (replByProductTotal.get(productName) ?? 0) + units);
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
  const replacementDebtByProduct: ReturnEntry[] = Array.from(replByProductTotal.entries())
    .filter(([, units]) => units > 0)
    .map(([product, units]) => ({ product, units }));

  // ============================================================
  // PRODUCT CATALOG (reference data)
  // ============================================================
  const packageRows = (packagesRes.data ?? []) as Array<{ product_id: string; package_name: string; package_price: number; contains_qty: number; is_active: boolean }>;
  const packagesByProduct = new Map<string, Array<{ name: string; price: number; contains_qty: number }>>();
  for (const p of packageRows) {
    const arr = packagesByProduct.get(p.product_id) ?? [];
    arr.push({ name: p.package_name, price: Number(p.package_price), contains_qty: Number(p.contains_qty) });
    packagesByProduct.set(p.product_id, arr);
  }
  const productsCatalog: ProductCatalogEntry[] = allProductRows.map((p) => ({
    name: p.name_ar,
    base_unit: p.base_unit,
    base_price: Number(p.base_price),
    base_cost: p.base_cost === null ? null : Number(p.base_cost),
    packages: packagesByProduct.get(p.id) ?? [],
  }));

  const startLabel = months[0];
  const endLabel   = months[months.length - 1];

  return shapeContextForAI({
    periodLabel: `آخر 12 شهر (${startLabel} → ${endLabel})`,
    today: todayIso(),
    yearTotals: {
      sales: yearSales,
      expenses: yearExpenses,
      waste_cost: yearWaste,
      payments_received: yearPayments,
      net_profit: yearNetProfit,
    },
    topProductsYear,
    topClientsYear,
    returnsYear,
    expensesByCategoryYear,
    monthlyHistory,
    clientBalances,
    replacementDebtByProduct,
    productsCatalog,
    activeClientsCount: clientNameLookup.size,
  });
}
