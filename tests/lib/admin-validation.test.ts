import { describe, it, expect } from "vitest";
import {
  validateProductInput,
  validatePackageInput,
  validateExpenseInput,
  validateProductionInput,
} from "@/lib/admin-validation";

describe("validateProductInput", () => {
  const ok = { name_ar: "لبن", base_unit: "L", base_price: 5, base_cost: 2 };
  it("accepts valid", () => expect(validateProductInput(ok)).toEqual({ ok: true }));
  it("rejects empty name", () =>
    expect(validateProductInput({ ...ok, name_ar: "" })).toMatchObject({ ok: false }));
  it("rejects unknown unit", () =>
    expect(validateProductInput({ ...ok, base_unit: "box" })).toMatchObject({ ok: false }));
  it("rejects negative price", () =>
    expect(validateProductInput({ ...ok, base_price: -1 })).toMatchObject({ ok: false }));
  it("allows null cost", () =>
    expect(validateProductInput({ ...ok, base_cost: null })).toEqual({ ok: true }));
});

describe("validatePackageInput", () => {
  const ok = { package_name: "كرتونة", contains_qty: 24, package_price: 110 };
  it("accepts valid", () => expect(validatePackageInput(ok)).toEqual({ ok: true }));
  it("rejects empty name", () =>
    expect(validatePackageInput({ ...ok, package_name: "" })).toMatchObject({ ok: false }));
  it("rejects zero contains_qty", () =>
    expect(validatePackageInput({ ...ok, contains_qty: 0 })).toMatchObject({ ok: false }));
  it("rejects negative price", () =>
    expect(validatePackageInput({ ...ok, package_price: -5 })).toMatchObject({ ok: false }));
});

describe("validateExpenseInput", () => {
  const ok = { category: "fuel", amount: 100 };
  it("accepts valid", () => expect(validateExpenseInput(ok)).toEqual({ ok: true }));
  it("rejects unknown category", () =>
    expect(validateExpenseInput({ ...ok, category: "bribe" })).toMatchObject({ ok: false }));
  it("rejects zero amount", () =>
    expect(validateExpenseInput({ ...ok, amount: 0 })).toMatchObject({ ok: false }));
});

describe("validateProductionInput", () => {
  const ok = { product_id: "u1", qty_produced: 50, qty_wasted: 2 };
  it("accepts valid", () => expect(validateProductionInput(ok)).toEqual({ ok: true }));
  it("accepts zero waste", () =>
    expect(validateProductionInput({ ...ok, qty_wasted: 0 })).toEqual({ ok: true }));
  it("rejects negative produced", () =>
    expect(validateProductionInput({ ...ok, qty_produced: -1 })).toMatchObject({ ok: false }));
  it("rejects waste exceeding production", () =>
    expect(validateProductionInput({ ...ok, qty_wasted: 100 })).toMatchObject({ ok: false }));
});
