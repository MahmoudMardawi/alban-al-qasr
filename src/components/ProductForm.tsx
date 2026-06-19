"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PackageInputRow, type PackageDraft } from "./PackageInputRow";
import { createProduct, updateProduct, addPackage, updatePackage, deletePackage } from "@/app/(admin)/products/actions";
import type { Unit } from "@/lib/format";

export interface ProductFormInitial {
  id?: string;
  name_ar: string;
  base_unit: Unit;
  base_price: string;
  base_cost: string;
  is_active: boolean;
  packages: PackageDraft[];
}

export function ProductForm({ initial }: { initial: ProductFormInitial }) {
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [name_ar, setNameAr]     = useState(initial.name_ar);
  const [base_unit, setUnit]     = useState<Unit>(initial.base_unit);
  const [base_price, setPrice]   = useState(initial.base_price);
  const [base_cost, setCost]     = useState(initial.base_cost);
  const [is_active, setActive]   = useState(initial.is_active);
  const [packages, setPackages]  = useState<PackageDraft[]>(initial.packages);
  const [error, setError]        = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addRow() {
    setPackages([...packages, { package_name: "", contains_qty: "", package_price: "" }]);
  }

  function updateRow(idx: number, p: PackageDraft) {
    setPackages(packages.map((x, i) => i === idx ? p : x));
  }

  function removeRow(idx: number) {
    const p = packages[idx];
    if (p.id) {
      startTransition(async () => {
        const res = await deletePackage(p.id!);
        if (res.error) { setError(res.error); return; }
        setPackages(packages.filter((_, i) => i !== idx));
      });
    } else {
      setPackages(packages.filter((_, i) => i !== idx));
    }
  }

  function submit() {
    setError(null);
    const priceNum = Number(base_price);
    const costNum  = base_cost.trim() === "" ? null : Number(base_cost);

    const productPayload = { name_ar, base_unit, base_price: priceNum, base_cost: costNum, is_active };

    const newPackagePayloads = packages.filter((p) => !p.id).map((p) => ({
      package_name:  p.package_name,
      contains_qty:  Number(p.contains_qty),
      package_price: Number(p.package_price),
    }));
    const existingPackagePayloads = packages.filter((p) => p.id).map((p) => ({
      id: p.id!,
      package_name:  p.package_name,
      contains_qty:  Number(p.contains_qty),
      package_price: Number(p.package_price),
    }));

    startTransition(async () => {
      try {
        if (editing) {
          const res = await updateProduct(initial.id!, { product: productPayload });
          if (res.error) { setError(res.error); return; }
          for (const pkg of existingPackagePayloads) {
            const upd = await updatePackage(pkg.id, {
              package_name: pkg.package_name, contains_qty: pkg.contains_qty, package_price: pkg.package_price,
            });
            if (upd.error) { setError(upd.error); return; }
          }
          for (const pkg of newPackagePayloads) {
            const ins = await addPackage(initial.id!, pkg);
            if (ins.error) { setError(ins.error); return; }
          }
        } else {
          const res = await createProduct({ product: productPayload, packages: newPackagePayloads });
          if (res.error) { setError(res.error); return; }
          if (!res.id)    { setError("استجابة غير متوقعة"); return; }
        }
        router.push("/products");
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  return (
    <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">اسم المنتج *</label>
        <input value={name_ar} onChange={(e) => setNameAr(e.target.value)} required
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="block text-xs font-cairo text-ink mb-1">الوحدة *</label>
          <select value={base_unit} onChange={(e) => setUnit(e.target.value as Unit)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="L">لتر</option>
            <option value="kg">كيلو</option>
            <option value="piece">قطعة</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-cairo text-ink mb-1">السعر *</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={base_price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-xs font-cairo text-ink mb-1">التكلفة</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={base_cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm font-cairo text-ink">
          <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
          فعّال (يظهر للموظفين عند إنشاء زيارة)
        </label>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-cairo font-semibold text-ink text-sm">العبوات</h4>
          <button type="button" onClick={addRow} className="text-primary text-xs font-cairo font-semibold flex items-center gap-1">
            <Plus size={14} /> إضافة عبوة
          </button>
        </div>
        {packages.length === 0 && (
          <p className="text-muted text-xs font-cairo">لا توجد عبوات. سيُباع المنتج بالوحدة المفردة فقط.</p>
        )}
        <div className="space-y-2">
          {packages.map((pkg, idx) => (
            <PackageInputRow key={pkg.id ?? `new-${idx}`} pkg={pkg}
              onChange={(p) => updateRow(idx, p)} onRemove={() => removeRow(idx)} />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>
      )}

      <button onClick={submit} disabled={pending}
        className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
        {pending ? "جارٍ الحفظ..." : (editing ? "حفظ التغييرات" : "إضافة المنتج")}
      </button>
    </div>
  );
}
