type Result = { ok: true } | { ok: false; error: string };

export interface ProductInput {
  name_ar: string;
  base_unit: string;
  base_price: number;
  base_cost: number | null;
}

export function validateProductInput(p: ProductInput): Result {
  if (!p.name_ar?.trim()) return { ok: false, error: "اسم المنتج مطلوب" };
  if (!["L", "kg", "piece"].includes(p.base_unit))
    return { ok: false, error: "وحدة غير صالحة" };
  if (typeof p.base_price !== "number" || p.base_price < 0)
    return { ok: false, error: "السعر يجب أن يكون رقمًا غير سالب" };
  if (p.base_cost !== null && (typeof p.base_cost !== "number" || p.base_cost < 0))
    return { ok: false, error: "التكلفة يجب أن تكون رقمًا غير سالب" };
  return { ok: true };
}

export interface PackageInput {
  package_name: string;
  contains_qty: number;
  package_price: number;
}

export function validatePackageInput(p: PackageInput): Result {
  if (!p.package_name?.trim()) return { ok: false, error: "اسم العبوة مطلوب" };
  if (typeof p.contains_qty !== "number" || p.contains_qty <= 0)
    return { ok: false, error: "كمية العبوة يجب أن تكون أكبر من صفر" };
  if (typeof p.package_price !== "number" || p.package_price < 0)
    return { ok: false, error: "سعر العبوة يجب أن يكون رقمًا غير سالب" };
  return { ok: true };
}

export interface ExpenseInput {
  category: string;
  amount: number;
}

export function validateExpenseInput(e: ExpenseInput): Result {
  if (!["fuel", "salary", "rent", "milk", "other"].includes(e.category))
    return { ok: false, error: "تصنيف غير صالح" };
  if (typeof e.amount !== "number" || e.amount <= 0)
    return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
  return { ok: true };
}

export interface ProductionInput {
  product_id: string;
  qty_produced: number;
  qty_wasted: number;
}

export function validateProductionInput(p: ProductionInput): Result {
  if (!p.product_id) return { ok: false, error: "المنتج مطلوب" };
  if (typeof p.qty_produced !== "number" || p.qty_produced < 0)
    return { ok: false, error: "الكمية المنتجة يجب أن تكون رقمًا غير سالب" };
  if (typeof p.qty_wasted !== "number" || p.qty_wasted < 0)
    return { ok: false, error: "الفاقد يجب أن يكون رقمًا غير سالب" };
  if (p.qty_wasted > p.qty_produced)
    return { ok: false, error: "الفاقد لا يمكن أن يتجاوز الكمية المنتجة" };
  return { ok: true };
}
