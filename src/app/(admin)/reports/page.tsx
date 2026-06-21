import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DateRangePicker } from "@/components/DateRangePicker";
import { getReportRows } from "@/lib/reports-data";
import { formatCurrency, formatDateShort, formatInvoiceNo } from "@/lib/format";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const def = defaultRange();
  const start      = sp.start      || def.start;
  const end        = sp.end        || def.end;
  const clientId   = sp.client     || null;
  const productId  = sp.product    || null;
  const employeeId = sp.employee   || null;

  const supabase = await createClient();
  const [clientsRes, productsRes, employeesRes, rows] = await Promise.all([
    supabase.from("clients").select("id, name").is("merged_into_client_id", null).order("name"),
    supabase.from("products").select("id, name_ar").order("name_ar"),
    supabase.from("users").select("id, full_name, role").eq("role", "employee").order("full_name"),
    getReportRows({ start, end, clientId, productId, employeeId }),
  ]);

  const totalSales    = rows.reduce((s, r) => s + r.sale_total, 0);
  const totalReturns  = rows.reduce((s, r) => s + r.return_units, 0);
  const totalReplaces = rows.reduce((s, r) => s + r.replacement_units, 0);

  return (
    <div className="pb-4">
      <h2 className="font-cairo font-bold text-ink text-base px-4 py-3">📊 التقارير</h2>

      <div className="px-4 mb-3 space-y-2">
        <Link href="/reports/accountant" className="block bg-gradient-to-l from-primary to-primary-dk text-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-cairo font-bold text-sm">📋 التقرير المحاسبي الشهري</div>
              <div className="text-[11px] opacity-80 font-cairo mt-0.5">مبيعات نقد/آجل، تحصيلات، مصاريف بالتفصيل، تسوية التحميل، صافي ربح</div>
            </div>
            <span className="text-xl opacity-80">‹</span>
          </div>
        </Link>

        <Link href="/reports/receivables" className="block bg-gradient-to-l from-warn to-orange-600 text-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-cairo font-bold text-sm">💸 تقرير الذمم — من يدين لي؟</div>
              <div className="text-[11px] opacity-90 font-cairo mt-0.5">قائمة الزبائن المدينين مرتّبة من الأسوأ، مع اتصال + واتساب تذكير</div>
            </div>
            <span className="text-xl opacity-80">‹</span>
          </div>
        </Link>

        <Link href="/reports/employees" className="block bg-gradient-to-l from-primary-dk to-forest text-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-cairo font-bold text-sm">👥 أداء الموظفين</div>
              <div className="text-[11px] opacity-90 font-cairo mt-0.5">مبيعات وتحصيلات لكل موظف، مع تسوية التحميل ونسبة الفقدان</div>
            </div>
            <span className="text-xl opacity-80">‹</span>
          </div>
        </Link>

        <Link href="/reports/client-statements" className="block bg-gradient-to-l from-info to-cyan-700 text-white rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-cairo font-bold text-sm">📒 كشف حساب الزبائن</div>
              <div className="text-[11px] opacity-90 font-cairo mt-0.5">مدين / دائن / رصيد جاري — اختر زبون لعرض حركاته كاملة</div>
            </div>
            <span className="text-xl opacity-80">‹</span>
          </div>
        </Link>
      </div>

      <DateRangePicker start={start} end={end} />

      <form method="get" className="px-4 py-2 grid grid-cols-3 gap-2">
        <input type="hidden" name="start" value={start} />
        <input type="hidden" name="end"   value={end} />
        <select name="client" defaultValue={clientId ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
          <option value="">كل الزبائن</option>
          {(clientsRes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="product" defaultValue={productId ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
          <option value="">كل المنتجات</option>
          {(productsRes.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
        </select>
        <select name="employee" defaultValue={employeeId ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
          <option value="">كل الموظفين</option>
          {(employeesRes.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <button type="submit" className="col-span-3 bg-primary text-white text-xs font-cairo font-semibold py-2 rounded-lg">تطبيق الفلاتر</button>
      </form>

      <div className="grid grid-cols-3 gap-2 px-4 mt-2">
        <div className="bg-info-bg rounded-xl p-2 text-center">
          <div className="text-[10px] text-muted font-cairo">إجمالي المبيعات</div>
          <div className="font-cairo font-bold text-primary text-sm mt-0.5">{formatCurrency(totalSales)}</div>
        </div>
        <div className="bg-info-bg rounded-xl p-2 text-center">
          <div className="text-[10px] text-muted font-cairo">مرتجع (وحدات)</div>
          <div className="font-cairo font-bold text-warn text-sm mt-0.5">{totalReturns}</div>
        </div>
        <div className="bg-info-bg rounded-xl p-2 text-center">
          <div className="text-[10px] text-muted font-cairo">بدل (وحدات)</div>
          <div className="font-cairo font-bold text-primary-dk text-sm mt-0.5">{totalReplaces}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="لا توجد بيانات في هذه الفترة" subtitle="جرّب توسيع المدى أو إزالة الفلاتر" />
      ) : (
        <ul className="px-3 mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.visit_id}>
              <Link href={`/visit/${r.visit_id}`} className="block bg-white border border-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-cairo font-semibold text-ink text-sm">{r.client_name}</span>
                      <span className="text-[10px] font-cairo font-bold text-primary-dk bg-primary/10 px-1.5 py-0.5 rounded" dir="ltr">
                        {formatInvoiceNo(r.invoice_no)}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted font-cairo mt-0.5">{formatDateShort(new Date(r.visited_at))} · {r.employee_name} · {r.line_count} عنصر</div>
                  </div>
                  <div className="font-cairo font-bold text-primary text-sm">{formatCurrency(r.sale_total)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
