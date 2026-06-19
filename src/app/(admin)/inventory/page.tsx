import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { getInventorySnapshot } from "@/lib/inventory-data";
import { formatQty } from "@/lib/format";
import { type Period } from "@/lib/periods";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

const VALID: Period[] = ["weekly", "monthly", "yearly"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = VALID.includes(sp.period as Period) ? (sp.period as Period) : "monthly";
  const snap = await getInventorySnapshot(period);

  if (snap.rows.length === 0) {
    return (
      <div>
        <PeriodSwitcher current={period} />
        <EmptyState icon={ClipboardList} title="لا توجد منتجات" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <PeriodSwitcher current={period} />
      <h2 className="font-cairo font-bold text-forest text-base px-4 py-2">📋 الجرد ({snap.rows.length} منتج)</h2>

      <ul className="px-3 space-y-2">
        {snap.rows.map((r) => {
          const prev = snap.prev.get(r.product_id);
          const closingDelta = prev ? r.closing - prev.closing : null;
          return (
            <li key={r.product_id} className="bg-white border border-border rounded-xl p-3">
              <h3 className="font-cairo font-bold text-ink text-sm mb-2">{r.name_ar}</h3>
              <table className="w-full text-[11px] font-cairo">
                <tbody>
                  <tr><td className="text-muted py-0.5">رصيد الافتتاح</td><td className="text-left text-ink font-semibold">{formatQty(r.opening, r.base_unit)}</td></tr>
                  <tr><td className="text-primary py-0.5">+ إنتاج</td><td className="text-left text-primary font-semibold">{formatQty(r.produced, r.base_unit)}</td></tr>
                  <tr><td className="text-warn py-0.5">− مبيعات</td><td className="text-left text-warn font-semibold">{formatQty(r.sold, r.base_unit)}</td></tr>
                  <tr><td className="text-primary-dk py-0.5">− بدل (مجاناً)</td><td className="text-left text-primary-dk font-semibold">{formatQty(r.replaced, r.base_unit)}</td></tr>
                  <tr><td className="text-warn py-0.5">− فاقد</td><td className="text-left text-warn font-semibold">{formatQty(r.wasted, r.base_unit)}</td></tr>
                  <tr><td className="text-muted py-0.5">↩️ مرتجع (مرجَع للمصنع)</td><td className="text-left text-muted font-semibold">{formatQty(r.returned, r.base_unit)}</td></tr>
                  <tr className="border-t border-border"><td className="text-forest py-1.5 font-bold">رصيد الإقفال</td><td className="text-left text-forest font-extrabold text-sm">{formatQty(r.closing, r.base_unit)}</td></tr>
                </tbody>
              </table>
              {closingDelta !== null && (
                <p className="text-[10px] font-cairo mt-2 text-muted">
                  مقارنة بالفترة السابقة: <strong className={closingDelta >= 0 ? "text-primary" : "text-warn"}>{closingDelta >= 0 ? "+" : ""}{formatQty(closingDelta, r.base_unit)}</strong>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
