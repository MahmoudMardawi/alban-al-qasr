import { formatCurrency } from "@/lib/format";

interface Props {
  label: string;
  value: string | number;
  formatAsCurrency?: boolean;
  deltaPct?: number | null;
  hero?: boolean;
  emoji?: string;
}

export function StatTile({ label, value, formatAsCurrency, deltaPct, hero, emoji }: Props) {
  const display =
    typeof value === "number" && formatAsCurrency ? formatCurrency(value) : String(value);

  const deltaText =
    deltaPct === null || deltaPct === undefined
      ? null
      : deltaPct > 0
        ? `▲ ${deltaPct}%`
        : deltaPct < 0
          ? `▼ ${Math.abs(deltaPct)}%`
          : "—";
  const deltaColor =
    deltaPct === null || deltaPct === undefined
      ? "text-muted"
      : deltaPct > 0 ? "text-primary" : deltaPct < 0 ? "text-warn" : "text-muted";

  return (
    <div className={`rounded-2xl p-3 ${hero ? "bg-gradient-to-br from-forest to-primary-dk text-white col-span-2" : "bg-white border border-border"}`}>
      <div className={`text-[10px] font-cairo ${hero ? "text-white/80" : "text-muted"}`}>
        {emoji} {label}
      </div>
      <div className={`font-cairo font-extrabold mt-1 ${hero ? "text-2xl" : "text-xl text-ink"}`}>{display}</div>
      {deltaText && (
        <div className={`text-[10px] font-cairo mt-1 ${hero ? "text-white/80" : deltaColor}`}>{deltaText} مقارنة بالفترة السابقة</div>
      )}
    </div>
  );
}
