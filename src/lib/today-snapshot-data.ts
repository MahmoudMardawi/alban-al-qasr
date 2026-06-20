import { createClient } from "@/lib/supabase/server";

export interface ActiveLoadSummary {
  load_id: string;
  employee_name: string;
  total_loaded_units: number;
  total_remaining_units: number;
  loaded_at: string;
}

export interface TopVisitToday {
  visit_id: string;
  client_name: string;
  amount: number;
}

export interface TodaySnapshot {
  date: string;
  sales_today: number;
  cash_collected_today: number;
  visits_today: number;
  active_loads: ActiveLoadSummary[];
  units_on_road: number;            // total base units across all open loads
  top_visit: TopVisitToday | null;
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const supabase = await createClient();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [visitsRes, paymentsRes, loadsRes] = await Promise.all([
    supabase.from("visits")
      .select("id, client_id, clients(name), visit_lines(line_type, qty, unit_price)")
      .gte("visited_at", dayStart).lt("visited_at", dayEnd),
    supabase.from("payments").select("amount")
      .gte("paid_at", dayStart).lt("paid_at", dayEnd),
    supabase.from("truck_loads")
      .select("id, loaded_at, employee_id, users(full_name), truck_load_items(product_id, qty_loaded, qty_returned)")
      .eq("status", "open"),
  ]);

  type V = {
    id: string;
    client_id: string;
    clients: { name: string } | null;
    visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null }>;
  };
  const visits = (visitsRes.data ?? []) as unknown as V[];

  let salesToday = 0;
  let topVisit: TopVisitToday | null = null;
  for (const v of visits) {
    const total = v.visit_lines
      .filter((l) => l.line_type === "sale")
      .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0);
    salesToday += total;
    if (total > 0 && (!topVisit || total > topVisit.amount)) {
      topVisit = { visit_id: v.id, client_name: v.clients?.name ?? "?", amount: total };
    }
  }

  const payments = (paymentsRes.data ?? []) as Array<{ amount: number }>;
  const cashCollectedToday = payments.reduce((s, p) => s + Number(p.amount), 0);

  // For each open load, compute remaining = loaded - returned - sold by employee today
  type LoadRow = {
    id: string;
    loaded_at: string;
    employee_id: string;
    users: { full_name: string } | null;
    truck_load_items: Array<{ product_id: string; qty_loaded: number; qty_returned: number }>;
  };
  const loads = (loadsRes.data ?? []) as unknown as LoadRow[];

  // Pre-compute sold-today by employee+product (only the load.loaded_at day matters for shortage,
  // but for today's snapshot we use today's window which is what the driver cares about)
  const visitsByEmployeeRes = loads.length === 0 ? null : await supabase.from("visits")
    .select("employee_id, visit_lines(product_id, base_qty, line_type)")
    .gte("visited_at", dayStart).lt("visited_at", dayEnd);
  type VBy = { employee_id: string; visit_lines: Array<{ product_id: string; base_qty: number; line_type: string }> };
  const visitsByEmp = (visitsByEmployeeRes?.data ?? []) as unknown as VBy[];

  const soldByEmpProd = new Map<string, Map<string, number>>();
  for (const v of visitsByEmp) {
    const m = soldByEmpProd.get(v.employee_id) ?? new Map<string, number>();
    for (const l of v.visit_lines) {
      if (l.line_type === "sale" || l.line_type === "replacement_out") {
        m.set(l.product_id, (m.get(l.product_id) ?? 0) + Number(l.base_qty));
      }
    }
    soldByEmpProd.set(v.employee_id, m);
  }

  let unitsOnRoad = 0;
  const activeLoads: ActiveLoadSummary[] = loads
    .filter((l) => l.loaded_at === todayDate)   // active = today's still-open loads
    .map((l) => {
      const soldMap = soldByEmpProd.get(l.employee_id) ?? new Map<string, number>();
      const totalLoaded    = l.truck_load_items.reduce((s, i) => s + Number(i.qty_loaded), 0);
      const totalRemaining = l.truck_load_items.reduce((s, i) => {
        const sold = soldMap.get(i.product_id) ?? 0;
        return s + Math.max(0, Number(i.qty_loaded) - Number(i.qty_returned) - sold);
      }, 0);
      unitsOnRoad += totalRemaining;
      return {
        load_id:               l.id,
        employee_name:         l.users?.full_name ?? "?",
        total_loaded_units:    totalLoaded,
        total_remaining_units: totalRemaining,
        loaded_at:             l.loaded_at,
      };
    });

  return {
    date: todayDate,
    sales_today: salesToday,
    cash_collected_today: cashCollectedToday,
    visits_today: visits.length,
    active_loads: activeLoads,
    units_on_road: unitsOnRoad,
    top_visit: topVisit,
  };
}
