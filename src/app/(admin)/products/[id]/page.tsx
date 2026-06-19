import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductForm } from "@/components/ProductForm";
import type { Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [productRes, packagesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("product_packages").select("*").eq("product_id", id).eq("is_active", true).order("created_at"),
  ]);

  if (productRes.error || !productRes.data) return notFound();
  const p = productRes.data;

  return (
    <div className="p-4">
      <Link href="/products" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">تعديل المنتج: {p.name_ar}</h2>
      <ProductForm initial={{
        id: p.id,
        name_ar: p.name_ar,
        base_unit: p.base_unit as Unit,
        base_price: String(p.base_price),
        base_cost: p.base_cost === null ? "" : String(p.base_cost),
        is_active: p.is_active,
        packages: (packagesRes.data ?? []).map((pkg) => ({
          id: pkg.id,
          package_name: pkg.package_name,
          contains_qty: String(pkg.contains_qty),
          package_price: String(pkg.package_price),
        })),
      }} />
    </div>
  );
}
