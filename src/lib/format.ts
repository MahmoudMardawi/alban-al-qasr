export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded} ₪`;
  return `${rounded.toFixed(2)} ₪`;
}

export type Unit = "L" | "kg" | "piece";

export function formatQty(qty: number, unit: Unit): string {
  if (unit === "L")   return `${qty} لتر`;
  if (unit === "kg")  return `${qty} كيلو`;
  return qty === 1 ? `${qty} قطعة` : `${qty} قطع`;
}

/** Formats a sequential visit invoice number for human display. */
export function formatInvoiceNo(no: number | string | null | undefined): string {
  if (no === null || no === undefined || no === "") return "—";
  return `#${String(no).padStart(4, "0")}`;
}

export function formatDateShort(date: Date): string {
  const dd   = String(date.getDate()).padStart(2, "0");
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday    = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const startOfThatDay  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / msPerDay);

  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays > 1 && diffDays <= 7) return `منذ ${diffDays} أيام`;
  return formatDateShort(startOfThatDay);
}
