"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, Edit3 } from "lucide-react";
import { formatCurrency, type Unit } from "@/lib/format";

export interface SearchableProductRow {
  id: string;
  name_ar: string;
  base_unit: Unit;
  base_price: number;
  is_active: boolean;
  packages: Array<{ id: string; package_name: string; package_price: number; is_active: boolean }>;
}

export function SearchableProductsList({ products }: { products: SearchableProductRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    if (!norm) return products;
    return products.filter((p) =>
      p.name_ar?.toLowerCase().includes(norm) ||
      p.packages.some((pk) => pk.package_name?.toLowerCase().includes(norm)),
    );
  }, [q, products]);

  return (
    <div>
      <div className="px-3 mb-2 relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-6 text-muted pointer-events-none" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المنتج أو العبوة..."
          className="w-full ps-9 pe-9 py-2.5 rounded-xl border border-border bg-white text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2 end-6 text-muted" aria-label="مسح">
            <X size={14} />
          </button>
        )}
      </div>

      {q && (
        <div className="px-4 mb-2 text-[11px] text-muted font-cairo">
          {filtered.length === 0 ? "لا توجد نتائج" : `${filtered.length} منتج`}
        </div>
      )}

      <ul className="px-3 space-y-2">
        {filtered.map((p) => {
          const activePackages = p.packages.filter((pk) => pk.is_active);
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
    </div>
  );
}
