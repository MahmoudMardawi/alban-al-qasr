import { createClient } from "@/lib/supabase/server";

export interface CashBoxSession {
  id: string;
  employee_id: string;
  employee_name: string;
  session_date: string;
  status: "open" | "closed";
  opening_float: number;
  closing_actual: number | null;
  closed_at: string | null;
  notes: string | null;
}

export interface CashBoxReconciliation {
  session: CashBoxSession;
  cash_collected: number;        // payments method='cash' tied to this employee's visits today
  cash_spent: number;            // expenses recorded by this employee today
  closing_expected: number;      // opening + collected - spent
  diff: number | null;           // expected - actual (positive = shortage, negative = extra cash)
  movements: Array<{
    kind: "opening" | "payment" | "expense" | "closing";
    label: string;
    amount: number;               // positive = inflow, negative = outflow
    at: string;                   // ISO timestamp or date
    ref_id?: string;
  }>;
}

function dayBoundsIso(date: string): { startIso: string; endIso: string } {
  const [y, m, d] = date.split("-").map(Number);
  return {
    startIso: new Date(y, m - 1, d).toISOString(),
    endIso:   new Date(y, m - 1, d + 1).toISOString(),
  };
}

export async function getCashBoxReconciliation(sessionId: string): Promise<CashBoxReconciliation | null> {
  const supabase = await createClient();
  const { data: sess } = await supabase
    .from("cash_box_sessions")
    .select("id, employee_id, session_date, status, opening_float, closing_actual, closed_at, notes, users(full_name)")
    .eq("id", sessionId)
    .single();
  if (!sess) return null;

  type S = {
    id: string; employee_id: string; session_date: string; status: "open" | "closed";
    opening_float: number; closing_actual: number | null; closed_at: string | null; notes: string | null;
    users: { full_name: string } | null;
  };
  const s = sess as unknown as S;

  const { startIso, endIso } = dayBoundsIso(s.session_date);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const paymentsTable = supabase.from("payments") as any;

  const [paymentsRes, expensesRes, disbursementsRes] = await Promise.all([
    paymentsTable
      .select("id, amount, paid_at, note, method, kind, clients(name), visits!inner(employee_id)")
      .gte("paid_at", startIso).lt("paid_at", endIso)
      .eq("method", "cash")
      .eq("kind", "receipt"),
    supabase.from("expenses")
      .select("id, amount, spent_at, note, category, recorded_by")
      .gte("spent_at", startIso).lt("spent_at", endIso)
      .eq("recorded_by", s.employee_id),
    paymentsTable
      .select("id, amount, paid_at, note, method, kind, clients(name), recorded_by")
      .gte("paid_at", startIso).lt("paid_at", endIso)
      .eq("method", "cash")
      .eq("kind", "disbursement")
      .eq("recorded_by", s.employee_id),
  ]);

  type Pay = { id: string; amount: number; paid_at: string; note: string | null; method: string; kind: string; clients: { name: string } | null; visits: { employee_id: string } | null };
  const allCashReceipts = (paymentsRes.data ?? []) as unknown as Pay[];
  const employeeReceipts = allCashReceipts.filter((p) => p.visits?.employee_id === s.employee_id);

  type Disb = { id: string; amount: number; paid_at: string; note: string | null; method: string; kind: string; clients: { name: string } | null; recorded_by: string };
  const disbursements = (disbursementsRes.data ?? []) as unknown as Disb[];

  type Exp = { id: string; amount: number; spent_at: string; note: string | null; category: string; recorded_by: string };
  const expenses = (expensesRes.data ?? []) as Exp[];

  const cashCollected = employeeReceipts.reduce((sum, p) => sum + Number(p.amount), 0);
  const cashSpent     = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
                      + disbursements.reduce((sum, d) => sum + Number(d.amount), 0);
  const closingExpected = Number(s.opening_float) + cashCollected - cashSpent;
  const diff = s.closing_actual !== null ? closingExpected - Number(s.closing_actual) : null;

  const movements: CashBoxReconciliation["movements"] = [
    { kind: "opening" as const, label: "رصيد افتتاحي (فلوس فكّة)", amount: Number(s.opening_float), at: s.session_date },
    ...employeeReceipts.map((p) => ({
      kind: "payment" as const,
      label: `قبض من ${p.clients?.name ?? "زبون"}${p.note ? ` · ${p.note}` : ""}`,
      amount: Number(p.amount),
      at: p.paid_at,
      ref_id: p.id,
    })),
    ...disbursements.map((d) => ({
      kind: "expense" as const,
      label: `صرف للزبون ${d.clients?.name ?? "—"}${d.note ? ` · ${d.note}` : ""}`,
      amount: -Number(d.amount),
      at: d.paid_at,
      ref_id: d.id,
    })),
    ...expenses.map((e) => ({
      kind: "expense" as const,
      label: `صرف · ${e.category}${e.note ? ` · ${e.note}` : ""}`,
      amount: -Number(e.amount),
      at: e.spent_at,
      ref_id: e.id,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (s.closing_actual !== null) {
    movements.push({
      kind: "closing" as const,
      label: `إقفال — العدّ الفعلي${diff !== null && diff !== 0 ? (diff > 0 ? ` (عجز ${diff.toFixed(2)})` : ` (زيادة ${(-diff).toFixed(2)})`) : ""}`,
      amount: -Number(s.closing_actual),
      at: s.closed_at ?? s.session_date,
    });
  }

  return {
    session: {
      id:              s.id,
      employee_id:     s.employee_id,
      employee_name:   s.users?.full_name ?? "?",
      session_date:    s.session_date,
      status:          s.status,
      opening_float:   Number(s.opening_float),
      closing_actual:  s.closing_actual !== null ? Number(s.closing_actual) : null,
      closed_at:       s.closed_at,
      notes:           s.notes,
    },
    cash_collected:    cashCollected,
    cash_spent:        cashSpent,
    closing_expected:  closingExpected,
    diff,
    movements,
  };
}

export async function listCashBoxSessions(scope: { employeeId?: string; date?: string }): Promise<CashBoxSession[]> {
  const supabase = await createClient();
  let q = supabase.from("cash_box_sessions")
    .select("id, employee_id, session_date, status, opening_float, closing_actual, closed_at, notes, users(full_name)")
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (scope.employeeId) q = q.eq("employee_id", scope.employeeId);
  if (scope.date)       q = q.eq("session_date", scope.date);
  const { data } = await q;
  type Row = {
    id: string; employee_id: string; session_date: string; status: "open" | "closed";
    opening_float: number; closing_actual: number | null; closed_at: string | null; notes: string | null;
    users: { full_name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, employee_id: r.employee_id, session_date: r.session_date, status: r.status,
    opening_float: Number(r.opening_float),
    closing_actual: r.closing_actual !== null ? Number(r.closing_actual) : null,
    closed_at: r.closed_at, notes: r.notes,
    employee_name: r.users?.full_name ?? "?",
  }));
}
