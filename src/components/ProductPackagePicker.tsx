"use client";

import { useState, useMemo } from "react";
import { calcBaseQty } from "@/lib/ledgers";
import type { LineType } from "@/lib/ledgers";
import { formatCurrency, formatQty, type Unit } from "@/lib/format";

export interface ProductForPicker {
  id: string;
  name_ar: string;
  base_unit: Unit;
  base_price: number;
  packages: Array<{ id: string; package_name: string; contains_qty: number; package_price: number }>;
}

export interface PickedLine {
  product_id: string;
  package_id: string | null;
  qty: number;
  base_qty: number;
  unit_price: number | null;
  line_type: LineType;
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (line: PickedLine) => void;
  lineType: LineType;
  products: ProductForPicker[];
  replacementDebt?: Map<string, number>;
}

export function ProductPackagePicker({ open, onClose, onPick, lineType, products, replacementDebt }: Props) {
  const [selected, setSelected] = useState<ProductForPicker | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);

  const filteredProducts = useMemo(() => {
    if (lineType !== "replacement_out" || !replacementDebt) return products;
    return products.filter((p) => (replacementDebt.get(p.id) ?? 0) > 0);
  }, [products, lineType, replacementDebt]);

  if (!open) return null;

  function pickProduct(p: ProductForPicker) {
    setSelected(p);
    setPackageId(null);
    setQty(1);
  }

  function confirm() {
    if (!selected) return;
    const pkg = packageId ? selected.packages.find((x) => x.id === packageId) ?? null : null;
    const baseQty = calcBaseQty(qty, pkg ? { contains_qty: pkg.contains_qty } : null);
    const unitPrice =
      lineType === "sale"
        ? pkg ? pkg.package_price : selected.base_price
        : null;
    onPick({
      product_id: selected.id,
      package_id: pkg?.id ?? null,
      qty,
      base_qty: baseQty,
      unit_price: unitPrice,
      line_type: lineType,
    });
    setSelected(null);
    setPackageId(null);
    setQty(1);
    onClose();
  }

  const title =
    lineType === "sale"            ? "اختر منتج للبيع" :
    lineType === "return_in"       ? "اختر منتج تالف/مرتجع" :
                                     "اختر منتج للبدل";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo font-bold text-ink text-base">{title}</h3>
          <button onClick={onClose} className="text-muted text-xs font-cairo">إلغاء</button>
        </div>

        {!selected ? (
          <ul className="space-y-2">
            {filteredProducts.length === 0 ? (
              <li className="text-center text-muted text-xs py-8 font-cairo">لا توجد منتجات</li>
            ) : (
              filteredProducts.map((p) => {
                const debtUnits = replacementDebt?.get(p.id);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => pickProduct(p)}
                      className="w-full flex items-center justify-between bg-info-bg/40 border border-border rounded-xl p-3 hover:bg-info-bg"
                    >
                      <span className="font-cairo font-semibold text-ink text-sm">{p.name_ar}</span>
                      <span className="text-[11px] text-muted font-cairo">
                        {lineType === "sale" ? formatCurrency(p.base_price) + "/" + p.base_unit : ""}
                        {lineType === "replacement_out" && debtUnits ? `متاح ${formatQty(debtUnits, p.base_unit)}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : (
          <div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted mb-3 font-cairo"
            >
              ← اختر منتج آخر
            </button>
            <h4 className="font-cairo font-bold text-forest text-sm mb-2">{selected.name_ar}</h4>
            <p className="text-xs text-muted mb-3 font-cairo">اختر العبوة:</p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 p-3 border border-border rounded-xl cursor-pointer hover:bg-info-bg/40">
                <input
                  type="radio"
                  name="pkg"
                  checked={packageId === null}
                  onChange={() => setPackageId(null)}
                />
                <span className="flex-1 font-cairo text-sm text-ink">
                  {selected.base_unit === "L" ? "لتر مفرد" : selected.base_unit === "kg" ? "كيلو مفرد" : "قطعة مفردة"}
                </span>
                {lineType === "sale" && (
                  <span className="text-xs text-primary font-cairo font-bold">
                    {formatCurrency(selected.base_price)}
                  </span>
                )}
              </label>

              {selected.packages.map((pkg) => (
                <label
                  key={pkg.id}
                  className="flex items-center gap-2 p-3 border border-border rounded-xl cursor-pointer hover:bg-info-bg/40"
                >
                  <input
                    type="radio"
                    name="pkg"
                    checked={packageId === pkg.id}
                    onChange={() => setPackageId(pkg.id)}
                  />
                  <span className="flex-1 font-cairo text-sm text-ink">
                    {pkg.package_name} ({pkg.contains_qty} {selected.base_unit})
                  </span>
                  {lineType === "sale" && (
                    <span className="text-xs text-primary font-cairo font-bold">
                      {formatCurrency(pkg.package_price)}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <label className="font-cairo text-sm text-ink">الكمية:</label>
              <input
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-ink text-center font-cairo"
              />
            </div>

            <button
              onClick={confirm}
              className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk"
            >
              إضافة إلى الزيارة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
