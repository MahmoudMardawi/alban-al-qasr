import { createClient } from "@/lib/supabase/server";
import { periodStartEnd } from "@/lib/periods";
import { sumBy, topN } from "@/lib/aggregations";
import { shapeContextForAI, type AiContext } from "@/lib/ai-context";

export async function buildAiContext(): Promise<AiContext> {
  const supabase = await createClient();
  const { start, end } = periodStartEnd("monthly");

  const [visitsRes, expensesRes, prodRes, clientsRes] = await Promise.all([
    supabase.from("visits")
      .select("client_id, clients(name), visit_lines(line_type, qty, unit_price, product_id, products(name_ar))")
      .gte("visited_at", start.toISOString()).lt("visited_at", end.toISOString()),
    supabase.from("expenses").select("category, amount")
      .gte("spent_at", start.toISOString()).lt("spent_at", end.toISOString()),
    supabase.from("production").select("qty_wasted, products(base_cost)")
      .gte("produced_at", start.toISOString()).lt("produced_at", end.toISOString()),
    supabase.from("clients").select("id, name").is("merged_into_client_id", null),
  ]);

  type V = { client_id: string; clients: { name: string } | null;
             visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null }> };
  const visits = ((visitsRes.data ?? []) as unknown as V[]);

  const saleLines = visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "sale"));
  const sales     = sumBy(saleLines, (l) => Number(l.qty) * Number(l.unit_price ?? 0));

  const expRows  = (expensesRes.data ?? []) as Array<{ category: string; amount: number }>;
  const expenses = sumBy(expRows, (e) => Number(e.amount));

  type ProdRow = { qty_wasted: number; products: { base_cost: number | null } | null };
  const wasteCost = sumBy((prodRes.data ?? []) as unknown as ProdRow[], (p) => Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0));
  const netProfit = sales - (expenses + wasteCost);

  const productMap = new Map<string, { name: string; units: number; revenue: number }>();
  for (const l of saleLines) {
    const cur = productMap.get(l.product_id) ?? { name: l.products?.name_ar ?? "?", units: 0, revenue: 0 };
    cur.units   += Number(l.qty);
    cur.revenue += Number(l.qty) * Number(l.unit_price ?? 0);
    productMap.set(l.product_id, cur);
  }
  const salesByProduct = topN(Array.from(productMap.values()), (p) => p.revenue, 12);

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
  const topClients = topN(Array.from(clientMap.values()), (c) => c.revenue, 12);

  const returnMap = new Map<string, number>();
  for (const l of visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "return_in"))) {
    const name = l.products?.name_ar ?? "?";
    returnMap.set(name, (returnMap.get(name) ?? 0) + Number(l.qty));
  }
  const returns = Array.from(returnMap.entries()).map(([product, units]) => ({ product, units }));

  const expCats = new Map<string, number>();
  for (const e of expRows) expCats.set(e.category, (expCats.get(e.category) ?? 0) + Number(e.amount));
  const expensesByCategory = Array.from(expCats.entries()).map(([category, amount]) => ({ category, amount }));

  return shapeContextForAI({
    periodLabel: "آخر شهر (الشهر الحالي)",
    sales, expenses, netProfit,
    salesByProduct, topClients, returns, expensesByCategory,
  });
}
