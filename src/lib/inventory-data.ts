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

export interface OpenLoadSummary {
  load_id: string;
  loaded_at: string;
  employee_name: string;
  items: Array<{
    product_id: string;
    product_name: string;
    qty_loaded: number;
    qty_returned: number;
    qty_sold: number;        // sold/distributed via visits today by this employee
    qty_on_truck: number;    // loaded - returned - sold
  }>;
}

export interface InventorySnapshot {
  period: Period;
  windowStart: Date;
  windowEnd: Date;
  rows: ProductInventoryRow[];
  prev: Map<string, ProductInventoryRow>;
  openLoads: OpenLoadSummary[];
  /** product_id -> sum of qty_on_truck across all open loads */
  onTruckByProduct: Map<string, number>;
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

async function fetchOpenLoads(supabase: SupabaseSrv): Promise<OpenLoadSummary[]> {
  const { data: loadsData } = await supabase
    .from("truck_loads")
    .select(`
      id, loaded_at, employee_id,
      users(full_name),
      truck_load_items(product_id, qty_loaded, qty_returned, products(name_ar))
    `)
    .eq("status", "open")
    .order("loaded_at", { ascending: false });

  type LoadRow = {
    id: string;
    loaded_at: string;
    employee_id: string;
    users: { full_name: string } | null;
    truck_load_items: Array<{
      product_id: string;
      qty_loaded: number;
      qty_returned: number;
      products: { name_ar: string } | null;
    }>;
  };
  const loads = (loadsData ?? []) as unknown as LoadRow[];
  if (loads.length === 0) return [];

  const summaries: OpenLoadSummary[] = [];
  for (const load of loads) {
    const dayStart = new Date(load.loaded_at + "T00:00:00").toISOString();
    const dayEnd   = new Date(new Date(load.loaded_at + "T00:00:00").getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: visitsData } = await supabase
      .from("visits")
      .select("visit_lines(product_id, base_qty, line_type)")
      .eq("employee_id", load.employee_id)
      .gte("visited_at", dayStart)
      .lt("visited_at", dayEnd);
    type V = { visit_lines: Array<{ product_id: string; base_qty: number; line_type: string }> };
    const visits = (visitsData ?? []) as unknown as V[];

    const soldByProduct = new Map<string, number>();
    for (const v of visits) for (const l of v.visit_lines) {
      if (l.line_type === "sale" || l.line_type === "replacement_out") {
        soldByProduct.set(l.product_id, (soldByProduct.get(l.product_id) ?? 0) + Number(l.base_qty));
      }
    }

    summaries.push({
      load_id:       load.id,
      loaded_at:     load.loaded_at,
      employee_name: load.users?.full_name ?? "?",
      items: load.truck_load_items.map((i) => {
        const loaded   = Number(i.qty_loaded);
        const returned = Number(i.qty_returned);
        const sold     = soldByProduct.get(i.product_id) ?? 0;
        return {
          product_id:   i.product_id,
          product_name: i.products?.name_ar ?? "?",
          qty_loaded:   loaded,
          qty_returned: returned,
          qty_sold:     sold,
          qty_on_truck: loaded - returned - sold,
        };
      }),
    });
  }
  return summaries;
}

export async function getInventorySnapshot(period: Period, ref: Date = new Date()): Promise<InventorySnapshot> {
  const supabase = await createClient();
  const { start, end } = periodStartEnd(period, ref);
  const { start: prevStart, end: prevEnd } = periodStartEnd(period, previousPeriod(period, ref));

  const { data: productsData } = await supabase.from("products").select("id, name_ar, base_unit").eq("is_active", true).order("name_ar");
  const products = (productsData ?? []) as Array<{ id: string; name_ar: string; base_unit: "L"|"kg"|"piece" }>;

  const [rows, prevRows, openLoads] = await Promise.all([
    Promise.all(products.map((p) => buildRow(supabase, p, start, end))),
    Promise.all(products.map((p) => buildRow(supabase, p, prevStart, prevEnd))),
    fetchOpenLoads(supabase),
  ]);
  const prevMap = new Map<string, ProductInventoryRow>(prevRows.map((r) => [r.product_id, r]));

  const onTruckByProduct = new Map<string, number>();
  for (const load of openLoads) for (const item of load.items) {
    onTruckByProduct.set(item.product_id, (onTruckByProduct.get(item.product_id) ?? 0) + item.qty_on_truck);
  }

  return { period, windowStart: start, windowEnd: end, rows, prev: prevMap, openLoads, onTruckByProduct };
}
