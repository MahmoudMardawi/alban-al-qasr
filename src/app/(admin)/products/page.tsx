import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Package, Edit3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ProductRow {
  id: string; name_ar: string; base_unit: Unit; base_price: number; is_active: boolean;
  product_packages: { id: string; package_name: string; contains_qty: number; package_price: number; is_active: boolean }[];
}

export default async function ProductsList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name_ar, base_unit, base_price, is_active, product_packages(id, package_name, contains_qty, package_price, is_active)")
    .order("name_ar");
  const products = (data ?? []) as unknown as ProductRow[];

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">المنتجات ({products.length})</h2>
        <Link href="/products/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> منتج جديد
        </Link>
      </div>

      {products.length === 0 ? (
        <EmptyState icon={Package} title="لا توجد منتجات بعد" subtitle="ابدأ بإضافة لبن، لبنة، جبنة..." ctaHref="/products/new" ctaLabel="إضافة أول منتج" />
      ) : (
        <ul className="px-3 space-y-2">
          {products.map((p) => {
            const activePackages = p.product_packages.filter((pk) => pk.is_active);
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="block bg-white border border-border rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-cairo font-semibold text-ink text-sm">
                      {p.name_ar}
                      {!p.is_active && <span className="text-[9px] mr-2 text-muted font-cairo">(معطّل)</span>}
                    </h3>
                    <span className="text-primary text-xs font-cairo font-bold">
                      {formatCurrency(p.base_price)} / {p.base_unit === "L" ? "لتر" : p.base_unit === "kg" ? "كيلو" : "قطعة"}
                    </span>
                  </div>
                  {activePackages.length > 0 && (
                    <p className="text-[10px] text-muted font-cairo">
                      {activePackages.length} عبوة: {activePackages.map((pk) => `${pk.package_name} ${formatCurrency(pk.package_price)}`).join(" · ")}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-primary mt-1.5 font-cairo">
                    <Edit3 size={11} /> تعديل
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
