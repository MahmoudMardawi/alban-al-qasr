export type LineType = "sale" | "replacement_out" | "return_in";

export interface DraftLine {
  product_id: string;
  package_id: string | null;
  qty: number;
  base_qty: number;
  unit_price: number | null;
  line_type: LineType;
  note?: string;
}

export function calcBaseQty(qty: number, pkg: { contains_qty: number } | null): number {
  return pkg ? qty * pkg.contains_qty : qty;
}

export function calcLineSubtotal(line: Pick<DraftLine, "line_type" | "qty" | "unit_price">): number {
  if (line.line_type !== "sale") return 0;
  return line.qty * (line.unit_price ?? 0);
}

export function calcVisitTotal(lines: DraftLine[]): number {
  return lines.reduce((sum, l) => sum + calcLineSubtotal(l), 0);
}
