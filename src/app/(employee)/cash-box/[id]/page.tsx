import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Wallet, Plus, Minus, CheckCircle2 } from "lucide-react";
import { getCashBoxReconciliation } from "@/lib/cash-box-data";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { CloseSessionForm } from "./close-session-form";

export const dynamic = "force-dynamic";

export default async function CashBoxSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recon = await getCashBoxReconciliation(id);
  if (!recon) return notFound();

  const { session, cash_collected, cash_spent, closing_expected, diff, movements } = recon;
  const isOpen = session.status === "open";

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white p-4">
        <Link href="/cash-box" className="flex items-center gap-1 text-xs text-white/80 mb-2">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <div className="flex items-center gap-2">
          <Wallet size={22} />
          <h2 className="font-cairo font-bold text-lg">صندوق {session.employee_name}</h2>
        </div>
        <div className="text-[11px] opacity-80 mt-0.5" dir="ltr">
          {formatDateShort(new Date(session.session_date))} · {isOpen ? "مفتوح" : "مُغلق"}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-2">
          <SummaryTile label="رصيد افتتاحي" value={formatCurrency(session.opening_float)} color="text-ink" />
          <SummaryTile label="تحصيل نقدي" value={formatCurrency(cash_collected)} color="text-primary-dk" icon={<Plus size={11} />} />
          <SummaryTile label="مصاريف نقدية" value={formatCurrency(cash_spent)} color="text-warn" icon={<Minus size={11} />} />
          <SummaryTile label="المتوقع" value={formatCurrency(closing_expected)} color="text-forest" bold />
        </div>

        {/* Movement timeline */}
        <div className="bg-white border border-border rounded-xl p-3">
          <h3 className="font-cairo font-bold text-xs text-ink mb-2">الحركات اليومية</h3>
          {movements.length === 0 ? (
            <p className="text-center text-muted text-xs py-4 font-cairo">لا توجد حركات</p>
          ) : (
            <ul className="space-y-1.5">
              {movements.map((m, i) => (
                <li key={i} className="flex items-center justify-between text-[11px] font-cairo bg-info-bg/40 rounded-lg px-2.5 py-1.5">
                  <span className={`shrink-0 me-2 ${
                    m.kind === "opening" ? "text-muted" :
                    m.kind === "payment" ? "text-primary-dk" :
                    m.kind === "expense" ? "text-warn" :
                    "text-forest font-bold"
                  }`}>
                    {m.kind === "opening" ? "🟢" : m.kind === "payment" ? "+" : m.kind === "expense" ? "−" : "✓"}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-ink">{m.label}</span>
                  <span className={`shrink-0 ms-2 font-semibold ${m.amount >= 0 ? "text-primary-dk" : "text-warn"}`} dir="ltr">
                    {m.amount >= 0 ? "+" : ""}{formatCurrency(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Close form (if open) or reconciliation summary (if closed) */}
        {isOpen ? (
          <CloseSessionForm sessionId={session.id} expected={closing_expected} />
        ) : (
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

function SummaryTile({ label, value, color, bold, icon }: { label: string; value: string; color: string; bold?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`bg-white border border-border rounded-xl p-2.5 ${bold ? "shadow-sm" : ""}`}>
      <div className="flex items-center gap-1 text-[10px] text-muted font-cairo">{icon}{label}</div>
      <div className={`mt-0.5 font-cairo ${bold ? "text-base font-extrabold" : "text-sm font-bold"} ${color}`} dir="ltr">{value}</div>
    </div>
  );
}
