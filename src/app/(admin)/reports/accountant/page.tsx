import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAccountantReport } from "@/lib/accountant-report-data";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { MonthPicker } from "./month-picker";

export const dynamic = "force-dynamic";

const CATEGORY_AR: Record<string, string> = {
  fuel:   "وقود",
  salary: "رواتب",
  rent:   "إيجار",
  milk:   "حليب خام",
  other:  "متفرقات",
};

export default async function AccountantReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = new Date();
  const year  = Number(sp.year)  || now.getFullYear();
  const month = Number(sp.month) || (now.getMonth() + 1);

  const report = await getAccountantReport(year, month);

  // Build a list of last 12 months for the picker
  const monthOptions: Array<{ year: number; month: number; label: string }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  return (
    <div className="pb-4 print:pb-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-md mx-auto print:hidden">
        <Link href="/reports" className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <PrintButton />
      </div>

      {/* Picker — hidden in print */}
      <div className="px-4 mb-3 print:hidden">
        <label className="block text-xs font-cairo text-muted mb-1">اختر الشهر</label>
        <MonthPicker options={monthOptions} current={`${year}-${month}`} />
      </div>

      {/* Printable area */}
      <div className="bg-white max-w-md mx-auto print:max-w-full px-4 py-4 print:px-8">
        <div className="text-center mb-4 print:mb-6">
          <h1 className="font-display text-xl text-ink">التقرير المحاسبي الشهري</h1>
          <div className="font-cairo text-sm text-muted mt-1">{report.month}</div>
          <div className="font-cairo text-[10px] text-muted mt-0.5" dir="ltr">
            {formatDateShort(report.start)} → {formatDateShort(new Date(report.end.getTime() - 1))}
          </div>
        </div>

        {/* Revenue summary */}
        <Section title="١. الإيرادات">
          <Row label="إجمالي المبيعات (gross)" value={formatCurrency(report.gross_sales)} bold />
          <Row label="منها — مبيعات نقدية" value={formatCurrency(report.cash_sales)} indent />
          <Row label="منها — مبيعات جزئية الدفع" value={formatCurrency(report.partial_paid_sales)} indent />
          <Row label="منها — مبيعات آجل (ذمم)" value={formatCurrency(report.credit_sales)} indent />
          <Row label="عدد الفواتير" value={`${report.visits_count}`} />
        </Section>

        {/* Cash flow */}
        <Section title="٢. التحصيلات النقدية">
          <Row label="مدفوع عند التسليم" value={formatCurrency(report.payments_received_at_delivery)} />
          <Row label="تسديد ذمم سابقة" value={formatCurrency(report.payments_received_later)} />
          <Row label="إجمالي ما تم تحصيله" value={formatCurrency(report.total_payments_received)} bold />
        </Section>

        {/* Returns + replacements */}
        <Section title="٣. المرتجعات والبدائل">
          <Row label="قيمة المرتجع التالف" value={formatCurrency(report.returns_value)} />
          <Row label="قيمة البدل (بدون مقابل)" value={formatCurrency(report.replacements_value)} />
        </Section>

        {/* Expenses */}
        <Section title="٤. المصاريف التشغيلية">
          {report.expenses_by_category.length === 0 ? (
            <Row label="لا توجد مصاريف مسجلة" value="—" />
          ) : (
            report.expenses_by_category.map((e) => (
              <Row key={e.category} label={CATEGORY_AR[e.category] ?? e.category} value={formatCurrency(e.amount)} indent />
            ))
          )}
          <Row label="تكلفة الهدر (إنتاج)" value={formatCurrency(report.waste_cost)} indent />
          <Row label="إجمالي المصاريف" value={formatCurrency(report.total_expenses + report.waste_cost)} bold />
        </Section>

        {/* Net profit */}
        <div className="bg-forest text-white rounded-xl p-4 my-4 print:my-6">
          <div className="flex items-center justify-between">
            <span className="font-cairo text-sm opacity-90">صافي الربح</span>
            <span className={`font-cairo font-extrabold text-2xl ${report.net_profit < 0 ? "text-orange-200" : ""}`}>
              {formatCurrency(report.net_profit)}
            </span>
          </div>
          <div className="text-[10px] text-white/70 font-cairo mt-2">
            (الإيرادات − المرتجع − الهدر − المصاريف)
          </div>
        </div>

        {/* Truck loads */}
        {report.truck_loads_summary.length > 0 && (
          <Section title="٥. تسوية تحميل السيارة (الأشهر المُغلقة فقط)">
            <table className="w-full text-xs font-cairo border-collapse">
              <thead>
                <tr className="bg-info-bg text-muted">
                  <th className="text-right p-2 border border-border">المنتج</th>
                  <th className="text-center p-2 border border-border">حمّل</th>
                  <th className="text-center p-2 border border-border">باع</th>
                  <th className="text-center p-2 border border-border">رجع</th>
                  <th className="text-center p-2 border border-border">فرق</th>
                </tr>
              </thead>
              <tbody>
                {report.truck_loads_summary.map((r) => (
                  <tr key={r.product}>
                    <td className="text-right p-2 border border-border font-semibold">{r.product}</td>
                    <td className="text-center p-2 border border-border">{r.total_loaded}</td>
                    <td className="text-center p-2 border border-border">{r.total_sold_via_visits}</td>
                    <td className="text-center p-2 border border-border">{r.total_returned}</td>
                    <td className={`text-center p-2 border border-border font-bold ${r.shortage === 0 ? "text-primary-dk" : r.shortage > 0 ? "text-danger" : "text-warn"}`}>
                      {r.shortage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[10px] text-muted font-cairo mt-1">
              فرق موجب = فقدان (المحاسب يحقّق فيه). فرق سالب = توزيع غير مُسجَّل (يجب تسجيله بزيارة).
            </div>
          </Section>
        )}

        <div className="mt-6 print:mt-12 grid grid-cols-2 gap-8 text-[11px] text-muted font-cairo">
          <div className="border-t-2 border-dashed border-border pt-3 text-center">
            توقيع المحاسب: ____________________
          </div>
          <div className="border-t-2 border-dashed border-border pt-3 text-center">
            توقيع صاحب المصنع: __________________
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 print:mb-4">
      <h2 className="font-cairo font-bold text-base text-primary-dk border-b-2 border-primary/30 pb-1 mb-2">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm font-cairo ${bold ? "font-bold text-ink border-t border-border pt-1 mt-1" : "text-ink"} ${indent ? "ps-4 text-muted" : ""}`}>
      <span>{label}</span>
      <span dir="ltr">{value}</span>
    </div>
  );
}
