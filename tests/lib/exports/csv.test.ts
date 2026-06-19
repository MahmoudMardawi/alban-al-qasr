import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/exports/csv";

describe("toCsv", () => {
  it("renders headers + rows separated by CRLF", () => {
    const out = toCsv([{ a: 1, b: "x" }], [{ key: "a", header: "A" }, { key: "b", header: "B" }]);
    expect(out).toBe("﻿A,B\r\n1,x\r\n");
  });
  it("escapes commas and quotes", () => {
    const out = toCsv([{ a: 'has, comma', b: 'has "quote"' }], [{ key: "a", header: "A" }, { key: "b", header: "B" }]);
    expect(out).toContain('"has, comma","has ""quote"""');
  });
  it("handles Arabic content", () => {
    const out = toCsv([{ name: "لبن", v: 5 }], [{ key: "name", header: "الاسم" }, { key: "v", header: "القيمة" }]);
    expect(out).toContain("الاسم,القيمة");
    expect(out).toContain("لبن,5");
  });
  it("emits BOM at start for Excel UTF-8 recognition", () => {
    const out = toCsv([], [{ key: "x", header: "X" }]);
    expect(out.charCodeAt(0)).toBe(0xFEFF);
  });
  it("handles null/undefined as empty", () => {
    const out = toCsv(
      [{ a: null, b: undefined }] as Array<{ a: null | string; b: undefined | string }>,
      [{ key: "a", header: "A" }, { key: "b", header: "B" }],
    );
    expect(out).toContain(",\r\n");
  });
});
