import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Edit3 } from "lucide-react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PrintButton } from "@/components/PrintButton";
import { getClientStatement, defaultStatementRange, type StatementEntry } from "@/lib/client-statement-data";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

const TYPE_COLOR: Record<StatementEntry["type"], string> = {
  sale:          "text-warn bg-orange-50 border-orange-200",
  receipt:       "text-primary-dk bg-primary/10 border-primary/30",
  sales_return:  "text-info bg-info-bg border-border",
  disbursement:  "text-warn bg-orange-50 border-orange-200",
};

export default async function ClientStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const def = defaultStatementRange();
  const startIso = sp.start || def.start;
  const endIso   = sp.end   || def.end;

  const statement = await getClientStatement(id, startIso, endIso);
  if (!statement) return notFound();

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";

  return (
    <div className="pb-4 print:pb-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-3xl mx-auto print:hidden">
        <Link href={`/clients/${id}`} className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/clients/${id}`} className="flex items-center gap-1 text-xs font-cairo text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
            <Edit3 size={12} /> تعديل
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="print:hidden">
        <DateRangePicker start={startIso} end={endIso} showPresets />
      </div>

      <div className="bg-white max-w-3xl mx-auto print:max-w-full px-4 py-4 print:px-8">
        {/* Header */}
        <div className="text-center mb-4 print:mb-6">
          <h1 className="font-display text-xl text-ink">{brandName}</h1>
          <div className="mt-2 inline-block bg-info-bg px-4 py-1.5 rounded-full">
            <div className="font-cairo font-extrabold text-base">كشف حساب</div>
          </div>
          <div className="mt-3 font-cairo font-bold text-lg text-primary-dk">{statement.client.name}</div>
          {statement.client.phone && (
            <div className="text-[11px] text-muted font-cairo mt-0.5" dir="ltr">{statement.client.phone}</div>
          )}
          <div className="text-[11px] text-muted font-cairo mt-2" dir="ltr">
            {formatDateShort(new Date(statement.startIso))} → {formatDateShort(new Date(statement.endIso))}
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-center print:mb-6">
          <SummaryTile label="رصيد افتتاحي" value={formatCurrency(statement.opening_balance)} />
          <SummaryTile label="إجمالي مدين" value={formatCurrency(statement.total_debit)} color="text-primary-dk" />
          <SummaryTile label="إجمالي دائن" value={formatCurrency(statement.total_credit)} color="text-warn" />
          <SummaryTile label="الرصيد الحالي" value={formatCurrency(statement.closing_balance)} bold color={statement.closing_balance > 0 ? "text-warn" : statement.closing_balance < 0 ? "text-primary-dk" : "text-ink"} />
        </div>

        {/* T-account table */}
        {statement.entries.length === 0 ? (
          <div className="bg-info-bg/40 border border-border rounded-xl p-8 text-center text-muted font-cairo text-sm">
            لا توجد حركات في هذه الفترة
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs font-cairo border-collapse">
              <thead className="bg-info-bg/60">
                <tr>
                  <th className="text-right p-2 border-b border-border w-24">التاريخ</th>
                  <th className="text-right p-2 border-b border-border">نوع السند</th>
                  <th className="text-center p-2 border-b border-border">مدين</th>
                  <th className="text-center p-2 border-b border-border">دائن</th>
                  <th className="text-center p-2 border-b border-border">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr className="bg-info-bg/30">
                  <td className="p-2 text-muted text-[10px] border-b border-border" dir="ltr">{formatDateShort(new Date(statement.startIso))}</td>
                  <td className="p-2 text-muted font-semibold border-b border-border">رصيد افتتاحي</td>
                  <td className="p-2 text-center text-muted border-b border-border">—</td>
                  <td className="p-2 text-center text-muted border-b border-border">—</td>
                  <td className="p-2 text-center font-bold text-ink border-b border-border" dir="ltr">{formatCurrency(statement.opening_balance)}</td>
                </tr>

                {statement.entries.map((e, i) => (
                  <tr key={i} className="hover:bg-info-bg/30">
                    <td className="p-2 text-ink text-[10px] border-b border-border" dir="ltr">
                      {formatDateShort(new Date(e.date))}
                    </td>
                    <td className="p-2 border-b border-border">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${TYPE_COLOR[e.type]}`}>
                        {e.type_label}
                      </span>
                      {e.reference && <span className="text-muted text-[10px] me-1" dir="ltr"> {e.reference}</span>}
                      {e.note && <div className="text-[10px] text-muted mt-0.5">{e.note}</div>}
                    </td>
                    <td className="p-2 text-center border-b border-border" dir="ltr">
                      {e.debit > 0 ? <span className="text-primary-dk font-bold">{formatCurrency(e.debit)}</span> : "—"}
                    </td>
                    <td className="p-2 text-center border-b border-border" dir="ltr">
                      {e.credit > 0 ? <span className="text-warn font-bold">{formatCurrency(e.credit)}</span> : "—"}
                    </td>
                    <td className="p-2 text-center font-bold border-b border-border" dir="ltr">
                      <span className={e.balance > 0 ? "text-warn" : e.balance < 0 ? "text-primary-dk" : "text-ink"}>
                        {formatCurrency(e.balance)}
                      </span>
                    </td>
                  </tr>
                ))}

                {/* Totals row */}
                <tr className="bg-info-bg/60 font-bold">
                  <td colSpan={2} className="p-2 text-end text-ink">الإجمالي</td>
                  <td className="p-2 text-center text-primary-dk" dir="ltr">{formatCurrency(statement.total_debit)}</td>
                  <td className="p-2 text-center text-warn" dir="ltr">{formatCurrency(statement.total_credit)}</td>
                  <td className="p-2 text-center" dir="ltr">
                    <span className={statement.closing_balance > 0 ? "text-warn" : statement.closing_balance < 0 ? "text-primary-dk" : "text-ink"}>
                      {formatCurrency(statement.closing_balance)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 text-[10px] text-muted font-cairo bg-info-bg/40 rounded-xl p-3 print:mt-6">
          <strong className="text-ink">دليل الكشف:</strong>
          <ul className="mt-1.5 space-y-0.5 leading-relaxed">
            <li>• <span className="text-warn font-semibold">دائن</span> = ما يدين به الزبون لنا (مبيعات، سند صرف).</li>
            <li>• <span className="text-primary-dk font-semibold">مدين</span> = ما تم تسديده أو رده (سند قبض، مردود مبيعات).</li>
            <li>• <span className="font-semibold">الرصيد الموجب</span> يعني أن الزبون مدين لنا بهذا المبلغ.</li>
            <li>• <span className="font-semibold">الرصيد السالب</span> يعني أن لدى الزبون رصيدًا دائنًا (دفع زيادة).</li>
          </ul>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-8 text-[11px] text-muted font-cairo print:mt-12">
          <div className="border-t-2 border-dashed border-border pt-3 text-center">
            توقيع المحاسب: ____________________
          </div>
          <div className="border-t-2 border-dashed border-border pt-3 text-center">
            توقيع الزبون: ____________________
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, color = "text-ink", bold = false }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className={`bg-info-bg/60 border border-border rounded-xl p-2 ${bold ? "shadow-sm" : ""}`}>
      <div className="text-[9px] text-muted font-cairo">{label}</div>
      <div className={`font-cairo ${bold ? "font-extrabold text-sm" : "font-bold text-xs"} ${color} mt-0.5`} dir="ltr">{value}</div>
    </div>
  );
}
