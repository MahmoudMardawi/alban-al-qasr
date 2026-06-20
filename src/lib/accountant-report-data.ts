import { createClient } from "@/lib/supabase/server";

export interface AccountantMonthlyReport {
  label: string;                          // human-readable range label
  start: Date;
  end: Date;
  // Revenue side
  gross_sales: number;
  cash_sales: number;                     // sales where the visit had cash-on-delivery covering full total
  partial_paid_sales: number;             // sales where only part was paid at delivery
  credit_sales: number;                   // sales with no payment at delivery (full آجل)
  // Receivables movement
  payments_received_at_delivery: number;  // payments tied to a visit this month
  payments_received_later: number;        // payments NOT tied to a visit this month
  total_payments_received: number;
  returns_value: number;                  // sum of qty * unit_price for return_in lines
  replacements_value: number;             // bdal — cost of items given without charge
  // Expense side
  waste_cost: number;
  expenses_by_category: Array<{ category: string; amount: number }>;
  total_expenses: number;
  // Bottom line
  net_profit: number;
  // Operational
  truck_loads_summary: Array<{
    product: string;
    total_loaded: number;
    total_returned: number;
    total_sold_via_visits: number;
    shortage: number;
  }>;
  visits_count: number;
}

function parseIsoDate(iso: string): Date {
  // iso is "YYYY-MM-DD" in user-local-equivalent date semantics
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getAccountantReport(startIso: string, endIso: string): Promise<AccountantMonthlyReport> {
  const supabase = await createClient();
  const start = parseIsoDate(startIso);
  // end is inclusive in the query — add 1 day so range covers the full last day
  const endInclusive = parseIsoDate(endIso);
  const end = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate() + 1);
  const label = startIso === endIso ? startIso : `${startIso} → ${endIso}`;

  const [visitsRes, paymentsRes, expensesRes, prodRes, loadsRes] = await Promise.all([
    supabase.from("visits")
      .select("id, visited_at, visit_lines(line_type, qty, unit_price, base_qty, product_id, products(name_ar, base_cost, base_price))")
      .gte("visited_at", start.toISOString()).lt("visited_at", end.toISOString()),
    supabase.from("payments")
      .select("amount, paid_at, visit_id, method")
      .gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()),
    supabase.from("expenses").select("category, amount, spent_at")
      .gte("spent_at", start.toISOString()).lt("spent_at", end.toISOString()),
    supabase.from("production").select("qty_wasted, produced_at, products(base_cost)")
      .gte("produced_at", start.toISOString()).lt("produced_at", end.toISOString()),
    supabase.from("truck_loads")
      .select("id, loaded_at, status, employee_id, truck_load_items(product_id, qty_loaded, qty_returned, products(name_ar))")
      .gte("loaded_at", start.toISOString().slice(0, 10))
      .lt("loaded_at",  end.toISOString().slice(0, 10))
      .eq("status", "closed"),
  ]);

  type V = {
    id: string;
    visited_at: string;
    visit_lines: Array<{
      line_type: string;
      qty: number;
      unit_price: number | null;
      base_qty: number;
      product_id: string;
      products: { name_ar: string; base_cost: number | null; base_price: number } | null;
    }>;
  };
  const visits = (visitsRes.data ?? []) as unknown as V[];
  type Pay = { amount: number; paid_at: string; visit_id: string | null; method: string };
  const payments = (paymentsRes.data ?? []) as Pay[];

  // Visit-level cash vs credit classification
  let grossSales = 0, cashSales = 0, partialPaidSales = 0, creditSales = 0;
  let returnsValue = 0, replacementsValue = 0;

  const paymentsByVisit = new Map<string, number>();
  let paymentsAtDelivery = 0;
  for (const p of payments) {
    if (p.visit_id) {
      paymentsByVisit.set(p.visit_id, (paymentsByVisit.get(p.visit_id) ?? 0) + Number(p.amount));
      paymentsAtDelivery += Number(p.amount);
    }
  }
  const paymentsLater = payments.reduce((s, p) => s + Number(p.amount), 0) - paymentsAtDelivery;

  for (const v of visits) {
    const visitTotal = v.visit_lines
      .filter((l) => l.line_type === "sale")
      .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0);
    if (visitTotal === 0) continue;

    grossSales += visitTotal;
    const paid = paymentsByVisit.get(v.id) ?? 0;
    if (paid >= visitTotal) cashSales += visitTotal;
    else if (paid > 0)      partialPaidSales += visitTotal;
    else                    creditSales += visitTotal;

    // Returns + replacements valued at product's base_price (best estimate)
    for (const l of v.visit_lines) {
      const price = Number(l.products?.base_price ?? 0);
      if (l.line_type === "return_in")        returnsValue      += Number(l.base_qty) * price;
      if (l.line_type === "replacement_out")  replacementsValue += Number(l.base_qty) * price;
    }
  }

  // Expenses
  type ExpRow = { category: string; amount: number; spent_at: string };
  const expRows = (expensesRes.data ?? []) as ExpRow[];
  const totalExpenses = expRows.reduce((s, e) => s + Number(e.amount), 0);
  const expByCat = new Map<string, number>();
  for (const e of expRows) expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + Number(e.amount));
  const expensesByCategory = Array.from(expByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));

  // Waste cost
  type Pr = { qty_wasted: number; produced_at: string; products: { base_cost: number | null } | null };
  const prodRows = (prodRes.data ?? []) as unknown as Pr[];
  const wasteCost = prodRows.reduce((s, p) => s + Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0), 0);

  // Truck loads aggregation
  type Load = {
    id: string;
    truck_load_items: Array<{
      product_id: string;
      qty_loaded: number;
      qty_returned: number;
      products: { name_ar: string } | null;
    }>;
  };
  const loads = (loadsRes.data ?? []) as unknown as Load[];

  // For shortage we need: loaded - returned - sold-via-visits-by-same-employee-on-same-day
  // For simplicity here, compute loaded/returned by product across the month; sold-via-visits
  // is approximated from the visits we already have in scope (across all employees).
  const soldUnitsByProduct = new Map<string, number>();
  for (const v of visits) for (const l of v.visit_lines) {
    if (l.line_type === "sale" || l.line_type === "replacement_out") {
      soldUnitsByProduct.set(l.product_id, (soldUnitsByProduct.get(l.product_id) ?? 0) + Number(l.base_qty));
    }
  }

  const loadAgg = new Map<string, { product: string; total_loaded: number; total_returned: number }>();
  for (const load of loads) for (const item of (load.truck_load_items ?? [])) {
    const key = item.product_id;
    const cur = loadAgg.get(key) ?? { product: item.products?.name_ar ?? "?", total_loaded: 0, total_returned: 0 };
    cur.total_loaded   += Number(item.qty_loaded);
    cur.total_returned += Number(item.qty_returned);
    loadAgg.set(key, cur);
  }
  const truckLoadsSummary = Array.from(loadAgg.entries()).map(([pid, agg]) => {
    const sold = soldUnitsByProduct.get(pid) ?? 0;
    return {
      ...agg,
      total_sold_via_visits: sold,
      shortage: agg.total_loaded - agg.total_returned - sold,
    };
  });

  const netProfit = grossSales - returnsValue - wasteCost - totalExpenses;

  return {
    label,
    start, end,
    gross_sales: grossSales,
    cash_sales: cashSales,
    partial_paid_sales: partialPaidSales,
    credit_sales: creditSales,
    payments_received_at_delivery: paymentsAtDelivery,
    payments_received_later: paymentsLater,
    total_payments_received: paymentsAtDelivery + paymentsLater,
    returns_value: returnsValue,
    replacements_value: replacementsValue,
    waste_cost: wasteCost,
    expenses_by_category: expensesByCategory,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    truck_loads_summary: truckLoadsSummary,
    visits_count: visits.length,
  };
}
