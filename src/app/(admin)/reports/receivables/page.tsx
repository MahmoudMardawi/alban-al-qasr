import Link from "next/link";
import { ArrowRight, AlertTriangle, Phone, Calendar, Banknote } from "lucide-react";
import { getReceivablesReport, type ReceivableRow } from "@/lib/receivables-data";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const BUCKET_AR: Record<ReceivableRow["bucket"], { label: string; color: string; bg: string }> = {
  current:   { label: "حديث (≤ 30 يوم)",   color: "text-primary-dk", bg: "bg-primary/10 border-primary/30"  },
  "30d":     { label: "31-60 يوم",          color: "text-ink",         bg: "bg-info-bg border-border"         },
  "60d":     { label: "61-90 يوم",          color: "text-warn",        bg: "bg-orange-50 border-orange-200"   },
  "90d":     { label: "91-180 يوم",         color: "text-warn",        bg: "bg-orange-100 border-orange-300"  },
  over_90d:  { label: "أكثر من 180 يوم",    color: "text-danger",      bg: "bg-red-50 border-red-200"         },
};

export default async function ReceivablesReportPage() {
  const report = await getReceivablesReport();

  return (
    <div className="pb-4 print:pb-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-md mx-auto print:hidden">
        <Link href="/reports" className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white max-w-md mx-auto print:max-w-full px-4 py-4 print:px-8">
        <div className="text-center mb-4">
          <h1 className="font-display text-xl text-ink">تقرير الذمم</h1>
          <p className="text-xs text-muted font-cairo mt-1">قائمة الزبائن المدينين مرتّبة من الأسوأ تقادمًا</p>
        </div>

        {/* Aging summary */}
        <div className="bg-forest text-white rounded-xl p-4 mb-4 print:bg-info-bg print:text-ink">
          <div className="text-[11px] opacity-90 font-cairo">إجمالي الذمم</div>
          <div className="font-cairo font-extrabold text-3xl mt-1">{formatCurrency(report.totals.grand_total)}</div>
          <div className="text-[11px] opacity-80 font-cairo mt-1">{report.totals.client_count_with_debt} زبون مدين</div>
        </div>

        <div className="grid grid-cols-5 gap-1 mb-4 text-center">
          {(Object.keys(BUCKET_AR) as Array<ReceivableRow["bucket"]>).map((key) => {
            const meta = BUCKET_AR[key];
            const amount = report.totals.by_bucket[key];
            return (
              <div key={key} className={`${meta.bg} border rounded-lg p-1.5`}>
                <div className={`text-[8px] font-cairo ${meta.color}`}>{meta.label}</div>
                <div className={`text-[11px] font-cairo font-bold ${meta.color} mt-0.5`}>{formatCurrency(amount)}</div>
              </div>
            );
          })}
        </div>

        {/* Client list */}
        {report.rows.length === 0 ? (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <div className="font-cairo font-bold text-primary-dk">ممتاز — لا يوجد ذمم مستحقة</div>
            <div className="text-xs text-muted font-cairo mt-1">كل الزبائن مسدِّدون</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {report.rows.map((r) => {
              const meta = BUCKET_AR[r.bucket];
              const showWarning = r.bucket === "over_90d" || r.bucket === "90d";
              return (
                <li key={r.client_id} className={`${meta.bg} border rounded-xl p-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/clients/${r.client_id}`} className="font-cairo font-bold text-ink text-sm hover:underline">
                        {showWarning && <AlertTriangle size={14} className="inline text-danger me-1" />}
                        {r.client_name}
                      </Link>
                      <div className={`text-[10px] font-cairo mt-0.5 ${meta.color}`}>{meta.label}</div>
                    </div>
                    <div className="font-cairo font-extrabold text-lg shrink-0" dir="ltr">{formatCurrency(r.balance_owed)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-cairo">
                    <div className="bg-white/70 rounded-lg p-1.5 border border-border">
                      <div className="text-muted">آخر تسديد</div>
                      <div className="text-ink font-semibold mt-0.5">
                        {r.last_payment_at ? `${formatDateShort(new Date(r.last_payment_at))} (${r.days_since_last_payment} يوم)` : "لم يدفع أبداً"}
                      </div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-1.5 border border-border">
                      <div className="text-muted">أقدم دين مفتوح</div>
                      <div className="text-ink font-semibold mt-0.5">
                        {r.oldest_unpaid_sale_at ? `${formatDateShort(new Date(r.oldest_unpaid_sale_at))} (${r.days_since_oldest_unpaid_sale} يوم)` : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 print:hidden">
                    <Link
                      href={`/payments/new?client=${r.client_id}`}
                      className="flex items-center justify-center gap-1 bg-primary text-white text-xs font-cairo font-bold py-2 rounded-lg"
                    >
                      <Banknote size={12} /> تحصيل
                    </Link>
                    <Link
                      href={`/visit/new?client=${r.client_id}`}
                      className="flex items-center justify-center gap-1 bg-info-bg text-primary-dk border border-border text-xs font-cairo font-bold py-2 rounded-lg"
                    >
                      <Calendar size={12} /> زيارة
                    </Link>
                  </div>
                  {r.client_phone && (
                    <div className="mt-1.5 grid grid-cols-2 gap-2 print:hidden">
                      <a
                        href={`tel:${r.client_phone}`}
                        className="flex items-center justify-center gap-1 bg-white text-primary border border-primary text-xs font-cairo font-bold py-2 rounded-lg"
                      >
                        <Phone size={12} /> اتصل
                      </a>
                      <a
                        href={`https://wa.me/${encodeURIComponent(r.client_phone.replace(/[^0-9+]/g, ""))}?text=${encodeURIComponent(`السلام عليكم،\nنود تذكيركم بأن لدينا رصيد مستحق بقيمة ${r.balance_owed.toFixed(2)} ₪. شكراً لتعاونكم.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 bg-white text-primary border border-primary text-xs font-cairo font-bold py-2 rounded-lg"
                      >
                        💬 واتساب
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 text-[10px] text-muted font-cairo text-center">
          البيانات حتى: <span dir="ltr">{formatDateShort(new Date())}</span>
        </div>
      </div>
    </div>
  );
}
