import { describe, it, expect } from "vitest";
import { formatCurrency, formatQty, formatRelativeDate, formatDateShort } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats integer ILS with currency suffix", () => {
    expect(formatCurrency(85)).toBe("85 ₪");
  });
  it("formats decimals to 2 places", () => {
    expect(formatCurrency(85.5)).toBe("85.50 ₪");
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("0 ₪");
  });
  it("formats negative as is", () => {
    expect(formatCurrency(-15.5)).toBe("-15.50 ₪");
  });
});

describe("formatQty", () => {
  it("formats liters", () => {
    expect(formatQty(10, "L")).toBe("10 لتر");
  });
  it("formats kg", () => {
    expect(formatQty(2.5, "kg")).toBe("2.5 كيلو");
  });
  it("formats piece (singular)", () => {
    expect(formatQty(1, "piece")).toBe("1 قطعة");
  });
  it("formats piece (plural)", () => {
    expect(formatQty(5, "piece")).toBe("5 قطع");
  });
});

describe("formatRelativeDate", () => {
  it("returns 'اليوم' for today", () => {
    expect(formatRelativeDate(new Date(), new Date())).toBe("اليوم");
  });
  it("returns 'أمس' for yesterday", () => {
    const today = new Date("2026-06-19T12:00:00Z");
    const yesterday = new Date("2026-06-18T12:00:00Z");
    expect(formatRelativeDate(yesterday, today)).toBe("أمس");
  });
  it("returns days-ago for older dates within 7 days", () => {
    const today = new Date("2026-06-19T12:00:00Z");
    const fiveDaysAgo = new Date("2026-06-14T12:00:00Z");
    expect(formatRelativeDate(fiveDaysAgo, today)).toBe("منذ 5 أيام");
  });
  it("returns DD/MM/YYYY for older dates", () => {
    const today = new Date("2026-06-19T12:00:00Z");
    const monthAgo = new Date("2026-05-19T12:00:00Z");
    expect(formatRelativeDate(monthAgo, today)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe("formatDateShort", () => {
  it("formats as DD/MM/YYYY using local time", () => {
    // Use local-time constructor so timezone doesn't shift the day
    expect(formatDateShort(new Date(2026, 5, 19))).toBe("19/06/2026"); // June (month index 5)
  });
  it("pads single-digit day and month", () => {
    expect(formatDateShort(new Date(2026, 2, 5))).toBe("05/03/2026"); // March 5
  });
});
