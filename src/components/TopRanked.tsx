import { formatCurrency } from "@/lib/format";

interface Item { id: string; label: string; value: number }

interface Props {
  items: Item[];
  emptyText?: string;
}

export function TopRanked({ items, emptyText = "لا توجد بيانات" }: Props) {
  if (items.length === 0) {
    return <p className="text-center text-muted text-xs py-4 font-cairo">{emptyText}</p>;
  }
  return (
    <ul className="bg-white border border-border rounded-xl divide-y divide-border">
      {items.map((it, idx) => (
        <li key={it.id} className="flex items-center justify-between px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-info-bg text-primary-dk text-[10px] font-cairo font-bold flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="font-cairo text-sm text-ink">{it.label}</span>
          </span>
          <span className="font-cairo font-bold text-primary text-sm">{formatCurrency(it.value)}</span>
        </li>
      ))}
    </ul>
  );
}
