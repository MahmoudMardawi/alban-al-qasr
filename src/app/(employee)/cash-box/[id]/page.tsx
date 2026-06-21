import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Wallet, CheckCircle2 } from "lucide-react";
import { getCashBoxReconciliation } from "@/lib/cash-box-data";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { CloseSessionForm } from "./close-session-form";
import { QuickExpenseForm } from "./quick-expense-form";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function CashBoxSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recon = await getCashBoxReconciliation(id);
  if (!recon) return notFound();

  const { session, cash_collected, cash_spent, closing_expected, diff, movements } = recon;
  const isOpen = session.status === "open";

  // Build T-account rows with running balance
  type LedgerRow = { date: string; type: string; debit: number; credit: number; balance: number };
  let running = 0;
  const ledger: LedgerRow[] = movements.map((m) => {
    const debit  = m.amount > 0 ? m.amount  : 0;   // cash IN
    const credit = m.amount < 0 ? -m.amount : 0;   // cash OUT
    running += debit - credit;
    return { date: m.at, type: m.label, debit, credit, balance: running };
  });

  return (
    <div className="pb-4 print:pb-0">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white p-4 print:hidden">
        <div className="flex items-center justify-between mb-2">
          <Link href="/cash-box" className="flex items-center gap-1 text-xs text-white/80">
            <ArrowRight size={14} className="rotate-180" /> رجوع
          </Link>
          <PrintButton />
        </div>
        <div className="flex items-center gap-2">
          <Wallet size={22} />
          <h2 className="font-cairo font-bold text-lg">صندوق {session.employee_name}</h2>
        </div>
        <div className="text-[11px] opacity-80 mt-0.5" dir="ltr">
          {formatDateShort(new Date(session.session_date))} · {isOpen ? "مفتوح" : "مُغلق"}
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="font-display text-xl">كشف حساب صندوق المندوب</h1>
        <div className="font-cairo text-sm text-muted mt-1">{session.employee_name}</div>
        <div className="font-cairo text-[10px] text-muted" dir="ltr">{formatDateShort(new Date(session.session_date))}</div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3 print:px-8">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <SummaryTile label="افتتاحي" value={formatCurrency(session.opening_float)} />
          <SummaryTile label="تحصيل" value={formatCurrency(cash_collected)} color="text-primary-dk" />
          <SummaryTile label="صرف" value={formatCurrency(cash_spent)} color="text-warn" />
          <SummaryTile label="المتوقع" value={formatCurrency(closing_expected)} color="text-forest" bold />
        </div>

        {/* T-account ledger */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="bg-info-bg/60 px-3 py-2 font-cairo font-bold text-xs text-ink border-b border-border">
            كشف حساب الصندوق (مدين / دائن / رصيد)
          </div>
          {ledger.length === 0 ? (
            <p className="text-center text-muted text-xs py-6 font-cairo">لا توجد حركات</p>
          ) : (
            <table className="w-full text-xs font-cairo border-collapse">
              <thead className="bg-info-bg/40">
                <tr>
                  <th className="text-right p-2 border-b border-border">التاريخ</th>
                  <th className="text-right p-2 border-b border-border">نوع السند</th>
                  <th className="text-center p-2 border-b border-border w-24">مدين</th>
                  <th className="text-center p-2 border-b border-border w-24">دائن</th>
                  <th className="text-center p-2 border-b border-border w-24">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r, i) => (
                  <tr key={i} className="hover:bg-info-bg/30">
                    <td className="p-2 text-[10px] text-muted border-b border-border" dir="ltr">
                      {formatDateShort(new Date(r.date))}
                    </td>
                    <td className="p-2 text-ink border-b border-border">{r.type}</td>
                    <td className="p-2 text-center border-b border-border" dir="ltr">
                      {r.debit > 0 ? <span className="text-primary-dk font-bold">{formatCurrency(r.debit)}</span> : "—"}
                    </td>
                    <td className="p-2 text-center border-b border-border" dir="ltr">
                      {r.credit > 0 ? <span className="text-warn font-bold">{formatCurrency(r.credit)}</span> : "—"}
                    </td>
                    <td className="p-2 text-center font-bold text-ink border-b border-border" dir="ltr">
                      {formatCurrency(r.balance)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-info-bg/60 font-bold">
                  <td colSpan={2} className="p-2 text-end">الإجمالي</td>
                  <td className="p-2 text-center text-primary-dk" dir="ltr">
                    {formatCurrency(ledger.reduce((s, r) => s + r.debit, 0))}
                  </td>
                  <td className="p-2 text-center text-warn" dir="ltr">
                    {formatCurrency(ledger.reduce((s, r) => s + r.credit, 0))}
                  </td>
                  <td className="p-2 text-center text-forest" dir="ltr">
                    {formatCurrency(closing_expected)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Quick expense + close form */}
        {isOpen && (
          <>
            <div className="print:hidden">
              <QuickExpenseForm available={closing_expected} />
            </div>
            <div className="print:hidden">
              <CloseSessionForm sessionId={session.id} expected={closing_expected} />
            </div>
          </>
        )}

        {/* Closing summary */}
        {!isOpen && (
          <div className={`rounded-xl p-4 border-2 ${
            diff === 0 ? "bg-primary/10 border-primary/30" :
            (diff ?? 0) > 0 ? "bg-red-50 border-red-200" :
                              "bg-orange-50 border-orange-200"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={18} className={diff === 0 ? "text-primary" : diff && diff > 0 ? "text-danger" : "text-warn"} />
              <span className="font-cairo font-bold text-sm">
                {diff === 0 ? "تطابق تام — لا فرق" : diff && diff > 0 ? `عجز: ${formatCurrency(diff)}` : `زيادة: ${formatCurrency(-(diff ?? 0))}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-cairo">
              <div>
                <div className="text-muted">المتوقع</div>
                <div className="text-ink font-bold" dir="ltr">{formatCurrency(closing_expected)}</div>
              </div>
              <div>
                <div className="text-muted">الفعلي (العدّ)</div>
                <div className="text-ink font-bold" dir="ltr">{formatCurrency(session.closing_actual ?? 0)}</div>
              </div>
            </div>
            {session.notes && (
              <div className="mt-2 text-[10px] text-muted font-cairo">
                ملاحظة الإغلاق: {session.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, color = "text-ink", bold = false }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="bg-white border border-border rounded-xl p-2">
      <div className="text-[9px] text-muted font-cairo">{label}</div>
      <div className={`font-cairo ${bold ? "font-extrabold text-sm" : "font-bold text-xs"} ${color} mt-0.5`} dir="ltr">{value}</div>
    </div>
  );
}
