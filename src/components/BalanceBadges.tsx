import { formatCurrency, formatQty, type Unit } from "@/lib/format";

export interface BalanceData {
  money_owed: number;
  replacements: Array<{ product_name_ar: string; unit: Unit; owed_base_qty: number }>;
}

export function BalanceBadges({ data }: { data: BalanceData }) {
  const owesMoney = data.money_owed > 0;
  const hasReplacements = data.replacements.length > 0;
  const settled = !owesMoney && !hasReplacements;

  return (
    <div className="flex gap-1.5 flex-wrap">
      {settled && (
        <span className="text-[10px] font-cairo font-semibold px-2 py-1 rounded-md bg-info-bg text-primary border border-border">
          ✓ مسوّى
        </span>
      )}
      {owesMoney && (
        <span className="text-[10px] font-cairo font-semibold px-2 py-1 rounded-md bg-orange-50 text-warn border border-orange-200">
          💰 {formatCurrency(data.money_owed)}
        </span>
      )}
      {data.replacements.map((r) => (
        <span
          key={r.product_name_ar}
          className="text-[10px] font-cairo font-semibold px-2 py-1 rounded-md bg-info-bg text-primary-dk border border-border"
        >
          🥛 {formatQty(r.owed_base_qty, r.unit)} {r.product_name_ar}
        </span>
      ))}
    </div>
  );
}
