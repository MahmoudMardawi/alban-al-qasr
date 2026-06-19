"use client";

import { X } from "lucide-react";

export interface PackageDraft {
  id?: string;
  package_name: string;
  contains_qty: string;
  package_price: string;
}

interface Props {
  pkg: PackageDraft;
  onChange: (p: PackageDraft) => void;
  onRemove: () => void;
}

export function PackageInputRow({ pkg, onChange, onRemove }: Props) {
  return (
    <div className="bg-info-bg/40 border border-border rounded-xl p-3 grid grid-cols-12 gap-2 items-center">
      <input
        type="text"
        placeholder="اسم العبوة (مثل: كرتونة)"
        value={pkg.package_name}
        onChange={(e) => onChange({ ...pkg, package_name: e.target.value })}
        className="col-span-5 rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-cairo focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="number"
        inputMode="decimal" step="any" min="0"
        placeholder="يحتوي"
        value={pkg.contains_qty}
        onChange={(e) => onChange({ ...pkg, contains_qty: e.target.value })}
        className="col-span-3 rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-cairo text-center focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="number"
        inputMode="decimal" step="any" min="0"
        placeholder="السعر"
        value={pkg.package_price}
        onChange={(e) => onChange({ ...pkg, package_price: e.target.value })}
        className="col-span-3 rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-cairo text-center focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="حذف العبوة"
        className="col-span-1 text-muted hover:text-danger flex justify-center"
      >
        <X size={16} />
      </button>
    </div>
  );
}
