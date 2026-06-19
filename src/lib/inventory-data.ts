import { createClient } from "@/lib/supabase/server";
import { periodStartEnd, previousPeriod, type Period } from "@/lib/periods";
import { sumBy } from "@/lib/aggregations";

export interface ProductInventoryRow {
  product_id: string;
  name_ar: string;
  base_unit: "L" | "kg" | "piece";
  opening:   number;
  produced:  number;
  sold:      number;
  returned:  number;
  replaced:  number;
  wasted:    number;
  closing:   number;
}

export interface InventorySnapshot {
  period: Period;
  windowStart: Date;
  windowEnd: Date;
  rows: ProductInventoryRow[];
  prev: Map<string, ProductInventoryRow>;
}

type SupabaseSrv = Awaited<ReturnType<typeof createClient>>;
type LineRow = { qty: number; base_qty: number; line_type: string; visits: { visited_at: string } | null };

async function buildRow(
  supabase: SupabaseSrv,
  product: { id: string; name_ar: string; base_unit: "L"|"kg"|"piece" },
  windowStart: Date,
  windowEnd: Date,
): Promise<ProductInventoryRow> {
  // Opening = all activity strictly before windowStart
  const [prodAllRes, linesAllRes] = await Promise.all([
    supabase.from("production").select("qty_produced, qty_wasted, produced_at").eq("product_id", product.id),
    supabase.from("visit_lines").select("qty, base_qty, line_type, visits(visited_at)").eq("product_id", product.id),
  ]);
  const allProd = (prodAllRes.data ?? []) as Array<{ qty_produced: number; qty_wasted: number; produced_at: string }>;
  const allLines = ((linesAllRes.data ?? []) as unknown as LineRow[]);

  const prodBefore = allProd.filter((p) => new Date(p.produced_at) < windowStart);
  const linesBefore = allLines.filter((l) => l.visits && new Date(l.visits.visited_at) < windowStart);
  const openingProduced = sumBy(prodBefore, (p) => Number(p.qty_produced));
  const openingWasted   = sumBy(prodBefore, (p) => Number(p.qty_wasted));
  const openingSold     = sumBy(linesBefore.filter((l) => l.line_type === "sale"),            (l) => Number(l.base_qty));
  const openingReplaced = sumBy(linesBefore.filter((l) => l.line_type === "replacement_out"), (l) => Number(l.base_qty));
  const opening = openingProduced - openingSold - openingReplaced - openingWasted;

  // Within-window activity
  const prodWin = allProd.filter((p) => new Date(p.produced_at) >= windowStart && new Date(p.produced_at) < windowEnd);
  const linesWin = allLines.filter((l) => l.visits && new Date(l.visits.visited_at) >= windowStart && new Date(l.visits.visited_at) < windowEnd);

  const produced = sumBy(prodWin, (p) => Number(p.qty_produced));
  const wasted   = sumBy(prodWin, (p) => Number(p.qty_wasted));
  const sold     = sumBy(linesWin.filter((l) => l.line_type === "sale"),            (l) => Number(l.base_qty));
  const returned = sumBy(linesWin.filter((l) => l.line_type === "return_in"),       (l) => Number(l.base_qty));
  const replaced = sumBy(linesWin.filter((l) => l.line_type === "replacement_out"), (l) => Number(l.base_qty));

  const closing = opening + produced - sold - replaced - wasted;

  return {
    product_id: product.id, name_ar: product.name_ar, base_unit: product.base_unit,
    opening, produced, sold, returned, replaced, wasted, closing,
  };
}

export async function getInventorySnapshot(period: Period, ref: Date = new Date()): Promise<InventorySnapshot> {
  const supabase = await createClient();
  const { start, end } = periodStartEnd(period, ref);
  const { start: prevStart, end: prevEnd } = periodStartEnd(period, previousPeriod(period, ref));

  const { data: productsData } = await supabase.from("products").select("id, name_ar, base_unit").eq("is_active", true).order("name_ar");
  const products = (productsData ?? []) as Array<{ id: string; name_ar: string; base_unit: "L"|"kg"|"piece" }>;

  const rows     = await Promise.all(products.map((p) => buildRow(supabase, p, start, end)));
  const prevRows = await Promise.all(products.map((p) => buildRow(supabase, p, prevStart, prevEnd)));
  const prevMap  = new Map<string, ProductInventoryRow>(prevRows.map((r) => [r.product_id, r]));

  return { period, windowStart: start, windowEnd: end, rows, prev: prevMap };
}
