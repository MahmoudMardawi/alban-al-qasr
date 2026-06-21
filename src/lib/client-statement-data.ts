import { createClient } from "@/lib/supabase/server";

// ============================================================
// Client statement — T-account view (Ahmad's spec):
//
//   تاريخ │ نوع السند             │ مدين  │ دائن  │ الرصيد
//   ──────┼───────────────────────┼───────┼───────┼─────────
//   ...   │ فاتورة مبيعات          │       │  X    │  +X
//   ...   │ سند قبض                │  Y    │       │  +X−Y
//   ...   │ مردود مبيعات            │  Z    │       │  +X−Y−Z
//   ...   │ سند صرف                │       │  W    │  +X−Y−Z+W
//
// Mapping:
//   فاتورة مبيعات (sale)              → دائن  (client owes more)
//   سند قبض (receipt voucher)         → مدين  (client owes less)
//   مردود مبيعات (return_in line)      → مدين  (credit back; client owes less)
//   سند صرف (disbursement voucher)    → دائن  (refund of overcollection / damage compensation;
//                                             creates obligation we owe them — treated as adding
//                                             to what they owe per Ahmad's bookkeeping)
//
// Running balance = Σدائن − Σمدين. Positive = client owes us.
// ============================================================

export type StatementEntryType = "sale" | "receipt" | "sales_return" | "disbursement";

export interface StatementEntry {
  date: string;            // ISO timestamp
  type: StatementEntryType;
  type_label: string;
  reference: string | null; // e.g., invoice #, voucher #
  note: string | null;
  debit: number;            // مدين
  credit: number;           // دائن
  balance: number;          // running balance after this entry
}

export interface ClientStatement {
  client: { id: string; name: string; phone: string | null; address: string | null };
  startIso: string;
  endIso: string;
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
  entries: StatementEntry[];
}

const TYPE_LABEL: Record<StatementEntryType, string> = {
  sale:          "فاتورة مبيعات",
  receipt:       "سند قبض",
  sales_return:  "مردود مبيعات",
  disbursement:  "سند صرف",
};

function isoDateOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getClientStatement(clientId: string, startIso: string, endIso: string): Promise<ClientStatement | null> {
  const supabase = await createClient();

  const start = parseIsoDate(startIso);
  const endInclusive = parseIsoDate(endIso);
  const end = new Date(endInclusive.getFullYear(), endInclusive.getMonth(), endInclusive.getDate() + 1);

  const { data: clientData } = await supabase.from("clients")
    .select("id, name, phone, address")
    .eq("id", clientId)
    .single();
  if (!clientData) return null;

  // Pull ALL transactions for this client (we filter by date in-memory and compute opening balance separately)
  const [visitsRes, paymentsRes] = await Promise.all([
    supabase.from("visits")
      .select("id, invoice_no, visited_at, visit_lines(line_type, qty, unit_price, base_qty, product_id, products(name_ar, base_price))")
      .eq("client_id", clientId),
    supabase.from("payments")
      .select("id, amount, paid_at, method, kind, note, visit_id")
      .eq("client_id", clientId),
  ]);

  type Visit = {
    id: string;
    invoice_no: number;
    visited_at: string;
    visit_lines: Array<{
      line_type: string;
      qty: number;
      unit_price: number | null;
      base_qty: number;
      product_id: string;
      products: { name_ar: string; base_price: number } | null;
    }>;
  };
  const visits = (visitsRes.data ?? []) as unknown as Visit[];
  type Pay = { id: string; amount: number; paid_at: string; method: string; kind: "receipt" | "disbursement"; note: string | null; visit_id: string | null };
  const payments = (paymentsRes.data ?? []) as Pay[];

  // Flatten into entries (one per movement)
  type RawEntry = { date: string; type: StatementEntryType; reference: string | null; note: string | null; debit: number; credit: number };
  const raw: RawEntry[] = [];

  for (const v of visits) {
    const saleTotal = v.visit_lines
      .filter((l) => l.line_type === "sale")
      .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0);
    if (saleTotal > 0) {
      raw.push({
        date: v.visited_at,
        type: "sale",
        reference: `#${String(v.invoice_no).padStart(4, "0")}`,
        note: null,
        debit: 0,
        credit: saleTotal,
      });
    }

    // Returns (مردود مبيعات): valued at product's base_price
    const returnsValue = v.visit_lines
      .filter((l) => l.line_type === "return_in")
      .reduce((s, l) => s + Number(l.base_qty) * Number(l.products?.base_price ?? 0), 0);
    if (returnsValue > 0) {
      raw.push({
        date: v.visited_at,
        type: "sales_return",
        reference: `#${String(v.invoice_no).padStart(4, "0")}`,
        note: "مرتجع تالف",
        debit: returnsValue,
        credit: 0,
      });
    }
  }

  for (const p of payments) {
    if (p.kind === "disbursement") {
      raw.push({
        date: p.paid_at,
        type: "disbursement",
        reference: "سند صرف",
        note: p.note,
        debit: 0,
        credit: Number(p.amount),
      });
    } else {
      raw.push({
        date: p.paid_at,
        type: "receipt",
        reference: p.visit_id ? "مرفق بفاتورة" : "تحصيل ذمم",
        note: p.note,
        debit: Number(p.amount),
        credit: 0,
      });
    }
  }

  // Sort all entries chronologically
  raw.sort((a, b) => a.date.localeCompare(b.date));

  // Opening balance = sum of all entries strictly before startIso
  const startMs = start.getTime();
  const endMs = end.getTime();
  let opening = 0;
  const inRange: RawEntry[] = [];
  for (const r of raw) {
    const t = new Date(r.date).getTime();
    if (t < startMs) {
      opening += r.credit - r.debit;
    } else if (t < endMs) {
      inRange.push(r);
    }
  }

  // Build running-balance entries
  let running = opening;
  const entries: StatementEntry[] = inRange.map((r) => {
    running = running + r.credit - r.debit;
    return {
      date:        r.date,
      type:        r.type,
      type_label:  TYPE_LABEL[r.type],
      reference:   r.reference,
      note:        r.note,
      debit:       r.debit,
      credit:      r.credit,
      balance:     running,
    };
  });

  const totalDebit  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return {
    client: { id: clientData.id, name: clientData.name, phone: clientData.phone, address: clientData.address },
    startIso,
    endIso,
    opening_balance: opening,
    closing_balance: running,
    total_debit: totalDebit,
    total_credit: totalCredit,
    entries,
  };
}

export function defaultStatementRange(): { start: string; end: string } {
  const now = new Date();
  // Default = this year so the user sees the whole accumulated picture
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: isoDateOf(start), end: isoDateOf(now) };
}
