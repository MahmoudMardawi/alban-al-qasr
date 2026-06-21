import { createClient } from "@/lib/supabase/server";

// ============================================================
// Damaged returns report
// Source: visit_lines with line_type='return_in'
//   - Each entry = a customer returning damaged product on a visit
//   - Value = base_qty × product.base_price
// Aggregates per-customer per-product, plus product totals + grand total.
// ============================================================

export interface DamagedReturnEntry {
  visit_id: string;
  invoice_no: number;
  visited_at: string;
  client_id: string;
  client_name: string;
  product_id: string;
  product_name: string;
  qty: number;
  value: number;
}

export interface DamagedReturnsReport {
  startIso: string;
  endIso: string;
  entries: DamagedReturnEntry[];
  byProduct: Array<{ product: string; qty: number; value: number }>;
  byClient: Array<{ client: string; qty: number; value: number }>;
  totals: { qty: number; value: number };
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getDamagedReturns(startIso: string, endIso: string): Promise<DamagedReturnsReport> {
  const supabase = await createClient();
  const start = parseIso(startIso);
  const endInclusive = parseIso(endIso);
  const end = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate() + 1);

  const { data } = await supabase
    .from("visits")
    .select(`
      id, invoice_no, visited_at, client_id,
      clients(name),
      visit_lines!inner(product_id, base_qty, line_type, products(name_ar, base_price))
    `)
    .gte("visited_at", start.toISOString())
    .lt("visited_at",  end.toISOString())
    .eq("visit_lines.line_type", "return_in");

  type V = {
    id: string; invoice_no: number; visited_at: string; client_id: string;
    clients: { name: string } | null;
    visit_lines: Array<{ product_id: string; base_qty: number; line_type: string; products: { name_ar: string; base_price: number } | null }>;
  };
  const visits = (data ?? []) as unknown as V[];

  const entries: DamagedReturnEntry[] = [];
  for (const v of visits) {
    for (const l of v.visit_lines) {
      if (l.line_type !== "return_in") continue;
      const qty   = Number(l.base_qty);
      const price = Number(l.products?.base_price ?? 0);
      entries.push({
        visit_id:     v.id,
        invoice_no:   v.invoice_no,
        visited_at:   v.visited_at,
        client_id:    v.client_id,
        client_name:  v.clients?.name ?? "?",
        product_id:   l.product_id,
        product_name: l.products?.name_ar ?? "?",
        qty,
        value:        qty * price,
      });
    }
  }

  entries.sort((a, b) => b.visited_at.localeCompare(a.visited_at));

  const prodMap   = new Map<string, { product: string; qty: number; value: number }>();
  const clientMap = new Map<string, { client: string; qty: number; value: number }>();
  for (const e of entries) {
    const p = prodMap.get(e.product_id) ?? { product: e.product_name, qty: 0, value: 0 };
    p.qty += e.qty; p.value += e.value; prodMap.set(e.product_id, p);
    const c = clientMap.get(e.client_id) ?? { client: e.client_name, qty: 0, value: 0 };
    c.qty += e.qty; c.value += e.value; clientMap.set(e.client_id, c);
  }
  const byProduct = Array.from(prodMap.values()).sort((a, b) => b.value - a.value);
  const byClient  = Array.from(clientMap.values()).sort((a, b) => b.value - a.value);

  const totals = {
    qty:   entries.reduce((s, e) => s + e.qty, 0),
    value: entries.reduce((s, e) => s + e.value, 0),
  };

  return { startIso, endIso, entries, byProduct, byClient, totals };
}

export function defaultDamagedRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: isoDate(start), end: isoDate(now) };
}
