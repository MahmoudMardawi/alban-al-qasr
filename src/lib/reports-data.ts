import { createClient } from "@/lib/supabase/server";

export interface ReportFilters {
  start: string; end: string;
  clientId?: string | null;
  productId?: string | null;
  employeeId?: string | null;
}

export interface ReportRow {
  visit_id: string;
  invoice_no: number;
  visited_at: string;
  client_id: string;
  client_name: string;
  employee_name: string;
  sale_total: number;
  return_units: number;
  replacement_units: number;
  line_count: number;
}

export async function getReportRows(filters: ReportFilters): Promise<ReportRow[]> {
  const supabase = await createClient();
  let q = supabase.from("visits")
    .select("id, invoice_no, visited_at, client_id, employee_id, clients(name), users(full_name), visit_lines(qty, unit_price, line_type, product_id)")
    .gte("visited_at", new Date(filters.start + "T00:00:00").toISOString())
    .lt("visited_at",  new Date(filters.end   + "T23:59:59.999Z").toISOString())
    .order("visited_at", { ascending: false });

  if (filters.clientId)   q = q.eq("client_id",   filters.clientId);
  if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);

  const { data } = await q;
  type Row = {
    id: string; invoice_no: number; visited_at: string; client_id: string;
    clients: { name: string } | null; users: { full_name: string } | null;
    visit_lines: Array<{ qty: number; unit_price: number | null; line_type: string; product_id: string }>;
  };
  const rows = (data ?? []) as unknown as Row[];

  return rows
    .map((v) => {
      const lines = filters.productId ? v.visit_lines.filter((l) => l.product_id === filters.productId) : v.visit_lines;
      return {
        visit_id:           v.id,
        invoice_no:         v.invoice_no,
        visited_at:         v.visited_at,
        client_id:          v.client_id,
        client_name:        v.clients?.name ?? "?",
        employee_name:      v.users?.full_name ?? "?",
        sale_total:         lines.filter((l) => l.line_type === "sale").reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0),
        return_units:       lines.filter((l) => l.line_type === "return_in").reduce((s, l) => s + Number(l.qty), 0),
        replacement_units:  lines.filter((l) => l.line_type === "replacement_out").reduce((s, l) => s + Number(l.qty), 0),
        line_count:         lines.length,
      };
    })
    .filter((r) => r.line_count > 0);
}
