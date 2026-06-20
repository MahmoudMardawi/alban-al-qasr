import Link from "next/link";
import { Truck, Banknote, ShoppingCart, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { TodaySnapshot } from "@/lib/today-snapshot-data";

const ARABIC_WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;
const ARABIC_MONTHS   = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"] as const;

function todayLabel(): string {
  const d = new Date();
  return `${ARABIC_WEEKDAYS[d.getDay()]} · ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
}

export function TodaySnapshotPanel({ snap }: { snap: TodaySnapshot }) {
  return (
    <div className="mx-4 mt-3 mb-3 bg-gradient-to-br from-forest via-primary to-primary-dk text-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-cairo font-extrabold text-lg">📍 اليوم</h3>
        <span className="text-[11px] font-cairo opacity-80">{todayLabel()}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={ShoppingCart} label="مبيعات اليوم" value={formatCurrency(snap.sales_today)} />
        <Stat icon={Banknote}     label="تحصيلات نقدية" value={formatCurrency(snap.cash_collected_today)} />
        <Stat icon={TrendingUp}   label="عدد الزيارات" value={`${snap.visits_today}`} />
        <Stat icon={Truck}        label="على الطريق الآن" value={snap.active_loads.length === 0 ? "—" : `${snap.units_on_road} وحدة`} />
      </div>

      {snap.active_loads.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <div className="text-[11px] font-cairo opacity-90 mb-1.5">🚚 تحميلات نشطة:</div>
          {snap.active_loads.map((l) => (
            <div key={l.load_id} className="flex items-center justify-between text-[12px] font-cairo bg-white/10 rounded-lg px-2.5 py-1.5 mb-1 last:mb-0">
              <span className="font-semibold">{l.employee_name}</span>
              <span className="opacity-90">{l.total_remaining_units} متبقي من {l.total_loaded_units}</span>
            </div>
          ))}
        </div>
      )}

      {snap.top_visit && (
        <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-cairo opacity-80">🏆 أكبر فاتورة اليوم</div>
            <Link href={`/visit/${snap.top_visit.visit_id}`} className="font-cairo font-bold text-sm hover:underline">
              {snap.top_visit.client_name}
            </Link>
          </div>
          <div className="font-cairo font-extrabold text-base" dir="ltr">{formatCurrency(snap.top_visit.amount)}</div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-cairo opacity-90 mb-1">
        <Icon size={12} /> {label}
      </div>
      <div className="font-cairo font-extrabold text-base" dir="ltr">{value}</div>
    </div>
  );
}
