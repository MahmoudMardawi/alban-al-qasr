import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { StatTile } from "@/components/StatTile";
import { RevenueLineChart } from "@/components/RevenueLineChart";
import { ExpensePieChart } from "@/components/ExpensePieChart";
import { TopRanked } from "@/components/TopRanked";
import { getDashboardData } from "@/lib/dashboard-data";
import { type Period } from "@/lib/periods";
import { formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = VALID_PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "monthly";
  const data = await getDashboardData(period);

  return (
    <div className="pb-4">
      <PeriodSwitcher current={period} />

      <div className="px-4 grid grid-cols-2 gap-2">
        <StatTile hero label="صافي الربح" value={data.hero.netProfit} formatAsCurrency deltaPct={data.hero.deltaPct} emoji="💰" />
        <StatTile label="المبيعات" value={data.stats.sales} formatAsCurrency deltaPct={data.stats.salesDeltaPct} emoji="📈" />
        <StatTile label="المصاريف" value={data.stats.expenses} formatAsCurrency deltaPct={data.stats.expensesDeltaPct} emoji="💸" />
        <StatTile label="الفاقد" value={formatQty(data.stats.wasteUnits, "L")} emoji="🗑️" />
        <StatTile label="المرتجعات" value={formatQty(data.stats.returnsUnits, "L")} emoji="↩️" />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">📈 المبيعات اليومية</h3>
      <div className="mx-4 bg-white border border-border rounded-xl p-3">
        <RevenueLineChart data={data.revenueByDay} />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">💸 توزيع المصاريف</h3>
      <div className="mx-4 bg-white border border-border rounded-xl p-3">
        <ExpensePieChart data={data.expensesByCategory} />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">🏆 أفضل الزبائن</h3>
      <div className="mx-4">
        <TopRanked items={data.topClients.map((c) => ({ id: c.id, label: c.name, value: c.revenue }))} emptyText="لا توجد مبيعات في هذه الفترة" />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">📦 أفضل المنتجات</h3>
      <div className="mx-4">
        <TopRanked items={data.topProducts.map((p) => ({ id: p.id, label: p.name_ar, value: p.revenue }))} emptyText="لا توجد مبيعات في هذه الفترة" />
      </div>
    </div>
  );
}
