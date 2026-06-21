import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PrintButton } from "@/components/PrintButton";
import { getDamagedReturns, defaultDamagedRange } from "@/lib/damaged-returns-data";
import { formatCurrency, formatDateShort, formatInvoiceNo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DamagedReturnsReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const def = defaultDamagedRange();
  const startIso = sp.start || def.start;
  const endIso   = sp.end   || def.end;

  const report = await getDamagedReturns(startIso, endIso);

  return (
    <div className="pb-4 print:pb-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-3xl mx-auto print:hidden">
        <Link href="/reports" className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <PrintButton />
      </div>

      <div className="print:hidden">
        <DateRangePicker start={startIso} end={endIso} showPresets />
      </div>

      <div className="bg-white max-w-3xl mx-auto print:max-w-full px-4 py-4 print:px-8">
        <div className="text-center mb-4 print:mb-6">
          <h1 className="font-display text-xl text-ink">تقرير المرتجع التالف</h1>
          <div className="text-xs text-muted font-cairo mt-1" dir="ltr">
            {formatDateShort(new Date(startIso))} → {formatDateShort(new Date(endIso))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-warn text-white rounded-xl p-4 mb-4 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] opacity-90 font-cairo">إجمالي الكمية</div>
            <div className="font-cairo font-extrabold text-2xl mt-1">{report.totals.qty}</div>
          </div>
          <div className="text-left">
            <div className="text-[11px] opacity-90 font-cairo">إجمالي القيمة</div>
            <div className="font-cairo font-extrabold text-2xl mt-1" dir="ltr">{formatCurrency(report.totals.value)}</div>
          </div>
        </div>

        {report.entries.length === 0 ? (
          <div className="bg-info-bg/40 border border-border rounded-xl p-8 text-center text-muted font-cairo text-sm">
            لا يوجد مرتجع تالف في هذه الفترة
          </div>
        ) : (
          <>
            {/* By product */}
            <Section title="١. إجمالي التالف لكل صنف">
              <table className="w-full text-xs font-cairo border-collapse">
                <thead>
                  <tr className="bg-info-bg/60 text-muted">
                    <th className="text-right p-2 border border-border">الصنف</th>
                    <th className="text-center p-2 border border-border">الكمية</th>
                    <th className="text-center p-2 border border-border">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byProduct.map((p) => (
                    <tr key={p.product}>
                      <td className="text-right p-2 border border-border font-semibold text-ink">{p.product}</td>
                      <td className="text-center p-2 border border-border">{p.qty}</td>
                      <td className="text-center p-2 border border-border text-warn font-bold" dir="ltr">{formatCurrency(p.value)}</td>
                    </tr>
                  ))}
                  <tr className="bg-info-bg/60 font-bold">
                    <td className="p-2 text-end border border-border">الإجمالي</td>
                    <td className="text-center p-2 border border-border">{report.totals.qty}</td>
                    <td className="text-center p-2 border border-border text-warn" dir="ltr">{formatCurrency(report.totals.value)}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* By client */}
            <Section title="٢. إجمالي التالف لكل زبون">
              <table className="w-full text-xs font-cairo border-collapse">
                <thead>
                  <tr className="bg-info-bg/60 text-muted">
                    <th className="text-right p-2 border border-border">الزبون</th>
                    <th className="text-center p-2 border border-border">الكمية</th>
                    <th className="text-center p-2 border border-border">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byClient.map((c) => (
                    <tr key={c.client}>
                      <td className="text-right p-2 border border-border font-semibold text-ink">{c.client}</td>
                      <td className="text-center p-2 border border-border">{c.qty}</td>
                      <td className="text-center p-2 border border-border text-warn font-bold" dir="ltr">{formatCurrency(c.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Detail list */}
            <Section title="٣. تفاصيل المرتجع (حسب الزيارة)">
              <table className="w-full text-xs font-cairo border-collapse">
                <thead>
                  <tr className="bg-info-bg/60 text-muted">
                    <th className="text-right p-2 border border-border">التاريخ</th>
                    <th className="text-right p-2 border border-border">الفاتورة</th>
                    <th className="text-right p-2 border border-border">الزبون</th>
                    <th className="text-right p-2 border border-border">الصنف</th>
                    <th className="text-center p-2 border border-border">الكمية</th>
                    <th className="text-center p-2 border border-border">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="p-2 text-[10px] text-muted border border-border" dir="ltr">{formatDateShort(new Date(e.visited_at))}</td>
                      <td className="p-2 text-[10px] border border-border" dir="ltr">
                        <Link href={`/visit/${e.visit_id}`} className="text-primary-dk hover:underline">{formatInvoiceNo(e.invoice_no)}</Link>
                      </td>
                      <td className="p-2 font-semibold text-ink border border-border">{e.client_name}</td>
                      <td className="p-2 text-ink border border-border">{e.product_name}</td>
                      <td className="p-2 text-center border border-border">{e.qty}</td>
                      <td className="p-2 text-center text-warn font-bold border border-border" dir="ltr">{formatCurrency(e.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}

        <div className="mt-6 grid grid-cols-2 gap-8 text-[11px] text-muted font-cairo print:mt-12">
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
      <h2 className="font-cairo font-bold text-base text-warn border-b-2 border-warn/30 pb-1 mb-2">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
