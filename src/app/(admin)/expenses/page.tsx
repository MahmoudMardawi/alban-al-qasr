import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { fuel: "وقود", salary: "رواتب", rent: "إيجار", milk: "حليب خام", other: "أخرى" };

export default async function ExpensesList() {
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("*").order("spent_at", { ascending: false }).limit(100);
  const expenses = data ?? [];
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">المصاريف ({expenses.length})</h2>
        <Link href="/expenses/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> مصروف جديد
        </Link>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="لا توجد مصاريف بعد" ctaHref="/expenses/new" ctaLabel="إضافة أول مصروف" />
      ) : (
        <>
          <div className="mx-3 mb-3 bg-forest text-white rounded-xl p-3 text-center">
            <div className="text-[11px] opacity-80 font-cairo">المجموع المعروض</div>
            <div className="font-cairo font-extrabold text-xl mt-1">{formatCurrency(total)}</div>
          </div>
          <ul className="px-3 space-y-2">
            {expenses.map((e) => (
              <li key={e.id} className="bg-white border border-border rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-cairo font-semibold text-ink text-sm">{LABELS[e.category] ?? e.category}</div>
                  <div className="text-[10px] text-muted font-cairo mt-0.5">
                    {formatDateShort(new Date(e.spent_at))}{e.note ? ` · ${e.note}` : ""}{e.receipt_url ? " · 📷" : ""}
                  </div>
                </div>
                <div className="font-cairo font-bold text-warn text-sm">{formatCurrency(Number(e.amount))}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
