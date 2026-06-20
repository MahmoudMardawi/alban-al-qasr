import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { getInventorySnapshot } from "@/lib/inventory-data";
import { formatQty, formatDateShort } from "@/lib/format";
import { type Period } from "@/lib/periods";
import { ClipboardList, Truck } from "lucide-react";
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

      {/* Live truck-loads panel — shows what's on the road RIGHT NOW */}
      {snap.openLoads.length > 0 && (
        <div className="px-4 pt-3">
          <h3 className="font-cairo font-bold text-ink text-sm mb-2 flex items-center gap-1.5">
            <Truck size={16} className="text-primary" /> على الطريق الآن ({snap.openLoads.length} {snap.openLoads.length === 1 ? "تحميل" : "تحميلات"})
          </h3>
          <div className="space-y-2">
            {snap.openLoads.map((load) => (
              <div key={load.load_id} className="bg-white border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-cairo font-bold text-ink text-sm">{load.employee_name}</div>
                  <div className="text-[10px] text-muted font-cairo" dir="ltr">{formatDateShort(new Date(load.loaded_at))}</div>
                </div>
                <table className="w-full text-[11px] font-cairo">
                  <thead>
                    <tr className="text-muted">
                      <th className="text-right py-1">المنتج</th>
                      <th className="text-center py-1">حمّل</th>
                      <th className="text-center py-1">باع</th>
                      <th className="text-center py-1">على السيارة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {load.items.map((it) => (
                      <tr key={it.product_id} className="border-t border-border">
                        <td className="text-right py-1 font-semibold text-ink">{it.product_name}</td>
                        <td className="text-center py-1">{it.qty_loaded}</td>
                        <td className="text-center py-1 text-primary-dk">{it.qty_sold}</td>
                        <td className="text-center py-1 font-bold text-primary">{it.qty_on_truck}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-cairo font-bold text-forest text-base px-4 py-2 mt-3">
        📋 الجرد ({snap.rows.length} منتج)
      </h2>

      <ul className="px-3 space-y-2">
        {snap.rows.map((r) => {
          const prev = snap.prev.get(r.product_id);
          const closingDelta = prev ? r.closing - prev.closing : null;
          const onTruck = snap.onTruckByProduct.get(r.product_id) ?? 0;
          const totalAvailable = r.closing + onTruck;
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

              {onTruck > 0 && (
                <div className="mt-2 bg-info-bg rounded-lg p-2 space-y-1 text-[11px] font-cairo">
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1"><Truck size={12} /> على السيارات الآن</span>
                    <span className="text-primary font-bold">{formatQty(onTruck, r.base_unit)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-1">
                    <span className="text-ink font-bold">المتاح الإجمالي (مخزن + سيارات)</span>
                    <span className="text-forest font-extrabold">{formatQty(totalAvailable, r.base_unit)}</span>
                  </div>
                </div>
              )}

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
