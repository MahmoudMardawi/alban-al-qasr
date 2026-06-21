import Link from "next/link";
import { ArrowRight, Recycle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConversionForm } from "./conversion-form";
import { formatQty, formatDateShort, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  const supabase = await createClient();
  const { data: productsData } = await supabase.from("products")
    .select("id, name_ar, base_unit")
    .eq("is_active", true)
    .order("name_ar");
  type P = { id: string; name_ar: string; base_unit: Unit };
  const products = (productsData ?? []) as P[];

  const { data: conversionsData } = await supabase
    .from("product_conversions")
    .select("id, source_qty, target_qty, converted_at, notes, source:source_product_id(name_ar, base_unit), target:target_product_id(name_ar, base_unit)")
    .order("converted_at", { ascending: false })
    .limit(30);
  type Conv = {
    id: string;
    source_qty: number;
    target_qty: number;
    converted_at: string;
    notes: string | null;
    source: { name_ar: string; base_unit: Unit } | null;
    target: { name_ar: string; base_unit: Unit } | null;
  };
  const conversions = (conversionsData ?? []) as unknown as Conv[];

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-info to-cyan-700 text-white p-4">
        <Link href="/dashboard" className="flex items-center gap-1 text-xs text-white/80 mb-2">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <div className="flex items-center gap-2">
          <Recycle size={22} />
          <h2 className="font-cairo font-bold text-lg">تدوير الأصناف</h2>
        </div>
        <p className="text-xs opacity-80 mt-0.5">
          سجّل تحويل صنف إلى آخر (مثلاً لبن تالف → جبنة، جبنة → جبنة مبروشة)
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <ConversionForm products={products} />

        <div>
          <h3 className="font-cairo font-semibold text-muted text-xs mb-2">آخر التحويلات</h3>
          {conversions.length === 0 ? (
            <div className="bg-info-bg/40 border border-border rounded-xl p-6 text-center text-muted font-cairo text-sm">
              لم يُسجَّل أي تحويل بعد
            </div>
          ) : (
            <ul className="space-y-2">
              {conversions.map((c) => (
                <li key={c.id} className="bg-white border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] text-muted font-cairo" dir="ltr">
                      {formatDateShort(new Date(c.converted_at))}
                    </div>
                    {c.notes && <div className="text-[10px] text-muted font-cairo truncate max-w-[60%]">{c.notes}</div>}
                  </div>
                  <div className="flex items-center justify-between font-cairo text-sm">
                    <div className="text-warn font-bold">
                      {formatQty(Number(c.source_qty), c.source?.base_unit ?? "piece")} {c.source?.name_ar ?? "—"}
                    </div>
                    <div className="text-muted px-2">←</div>
                    <div className="text-primary-dk font-bold">
                      {formatQty(Number(c.target_qty), c.target?.base_unit ?? "piece")} {c.target?.name_ar ?? "—"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
