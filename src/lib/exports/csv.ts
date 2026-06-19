export interface CsvColumn<T> {
  key: keyof T & string;
  header: string;
  /** Optional transformer applied to cell value before stringification */
  format?: (v: unknown, row: T) => string | number | null | undefined;
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => {
      const raw = (r as Record<string, unknown>)[c.key];
      const formatted = c.format ? c.format(raw, r) : raw;
      return escapeCell(formatted);
    }).join(","),
  );
  return "﻿" + [header, ...lines].join("\r\n") + "\r\n";
}
