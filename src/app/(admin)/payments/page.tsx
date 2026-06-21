import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, Receipt, Banknote, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDateShort, formatInvoiceNo } from "@/lib/format";

export const dynamic = "force-dynamic";

const METHOD_AR: Record<string, string> = {
  cash:     "نقدًا",
  transfer: "تحويل بنكي",
  other:    "أخرى",
};

export default async function PaymentsList() {
  const supabase = await createClient();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const paymentsTable = supabase.from("payments") as any;
  const { data } = await paymentsTable
    .select("id, amount, paid_at, method, kind, note, visit_id, clients(name), visits(invoice_no)")
    .order("paid_at", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    kind: "receipt" | "disbursement";
    note: string | null;
    visit_id: string | null;
    clients: { name: string } | null;
    visits: { invoice_no: number } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const receipts      = rows.filter((r) => r.kind === "receipt"     && !r.visit_id);
  const disbursements = rows.filter((r) => r.kind === "disbursement");
  const linked        = rows.filter((r) => r.kind === "receipt"     &&  r.visit_id);

  return (
    <div className="pb-4">
      <div className="px-4 py-3">
        <h2 className="font-cairo font-bold text-ink text-base mb-2">سندات الدفع ({rows.length})</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/payments/new" className="flex items-center justify-center gap-1 text-xs font-cairo font-bold text-white bg-primary px-3 py-2.5 rounded-xl">
            <ArrowDownToLine size={14} /> سند قبض
          </Link>
          <Link href="/payments/disbursement/new" className="flex items-center justify-center gap-1 text-xs font-cairo font-bold text-white bg-warn px-3 py-2.5 rounded-xl">
            <ArrowUpFromLine size={14} /> سند صرف
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title="لا توجد سندات" subtitle="سجّل أول تحصيل أو صرف" ctaHref="/payments/new" ctaLabel="سند قبض جديد" />
      ) : (
        <>
          {receipts.length > 0 && (
            <div className="px-3 mb-4">
              <h3 className="text-[11px] font-cairo font-bold text-muted uppercase mb-2 px-1">سندات قبض (تحصيلات مستقلة) ({receipts.length})</h3>
              <ul className="space-y-2">
                {receipts.map((r) => (
                  <li key={r.id}>
                    <Link href={`/payments/${r.id}`} className="block bg-white border border-border rounded-2xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-cairo font-semibold text-ink text-sm">{r.clients?.name ?? "—"}</div>
                          <div className="text-[10px] text-muted font-cairo mt-0.5">
                            {formatDateShort(new Date(r.paid_at))} · {METHOD_AR[r.method] ?? r.method}
                            {r.note ? ` · ${r.note}` : ""}
                          </div>
                        </div>
                        <div className="font-cairo font-extrabold text-primary text-base" dir="ltr">+{formatCurrency(Number(r.amount))}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {disbursements.length > 0 && (
            <div className="px-3 mb-4">
              <h3 className="text-[11px] font-cairo font-bold text-muted uppercase mb-2 px-1">سندات صرف للزبائن ({disbursements.length})</h3>
              <ul className="space-y-2">
                {disbursements.map((r) => (
                  <li key={r.id}>
                    <Link href={`/payments/${r.id}`} className="block bg-orange-50 border border-orange-200 rounded-2xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-cairo font-semibold text-ink text-sm">{r.clients?.name ?? "—"}</div>
                          <div className="text-[10px] text-muted font-cairo mt-0.5">
                            {formatDateShort(new Date(r.paid_at))}
                            {r.note ? ` · ${r.note}` : ""}
                          </div>
                        </div>
                        <div className="font-cairo font-extrabold text-warn text-base" dir="ltr">−{formatCurrency(Number(r.amount))}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {linked.length > 0 && (
            <div className="px-3">
              <h3 className="text-[11px] font-cairo font-bold text-muted uppercase mb-2 px-1">مدفوعات مرتبطة بفواتير ({linked.length})</h3>
              <ul className="space-y-1.5">
                {linked.map((r) => (
                  <li key={r.id} className="bg-white border border-border rounded-xl p-2.5 flex items-center justify-between text-xs font-cairo">
                    <div className="flex items-center gap-2 min-w-0">
                      <Banknote size={14} className="text-primary shrink-0" />
                      <span className="text-ink font-semibold truncate">{r.clients?.name ?? "—"}</span>
                      <span className="text-[10px] text-primary-dk bg-primary/10 px-1.5 py-0.5 rounded shrink-0" dir="ltr">
                        {formatInvoiceNo(r.visits?.invoice_no)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted text-[10px]">{formatDateShort(new Date(r.paid_at))}</span>
                      <span className="text-primary font-bold" dir="ltr">+{formatCurrency(Number(r.amount))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
