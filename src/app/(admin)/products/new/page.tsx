import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductForm } from "@/components/ProductForm";

export default function NewProduct() {
  return (
    <div className="p-4">
      <Link href="/products" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">منتج جديد</h2>
      <ProductForm initial={{
        name_ar: "", base_unit: "L", base_price: "", base_cost: "", is_active: true, packages: [],
      }} />
    </div>
  );
}
