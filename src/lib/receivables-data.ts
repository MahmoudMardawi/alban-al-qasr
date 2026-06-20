import { createClient } from "@/lib/supabase/server";

export interface ReceivableRow {
  client_id: string;
  client_name: string;
  client_phone: string | null;
  balance_owed: number;                  // positive = owes us money
  days_since_last_payment: number | null; // null = never paid us
  days_since_oldest_unpaid_sale: number | null;
  last_payment_at: string | null;
  oldest_unpaid_sale_at: string | null;
  bucket: "current" | "30d" | "60d" | "90d" | "over_90d";
}

export interface ReceivablesReport {
  rows: ReceivableRow[];
  totals: {
    grand_total: number;
    by_bucket: Record<ReceivableRow["bucket"], number>;
    client_count_with_debt: number;
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function bucketize(daysOldest: number | null, daysLastPayment: number | null): ReceivableRow["bucket"] {
  // Use whichever signal is larger (more conservative — keeps the client in the worse bucket)
  const age = Math.max(daysOldest ?? 0, daysLastPayment ?? 0);
  if (age <= 30) return "current";
  if (age <= 60) return "30d";
  if (age <= 90) return "60d";
  if (age <= 180) return "90d";
  return "over_90d";
}

export async function getReceivablesReport(): Promise<ReceivablesReport> {
  const supabase = await createClient();
  const now = new Date();

  const [balRes, clientsRes, paymentsRes, visitsRes] = await Promise.all([
    supabase.from("v_client_money_balance").select("client_id, balance"),
    supabase.from("clients").select("id, name, phone").is("merged_into_client_id", null),
    supabase.from("payments").select("client_id, amount, paid_at"),
    // Pull visits with their credit-bearing sale total (we'll match against payments client-side)
    supabase.from("visits").select("id, client_id, visited_at, visit_lines(line_type, qty, unit_price)"),
  ]);

  const balRows = (balRes.data ?? []) as Array<{ client_id: string; balance: number }>;
  const clients = (clientsRes.data ?? []) as Array<{ id: string; name: string; phone: string | null }>;
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const payments = (paymentsRes.data ?? []) as Array<{ client_id: string; amount: number; paid_at: string }>;
  type VRow = { id: string; client_id: string; visited_at: string; visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null }> };
  const visits = (visitsRes.data ?? []) as unknown as VRow[];

  // Build per-client lookups
  const lastPaymentByClient = new Map<string, string>();
  for (const p of payments) {
    const cur = lastPaymentByClient.get(p.client_id);
    if (!cur || p.paid_at > cur) lastPaymentByClient.set(p.client_id, p.paid_at);
  }

  // Approximate "oldest unpaid sale" with a running balance walk per client:
  // sort sales by date ASC, sort payments by date ASC, walk together;
  // when balance goes positive, the visit that pushed it positive is the "oldest unpaid".
  const oldestUnpaidByClient = new Map<string, string>();
  const visitsByClient = new Map<string, VRow[]>();
  for (const v of visits) {
    const arr = visitsByClient.get(v.client_id) ?? [];
    arr.push(v);
    visitsByClient.set(v.client_id, arr);
  }
  const paymentsByClient = new Map<string, Array<{ amount: number; paid_at: string }>>();
  for (const p of payments) {
    const arr = paymentsByClient.get(p.client_id) ?? [];
    arr.push({ amount: Number(p.amount), paid_at: p.paid_at });
    paymentsByClient.set(p.client_id, arr);
  }

  for (const [clientId, clientVisits] of visitsByClient.entries()) {
    const sortedSales = clientVisits
      .map((v) => ({
        date: v.visited_at,
        amount: v.visit_lines
          .filter((l) => l.line_type === "sale")
          .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0),
      }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const sortedPays = (paymentsByClient.get(clientId) ?? []).slice().sort((a, b) => a.paid_at.localeCompare(b.paid_at));

    // Walk: at each sale, see how much pre-paid credit remains; if not enough, the unpaid remainder starts a debt
    let creditOnHand = 0;
    let payIdx = 0;
    let oldestUnpaidDate: string | null = null;
    for (const sale of sortedSales) {
      // Apply payments dated up to this sale date to creditOnHand
      while (payIdx < sortedPays.length && sortedPays[payIdx].paid_at <= sale.date) {
        creditOnHand += sortedPays[payIdx].amount;
        payIdx++;
      }
      const consumed = Math.min(creditOnHand, sale.amount);
      creditOnHand -= consumed;
      const unpaidFromThisSale = sale.amount - consumed;
      if (unpaidFromThisSale > 0 && !oldestUnpaidDate) {
        oldestUnpaidDate = sale.date;
      }
      // If oldestUnpaidDate is set, leave it. (We could try to "clear" it with later payments, but
      // we already computed authoritative balance from the view — this is just for aging buckets.)
    }
    // Apply remaining payments to clear the oldest-unpaid marker if balance ends up zero
    while (payIdx < sortedPays.length) {
      creditOnHand += sortedPays[payIdx].amount;
      payIdx++;
    }
    if (oldestUnpaidDate) oldestUnpaidByClient.set(clientId, oldestUnpaidDate);
  }

  const rows: ReceivableRow[] = [];
  const byBucket: Record<ReceivableRow["bucket"], number> = {
    current: 0, "30d": 0, "60d": 0, "90d": 0, over_90d: 0,
  };
  let grandTotal = 0;

  for (const b of balRows) {
    const balance = Number(b.balance);
    if (balance <= 0) continue;
    const c = clientById.get(b.client_id);
    if (!c) continue;

    const lastPay = lastPaymentByClient.get(b.client_id) ?? null;
    const oldestUnpaid = oldestUnpaidByClient.get(b.client_id) ?? null;
    const daysLastPay  = lastPay      ? Math.floor((now.getTime() - new Date(lastPay).getTime()) / MS_PER_DAY) : null;
    const daysOldest   = oldestUnpaid ? Math.floor((now.getTime() - new Date(oldestUnpaid).getTime()) / MS_PER_DAY) : null;
    const bucket = bucketize(daysOldest, daysLastPay);

    grandTotal += balance;
    byBucket[bucket] += balance;
    rows.push({
      client_id: b.client_id,
      client_name: c.name,
      client_phone: c.phone,
      balance_owed: balance,
      days_since_last_payment: daysLastPay,
      days_since_oldest_unpaid_sale: daysOldest,
      last_payment_at: lastPay,
      oldest_unpaid_sale_at: oldestUnpaid,
      bucket,
    });
  }

  // Sort by worst first: bucket weight desc, then balance desc
  const bucketWeight: Record<ReceivableRow["bucket"], number> = {
    over_90d: 5, "90d": 4, "60d": 3, "30d": 2, current: 1,
  };
  rows.sort((a, b) => {
    const w = bucketWeight[b.bucket] - bucketWeight[a.bucket];
    if (w !== 0) return w;
    return b.balance_owed - a.balance_owed;
  });

  return {
    rows,
    totals: {
      grand_total: grandTotal,
      by_bucket: byBucket,
      client_count_with_debt: rows.length,
    },
  };
}
