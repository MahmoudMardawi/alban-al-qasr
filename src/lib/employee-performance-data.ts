import { createClient } from "@/lib/supabase/server";

export interface EmployeePerformanceRow {
  employee_id: string;
  employee_name: string;
  role: "admin" | "employee";
  visits_count: number;
  sales_total: number;
  avg_visit_value: number;          // sales_total / visits_count (0 if no visits)
  cash_collected: number;           // payments tied to a visit by this employee
  returns_units: number;            // base units returned
  // From closed truck loads in the period
  total_loaded_units: number;
  total_returned_units: number;
  total_shortage_units: number;     // loaded - returned - sold
  loads_closed: number;
}

export interface EmployeePerformanceReport {
  startIso: string;
  endIso: string;
  windowStart: Date;
  windowEnd: Date;
  rows: EmployeePerformanceRow[];
  totals: {
    visits: number;
    sales: number;
    cash_collected: number;
    shortage: number;
  };
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getEmployeePerformance(startIso: string, endIso: string): Promise<EmployeePerformanceReport> {
  const supabase = await createClient();
  const start = parseIso(startIso);
  const endInclusive = parseIso(endIso);
  const end = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate() + 1);

  const [usersRes, visitsRes, paymentsRes, loadsRes] = await Promise.all([
    supabase.from("users").select("id, full_name, role").eq("is_active", true),
    supabase.from("visits")
      .select("id, employee_id, visit_lines(line_type, qty, unit_price, base_qty, product_id)")
      .gte("visited_at", start.toISOString()).lt("visited_at", end.toISOString()),
    supabase.from("payments")
      .select("amount, visit_id, visits(employee_id)")
      .gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()),
    supabase.from("truck_loads")
      .select("id, employee_id, loaded_at, status, truck_load_items(product_id, qty_loaded, qty_returned)")
      .gte("loaded_at", start.toISOString().slice(0, 10))
      .lt("loaded_at",  end.toISOString().slice(0, 10))
      .eq("status", "closed"),
  ]);

  const users = (usersRes.data ?? []) as Array<{ id: string; full_name: string; role: "admin" | "employee" }>;

  type V = {
    id: string;
    employee_id: string;
    visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null; base_qty: number; product_id: string }>;
  };
  const visits = (visitsRes.data ?? []) as unknown as V[];

  type P = { amount: number; visit_id: string | null; visits: { employee_id: string } | null };
  const payments = (paymentsRes.data ?? []) as unknown as P[];

  type Load = {
    id: string;
    employee_id: string;
    loaded_at: string;
    truck_load_items: Array<{ product_id: string; qty_loaded: number; qty_returned: number }>;
  };
  const loads = (loadsRes.data ?? []) as unknown as Load[];

  // Build per-employee aggregations
  const byEmp = new Map<string, EmployeePerformanceRow>();
  for (const u of users) {
    byEmp.set(u.id, {
      employee_id: u.id,
      employee_name: u.full_name,
      role: u.role,
      visits_count: 0,
      sales_total: 0,
      avg_visit_value: 0,
      cash_collected: 0,
      returns_units: 0,
      total_loaded_units: 0,
      total_returned_units: 0,
      total_shortage_units: 0,
      loads_closed: 0,
    });
  }

  // Visits + sales + returns
  // Also: track sold-units per (employee, product, load_date) for shortage calc
  const soldByEmpDateProd = new Map<string, Map<string, Map<string, number>>>();
  for (const v of visits) {
    const row = byEmp.get(v.employee_id);
    if (!row) continue;
    const saleTotal = v.visit_lines
      .filter((l) => l.line_type === "sale")
      .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0);
    row.visits_count += 1;
    row.sales_total  += saleTotal;
    row.returns_units += v.visit_lines
      .filter((l) => l.line_type === "return_in")
      .reduce((s, l) => s + Number(l.base_qty), 0);
  }

  // Payments (cash collected) — only when tied to a visit (which is when we know the employee)
  for (const p of payments) {
    const empId = p.visits?.employee_id;
    if (!empId) continue;
    const row = byEmp.get(empId);
    if (!row) continue;
    row.cash_collected += Number(p.amount);
  }

  // Truck loads — aggregate loaded/returned per employee
  // For shortage we need sold-by-this-employee on that load_date, across products on the load.
  // Pull all visits in the load_date range (one DB pass per load is wasteful — bulk query instead)
  if (loads.length > 0) {
    const loadDates = Array.from(new Set(loads.map((l) => l.loaded_at)));
    const loadDateMin = loadDates.sort()[0];
    const loadDateMax = loadDates.sort()[loadDates.length - 1];
    const visitsForLoadsRes = await supabase.from("visits")
      .select("employee_id, visited_at, visit_lines(product_id, base_qty, line_type)")
      .gte("visited_at", new Date(loadDateMin + "T00:00:00").toISOString())
      .lt("visited_at",  new Date(new Date(loadDateMax + "T00:00:00").getTime() + 24 * 60 * 60 * 1000).toISOString());
    type VL = { employee_id: string; visited_at: string; visit_lines: Array<{ product_id: string; base_qty: number; line_type: string }> };
    const visitsForLoads = (visitsForLoadsRes.data ?? []) as unknown as VL[];

    for (const v of visitsForLoads) {
      const dayKey = v.visited_at.slice(0, 10);
      const byDate = soldByEmpDateProd.get(v.employee_id) ?? new Map<string, Map<string, number>>();
      const byProd = byDate.get(dayKey) ?? new Map<string, number>();
      for (const l of v.visit_lines) {
        if (l.line_type === "sale" || l.line_type === "replacement_out") {
          byProd.set(l.product_id, (byProd.get(l.product_id) ?? 0) + Number(l.base_qty));
        }
      }
      byDate.set(dayKey, byProd);
      soldByEmpDateProd.set(v.employee_id, byDate);
    }

    for (const load of loads) {
      const row = byEmp.get(load.employee_id);
      if (!row) continue;
      const soldMap = soldByEmpDateProd.get(load.employee_id)?.get(load.loaded_at) ?? new Map<string, number>();
      let loadedSum = 0, returnedSum = 0, shortage = 0;
      for (const item of load.truck_load_items) {
        const loaded   = Number(item.qty_loaded);
        const returned = Number(item.qty_returned);
        const sold     = soldMap.get(item.product_id) ?? 0;
        loadedSum   += loaded;
        returnedSum += returned;
        shortage    += Math.max(0, loaded - returned - sold);   // only positive (lost) counts as shortage
      }
      row.total_loaded_units   += loadedSum;
      row.total_returned_units += returnedSum;
      row.total_shortage_units += shortage;
      row.loads_closed         += 1;
    }
  }

  // Derive avg + filter out users with no activity, then sort
  const rows = Array.from(byEmp.values())
    .map((r) => ({ ...r, avg_visit_value: r.visits_count > 0 ? r.sales_total / r.visits_count : 0 }))
    .filter((r) => r.visits_count > 0 || r.cash_collected > 0 || r.loads_closed > 0)
    .sort((a, b) => b.sales_total - a.sales_total);

  const totals = {
    visits:          rows.reduce((s, r) => s + r.visits_count, 0),
    sales:           rows.reduce((s, r) => s + r.sales_total, 0),
    cash_collected:  rows.reduce((s, r) => s + r.cash_collected, 0),
    shortage:        rows.reduce((s, r) => s + r.total_shortage_units, 0),
  };

  return { startIso, endIso, windowStart: start, windowEnd: end, rows, totals };
}
