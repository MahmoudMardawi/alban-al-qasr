import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight, Truck } from "lucide-react";
import { StartLoadForm } from "./start-load-form";
import { CloseLoadForm } from "./close-load-form";
import { formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ProductRow {
  id: string;
  name_ar: string;
  base_unit: "L" | "kg" | "piece";
}

interface OpenLoadItem {
  product_id: string;
  qty_loaded: number;
  qty_returned: number;
  product_name: string;
  product_unit: "L" | "kg" | "piece";
}

interface OpenLoadView {
  id: string;
  loaded_at: string;
  items: OpenLoadItem[];
  /** sold today from this load's products (qty in base units) */
  soldByProduct: Map<string, number>;
  /** damaged returns recorded from customers today (qty in base units) */
  damagedByProduct: Map<string, number>;
}

export default async function LoadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="p-6 text-center text-muted font-cairo text-sm">سجّل دخول أولاً</div>;
  }

  const productsRes = await supabase.from("products")
    .select("id, name_ar, base_unit")
    .eq("is_active", true)
    .order("name_ar");
  const products = (productsRes.data ?? []) as ProductRow[];

  // Find today's open load for this employee
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const openLoadRes = await supabase.from("truck_loads")
    .select("id, loaded_at")
    .eq("employee_id", user.id)
    .eq("status", "open")
    .eq("loaded_at", todayDate)
    .maybeSingle();
  const openLoad = openLoadRes.data;

  let view: OpenLoadView | null = null;
  if (openLoad) {
    const itemsRes = await supabase.from("truck_load_items")
      .select("product_id, qty_loaded, qty_returned")
      .eq("load_id", openLoad.id);
    const itemRows = itemsRes.data ?? [];

    const productMap = new Map(products.map((p) => [p.id, p]));
    const items: OpenLoadItem[] = itemRows.map((r) => {
      const p = productMap.get(r.product_id);
      return {
        product_id:   r.product_id,
        qty_loaded:   Number(r.qty_loaded),
        qty_returned: Number(r.qty_returned),
        product_name: p?.name_ar ?? "?",
        product_unit: p?.base_unit ?? "piece",
      };
    });

    // Compute today's visit activity for this employee:
    //   sold/bonus/replacement → leaves truck (drives shortage math)
    //   return_in (damaged) → coming back to factory, tracked separately
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    const visitsRes = await supabase.from("visits")
      .select("id, visit_lines(product_id, base_qty, line_type)")
      .eq("employee_id", user.id)
      .gte("visited_at", startOfDay)
      .lt("visited_at", endOfDay);
    type Vlite = { visit_lines: Array<{ product_id: string; base_qty: number; line_type: string }> };
    const visits = (visitsRes.data ?? []) as unknown as Vlite[];

    const soldByProduct    = new Map<string, number>();
    const damagedByProduct = new Map<string, number>();
    for (const v of visits) for (const l of v.visit_lines) {
      if (l.line_type === "sale" || l.line_type === "replacement_out" || l.line_type === "bonus") {
        soldByProduct.set(l.product_id, (soldByProduct.get(l.product_id) ?? 0) + Number(l.base_qty));
      } else if (l.line_type === "return_in") {
        damagedByProduct.set(l.product_id, (damagedByProduct.get(l.product_id) ?? 0) + Number(l.base_qty));
      }
    }
    view = { id: openLoad.id, loaded_at: openLoad.loaded_at, items, soldByProduct, damagedByProduct };
  }

  // Recent closed loads (last 7 days) for history view
  const recentRes = await supabase.from("truck_loads")
    .select("id, loaded_at, closed_at, status")
    .eq("employee_id", user.id)
    .order("loaded_at", { ascending: false })
    .limit(7);
  const recent = recentRes.data ?? [];

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white p-4">
        <Link href="/" className="flex items-center gap-1 text-xs text-white/80 mb-2">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <div className="flex items-center gap-2">
          <Truck size={22} />
          <h2 className="font-cairo font-bold text-lg">تحميل السيارة</h2>
        </div>
        <p className="text-xs opacity-80 mt-0.5">
          {view ? "تحميل اليوم مفتوح — سجّل التحميل الصباحي والمرتجع نهاية اليوم" : "ابدأ تحميل اليوم وحدّد الكميات لكل منتج"}
        </p>
      </div>

      <div className="px-4 py-4">
        {view ? (
          <CloseLoadForm load={view} />
        ) : (
          <StartLoadForm products={products} />
        )}

        {recent.length > 0 && (
          <div className="mt-8">
            <h3 className="font-cairo font-semibold text-muted text-xs mb-2">السجلّ الأخير</h3>
            <ul className="space-y-1.5">
              {recent.map((r) => (
                <li key={r.id} className="bg-white border border-border rounded-xl px-3 py-2 flex items-center justify-between text-xs font-cairo">
                  <span className="text-ink">{formatDateShort(new Date(r.loaded_at))}</span>
                  <span className={r.status === "open" ? "text-warn font-bold" : "text-primary-dk font-bold"}>
                    {r.status === "open" ? "🟠 مفتوح" : "✓ مُغلق"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
