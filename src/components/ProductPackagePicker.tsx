"use client";

import { useState, useMemo } from "react";
import { Search, X as XIcon } from "lucide-react";
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
  /** Remaining qty per product currently on the employee's truck, in base units.
   *  Updates as draft lines are added. Only shown for sale + replacement_out modes. */
  truckStock?: Map<string, number>;
  /** When true, skip the replacement-debt filter for replacement_out
   *  (used for swap-on-return where any product can be the replacement). */
  bypassDebtFilter?: boolean;
}

export function ProductPackagePicker({ open, onClose, onPick, lineType, products, replacementDebt, truckStock, bypassDebtFilter }: Props) {
  const [selected, setSelected] = useState<ProductForPicker | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [qtyText, setQtyText] = useState<string>("1");
  const [productSearch, setProductSearch] = useState("");

  const parsedQty = Number(qtyText);
  const qtyValid = qtyText.trim() !== "" && Number.isFinite(parsedQty) && parsedQty > 0;
  const qtyTouched = qtyText !== "1";

  const filteredProducts = useMemo(() => {
    let list = products;
    if (lineType === "replacement_out" && replacementDebt && !bypassDebtFilter) {
      list = list.filter((p) => (replacementDebt.get(p.id) ?? 0) > 0);
    }
    const q = productSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.name_ar.toLowerCase().includes(q) ||
        p.packages.some((pk) => pk.package_name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [products, lineType, replacementDebt, bypassDebtFilter, productSearch]);

  // ===== Validation: requested qty must fit on the truck + within replacement debt =====
  const selectedPkg = selected && packageId ? selected.packages.find((x) => x.id === packageId) ?? null : null;
  const requestedBaseQty = selected && qtyValid
    ? calcBaseQty(parsedQty, selectedPkg ? { contains_qty: selectedPkg.contains_qty } : null)
    : 0;

  const enforceTruck = selected && truckStock && (lineType === "sale" || lineType === "replacement_out" || lineType === "bonus");
  const truckRemaining = enforceTruck ? (truckStock!.get(selected!.id) ?? 0) : Infinity;
  const exceedsTruck   = enforceTruck && requestedBaseQty > truckRemaining;

  const enforceDebt = selected && lineType === "replacement_out" && replacementDebt && !bypassDebtFilter;
  const debtAvailable = enforceDebt ? (replacementDebt!.get(selected!.id) ?? 0) : Infinity;
  const exceedsDebt   = enforceDebt && requestedBaseQty > debtAvailable;

  const blockedByValidation = exceedsTruck || exceedsDebt;
  const canConfirm = qtyValid && !blockedByValidation;

  if (!open) return null;

  function pickProduct(p: ProductForPicker) {
    setSelected(p);
    setPackageId(null);
    setQtyText("1");
  }

  function confirm() {
    if (!selected || !canConfirm) return;
    const pkg = packageId ? selected.packages.find((x) => x.id === packageId) ?? null : null;
    const baseQty = calcBaseQty(parsedQty, pkg ? { contains_qty: pkg.contains_qty } : null);
    const unitPrice =
      lineType === "sale"
        ? pkg ? pkg.package_price : selected.base_price
        : null;
    onPick({
      product_id: selected.id,
      package_id: pkg?.id ?? null,
      qty: parsedQty,
      base_qty: baseQty,
      unit_price: unitPrice,
      line_type: lineType,
    });
    setSelected(null);
    setPackageId(null);
    setQtyText("1");
    setProductSearch("");
    onClose();
  }

  const title =
    lineType === "sale"             ? "اختر منتج للبيع" :
    lineType === "return_in"        ? "اختر منتج تالف/مرتجع" :
    lineType === "bonus"            ? "اختر منتج للبونص (مجاناً)" :
    bypassDebtFilter                ? "اختر صنف بديل (تبديل صنف بصنف)" :
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
          <>
            <div className="mb-3 relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted pointer-events-none" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="ابحث عن منتج أو عبوة..."
                className="w-full ps-8 pe-8 py-2 rounded-xl border border-border bg-white text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              {productSearch && (
                <button type="button" onClick={() => setProductSearch("")} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted" aria-label="مسح">
                  <XIcon size={14} />
                </button>
              )}
            </div>
          <ul className="space-y-2">
            {filteredProducts.length === 0 ? (
              <li className="text-center text-muted text-xs py-8 font-cairo">{productSearch ? "لا توجد نتائج" : "لا توجد منتجات"}</li>
            ) : (
              filteredProducts.map((p) => {
                const debtUnits = replacementDebt?.get(p.id);
                const showTruck = (lineType === "sale" || lineType === "replacement_out" || lineType === "bonus") && truckStock;
                const stockUnits = showTruck ? (truckStock.get(p.id) ?? 0) : null;
                const outOfStock = showTruck && stockUnits !== null && stockUnits <= 0;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => pickProduct(p)}
                      className={`w-full flex flex-col gap-1 border rounded-xl p-3 ${
                        outOfStock
                          ? "bg-red-50/60 border-red-200 opacity-90"
                          : "bg-info-bg/40 border-border hover:bg-info-bg"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-cairo font-semibold text-ink text-sm">{p.name_ar}</span>
                        <span className="text-[11px] text-muted font-cairo">
                          {lineType === "sale" ? formatCurrency(p.base_price) + "/" + p.base_unit : ""}
                          {lineType === "replacement_out" && debtUnits ? `متاح ${formatQty(debtUnits, p.base_unit)}` : ""}
                        </span>
                      </div>
                      {showTruck && stockUnits !== null && (
                        <div className={`text-[10px] font-cairo flex items-center gap-1 ${
                          outOfStock ? "text-danger font-bold" : stockUnits < 5 ? "text-warn font-bold" : "text-primary-dk"
                        }`}>
                          🚚 {outOfStock ? "نفد من السيارة!" : `متبقي بالسيارة: ${formatQty(stockUnits, p.base_unit)}`}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          </>
        ) : (
          <div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted mb-3 font-cairo"
            >
              ← اختر منتج آخر
            </button>
            <h4 className="font-cairo font-bold text-forest text-sm mb-1">{selected.name_ar}</h4>
            {(lineType === "sale" || lineType === "replacement_out" || lineType === "bonus") && truckStock && (
              <div className={`text-[11px] font-cairo mb-2 ${
                (truckStock.get(selected.id) ?? 0) <= 0 ? "text-danger font-bold" :
                (truckStock.get(selected.id) ?? 0) < 5  ? "text-warn font-bold" :
                "text-primary-dk"
              }`}>
                🚚 متبقي بالسيارة: {formatQty(truckStock.get(selected.id) ?? 0, selected.base_unit)}
              </div>
            )}
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

            <div className="mb-4">
              <div className="flex items-center gap-3">
                <label htmlFor="picker-qty" className="font-cairo text-sm text-ink">الكمية:</label>
                <input
                  id="picker-qty"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={qtyText}
                  onChange={(e) => setQtyText(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="مثال: 3"
                  className={`flex-1 rounded-xl border bg-surface px-3 py-2 text-ink text-center font-cairo focus:outline-none focus:ring-2 ${
                    (!qtyValid && qtyTouched) || blockedByValidation
                      ? "border-danger focus:ring-danger"
                      : "border-border focus:ring-primary"
                  }`}
                />
              </div>
              {selectedPkg && (
                <p className="text-[10px] text-muted font-cairo mt-1 text-end">
                  = {formatQty(requestedBaseQty, selected!.base_unit)} (وحدة أساسية)
                </p>
              )}
              {!qtyValid && qtyTouched && (
                <p className="text-danger text-[11px] font-cairo mt-1.5">
                  أدخل كمية أكبر من صفر
                </p>
              )}
              {exceedsTruck && (
                <div className="mt-2 rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">
                  ⚠ الكمية المطلوبة ({formatQty(requestedBaseQty, selected!.base_unit)}) تفوق المتبقي بالسيارة ({formatQty(truckRemaining, selected!.base_unit)}).
                  <br />
                  إما خفّض الكمية، أو سجّل تحميلًا إضافيًا، أو اعتذر للزبون.
                </div>
              )}
              {exceedsDebt && !exceedsTruck && (
                <div className="mt-2 rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">
                  ⚠ الكمية المطلوبة ({formatQty(requestedBaseQty, selected!.base_unit)}) تفوق ما هو مستحق للزبون كبدل ({formatQty(debtAvailable, selected!.base_unit)}).
                </div>
              )}
            </div>

            <button
              onClick={confirm}
              disabled={!canConfirm}
              className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60 disabled:cursor-not-allowed"
            >
              إضافة إلى الزيارة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
