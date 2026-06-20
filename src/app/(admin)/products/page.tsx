import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { type Unit } from "@/lib/format";
import { SearchableProductsList } from "@/components/SearchableProductsList";

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
        <SearchableProductsList products={products.map((p) => ({
          id: p.id, name_ar: p.name_ar, base_unit: p.base_unit, base_price: Number(p.base_price), is_active: p.is_active,
          packages: p.product_packages.map((pk) => ({
            id: pk.id, package_name: pk.package_name, package_price: Number(pk.package_price), is_active: pk.is_active,
          })),
        }))} />
      )}
    </div>
  );
}
