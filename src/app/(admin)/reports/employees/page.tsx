import Link from "next/link";
import { ArrowRight, AlertTriangle, ShoppingCart, Banknote, Truck } from "lucide-react";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { PrintButton } from "@/components/PrintButton";
import { getEmployeePerformance } from "@/lib/employee-performance-data";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { type Period } from "@/lib/periods";

export const dynamic = "force-dynamic";

const VALID: Period[] = ["daily", "weekly", "monthly", "yearly"];

export default async function EmployeePerformancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = VALID.includes(sp.period as Period) ? (sp.period as Period) : "monthly";
  const report = await getEmployeePerformance(period);

  return (
    <div className="pb-4 print:pb-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-md mx-auto print:hidden">
        <Link href="/reports" className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <PrintButton />
      </div>

      <PeriodSwitcher current={period} />

      <div className="bg-white max-w-md mx-auto print:max-w-full px-4 py-3 print:px-8">
        <div className="text-center mb-3">
          <h1 className="font-display text-xl text-ink">أداء الموظفين</h1>
          <div className="text-xs text-muted font-cairo mt-0.5" dir="ltr">
            {formatDateShort(report.windowStart)} → {formatDateShort(new Date(report.windowEnd.getTime() - 1))}
          </div>
        </div>

        {/* Period totals */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <KpiTile icon={ShoppingCart} label="إجمالي المبيعات"  value={formatCurrency(report.totals.sales)} />
          <KpiTile icon={Banknote}     label="إجمالي التحصيلات" value={formatCurrency(report.totals.cash_collected)} />
          <KpiTile icon={ShoppingCart} label="عدد الزيارات"     value={`${report.totals.visits}`} />
          <KpiTile icon={Truck}        label="إجمالي الفقدان"   value={`${report.totals.shortage} وحدة`} />
        </div>

        {report.rows.length === 0 ? (
          <div className="bg-info-bg/40 border border-border rounded-xl p-8 text-center text-muted font-cairo text-sm">
            لا توجد بيانات نشاط في هذه الفترة
          </div>
        ) : (
          <ul className="space-y-3">
            {report.rows.map((r, idx) => (
              <li key={r.employee_id} className="bg-white border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs text-muted font-cairo">#{idx + 1}</span>{" "}
                    <span className="font-cairo font-bold text-ink text-sm">{r.employee_name}</span>
                    {r.role === "admin" && (
                      <span className="text-[9px] font-cairo text-primary-dk bg-primary/10 px-1.5 py-0.5 rounded ms-1">مدير</span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-cairo font-extrabold text-primary text-base" dir="ltr">{formatCurrency(r.sales_total)}</div>
                    <div className="text-[10px] text-muted font-cairo">إجمالي المبيعات</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-cairo">
                  <MiniStat label="الزيارات"        value={`${r.visits_count}`} />
                  <MiniStat label="معدل الفاتورة"   value={formatCurrency(r.avg_visit_value)} />
                  <MiniStat label="تحصيلات نقدية"   value={formatCurrency(r.cash_collected)} />
                  <MiniStat label="مرتجعات"          value={`${r.returns_units} وحدة`} />
                </div>

                {r.loads_closed > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-[10px] text-muted font-cairo mb-1">🚚 تسوية تحميل ({r.loads_closed} {r.loads_closed === 1 ? "تحميل" : "تحميلات"} مُغلقة)</div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-info-bg rounded-lg py-1 px-1.5">
                        <div className="text-[9px] text-muted font-cairo">حُمِّل</div>
                        <div className="text-xs font-cairo font-bold text-ink">{r.total_loaded_units}</div>
                      </div>
                      <div className="bg-info-bg rounded-lg py-1 px-1.5">
                        <div className="text-[9px] text-muted font-cairo">رجع</div>
                        <div className="text-xs font-cairo font-bold text-primary-dk">{r.total_returned_units}</div>
                      </div>
                      <div className={`rounded-lg py-1 px-1.5 ${r.total_shortage_units === 0 ? "bg-primary/10" : r.total_shortage_units > 5 ? "bg-red-50" : "bg-orange-50"}`}>
                        <div className={`text-[9px] font-cairo ${r.total_shortage_units === 0 ? "text-primary-dk" : "text-warn"}`}>
                          {r.total_shortage_units > 0 && <AlertTriangle size={9} className="inline me-0.5" />}
                          فقدان
                        </div>
                        <div className={`text-xs font-cairo font-bold ${r.total_shortage_units === 0 ? "text-primary-dk" : r.total_shortage_units > 5 ? "text-danger" : "text-warn"}`}>
                          {r.total_shortage_units}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 text-[10px] text-muted font-cairo text-center">
          الفترة: {period === "daily" ? "اليوم" : period === "weekly" ? "هذا الأسبوع" : period === "monthly" ? "هذا الشهر" : "هذه السنة"}
        </div>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="bg-info-bg/60 border border-border rounded-xl p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted font-cairo">
        <Icon size={12} /> {label}
      </div>
      <div className="font-cairo font-extrabold text-base text-ink mt-0.5" dir="ltr">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-info-bg/40 rounded-lg px-2 py-1">
      <span className="text-muted">{label}</span>
      <span className="text-ink font-semibold" dir="ltr">{value}</span>
    </div>
  );
}
