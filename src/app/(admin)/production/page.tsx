import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Factory } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatDateShort, formatQty, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Row {
  id: string; qty_produced: number; qty_wasted: number; produced_at: string; note: string | null;
  products: { name_ar: string; base_unit: Unit } | null;
}

export default async function ProductionList() {
  const supabase = await createClient();
  const { data } = await supabase.from("production")
    .select("id, qty_produced, qty_wasted, produced_at, note, products(name_ar, base_unit)")
    .order("produced_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الإنتاج والفاقد ({rows.length})</h2>
        <Link href="/production/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> تسجيل جديد
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Factory} title="لا توجد سجلات إنتاج" ctaHref="/production/new" ctaLabel="تسجيل أول إنتاج" />
      ) : (
        <ul className="px-3 space-y-2">
          {rows.map((r) => {
            const unit = r.products?.base_unit ?? "piece";
            return (
              <li key={r.id} className="bg-white border border-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="font-cairo font-semibold text-ink text-sm">{r.products?.name_ar ?? "?"}</div>
                  <div className="text-[10px] text-muted font-cairo">{formatDateShort(new Date(r.produced_at))}</div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs font-cairo">
                  <span className="text-primary">منتج: <strong>{formatQty(Number(r.qty_produced), unit)}</strong></span>
                  {Number(r.qty_wasted) > 0 && (
                    <span className="text-warn">فاقد: <strong>{formatQty(Number(r.qty_wasted), unit)}</strong></span>
                  )}
                </div>
                {r.note && <p className="text-[10px] text-muted mt-1 font-cairo">{r.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
