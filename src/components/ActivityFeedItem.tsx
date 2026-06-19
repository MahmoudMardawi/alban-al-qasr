import { formatRelativeDate } from "@/lib/format";

interface Props {
  actor: string;
  action: string;
  summary: string | null;
  createdAt: string;
  unread: boolean;
}

const ACTION_LABEL: Record<string, { ar: string; emoji: string }> = {
  visit_created:       { ar: "زيارة جديدة",       emoji: "🛒" },
  visit_edited:        { ar: "تعديل زيارة",       emoji: "✏️" },
  client_added:        { ar: "زبون جديد",         emoji: "👤" },
  client_approved:     { ar: "موافقة على زبون",   emoji: "✓" },
  clients_merged:      { ar: "دمج زبائن",         emoji: "🔀" },
  expense_added:       { ar: "مصروف جديد",        emoji: "💸" },
  product_added:       { ar: "منتج جديد",         emoji: "📦" },
  production_recorded: { ar: "إنتاج جديد",        emoji: "🏭" },
  payment_recorded:    { ar: "دفعة مستلمة",       emoji: "💰" },
};

export function ActivityFeedItem({ actor, action, summary, createdAt, unread }: Props) {
  const label = ACTION_LABEL[action] ?? { ar: action, emoji: "•" };
  return (
    <li className={`flex items-start gap-2 p-3 rounded-xl ${unread ? "bg-yellow-50/40 border border-yellow-200" : "bg-white border border-border"}`}>
      <div className="text-base shrink-0">{label.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="font-cairo text-sm text-ink">
          <strong>{actor}</strong> <span className="text-muted">·</span> <span className="text-primary-dk">{label.ar}</span>
        </div>
        {summary && <div className="text-[12px] text-muted font-cairo mt-0.5">{summary}</div>}
        <div className="text-[10px] text-muted font-cairo mt-1">{formatRelativeDate(new Date(createdAt))}</div>
      </div>
      {unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
    </li>
  );
}
