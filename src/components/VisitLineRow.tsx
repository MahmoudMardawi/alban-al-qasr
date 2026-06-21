import type { PickedLine } from "./ProductPackagePicker";
import { formatCurrency, formatQty, type Unit } from "@/lib/format";
import { X } from "lucide-react";

interface Props {
  line: PickedLine;
  productName: string;
  productUnit: Unit;
  packageName?: string | null;
  onRemove: () => void;
}

const TYPE_BORDER = {
  sale:             "border-r-primary",
  return_in:        "border-r-warn",
  replacement_out:  "border-r-primary-dk",
  bonus:            "border-r-info",
} as const;

const TYPE_BADGE = {
  sale:             { ar: "+ بيع",     cls: "text-primary" },
  return_in:        { ar: "↩ مرتجع",   cls: "text-warn" },
  replacement_out:  { ar: "🔄 بدل",   cls: "text-primary-dk" },
  bonus:            { ar: "🎁 بونص",   cls: "text-info" },
} as const;

export function VisitLineRow({ line, productName, productUnit, packageName, onRemove }: Props) {
  const badge = TYPE_BADGE[line.line_type];
  const subtotalText =
    line.line_type === "sale"
      ? formatCurrency(line.qty * (line.unit_price ?? 0))
      : "بدون مقابل";

  return (
    <div className={`flex items-start justify-between bg-white border border-border border-r-4 ${TYPE_BORDER[line.line_type]} rounded-xl px-3 py-2.5 mb-1.5`}>
      <div className="min-w-0">
        <div className="font-cairo font-semibold text-ink text-sm">
          <span className={`text-xs font-bold ${badge.cls} ml-1`}>{badge.ar}</span>
          {productName} — {formatQty(line.base_qty, productUnit)}
        </div>
        <div className="text-[10px] text-muted mt-0.5 font-cairo">
          {packageName ? `${line.qty} × ${packageName}` : "مفرد"}
          {line.line_type === "sale" && line.unit_price !== null
            ? ` · ${formatCurrency(line.unit_price)} لكل وحدة`
            : line.line_type === "replacement_out"
            ? " · بدل (تسوية دين سابق)"
            : line.line_type === "bonus"
            ? " · بونص (مجاناً للزبون)"
            : ""}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 ms-2">
        <span className={`font-cairo font-bold text-sm ${
          line.line_type === "sale" ? "text-ink" :
          line.line_type === "bonus" ? "text-info" :
          "text-primary-dk"
        }`}>
          {line.line_type === "bonus" ? "🎁 مجاناً" : subtotalText}
        </span>
        <button onClick={onRemove} className="text-muted hover:text-danger">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
