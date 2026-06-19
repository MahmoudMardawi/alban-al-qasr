import { describe, it, expect } from "vitest";
import { calcBaseQty, calcLineSubtotal, calcVisitTotal } from "@/lib/ledgers";
import type { DraftLine } from "@/lib/ledgers";

describe("calcBaseQty", () => {
  it("returns qty when no package", () => {
    expect(calcBaseQty(7, null)).toBe(7);
  });
  it("multiplies qty × contains_qty when package", () => {
    expect(calcBaseQty(2, { contains_qty: 24 })).toBe(48);
  });
});

describe("calcLineSubtotal", () => {
  it("returns qty * unit_price for sale", () => {
    expect(calcLineSubtotal({ line_type: "sale", qty: 7, unit_price: 5 } as DraftLine)).toBe(35);
  });
  it("returns 0 for replacement_out (free)", () => {
    expect(calcLineSubtotal({ line_type: "replacement_out", qty: 3, unit_price: null } as DraftLine)).toBe(0);
  });
  it("returns 0 for return_in (no money impact)", () => {
    expect(calcLineSubtotal({ line_type: "return_in", qty: 3, unit_price: null } as DraftLine)).toBe(0);
  });
});

describe("calcVisitTotal", () => {
  it("sums sale lines only", () => {
    const lines: DraftLine[] = [
      { line_type: "sale",             qty: 7, unit_price: 5,  product_id: "p1", package_id: null, base_qty: 7 },
      { line_type: "sale",             qty: 2, unit_price: 18, product_id: "p2", package_id: null, base_qty: 2 },
      { line_type: "replacement_out",  qty: 3, unit_price: null, product_id: "p1", package_id: null, base_qty: 3 },
      { line_type: "return_in",        qty: 1, unit_price: null, product_id: "p2", package_id: null, base_qty: 1 },
    ];
    expect(calcVisitTotal(lines)).toBe(35 + 36);
  });
  it("returns 0 for empty list", () => {
    expect(calcVisitTotal([])).toBe(0);
  });
});
