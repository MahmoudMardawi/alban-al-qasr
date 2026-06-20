"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props {
  start: string;
  end: string;
  /** Show preset chips above the date inputs (اليوم / هذا الأسبوع / etc.). Default false for backward compat. */
  showPresets?: boolean;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRanges(): Array<{ label: string; start: string; end: string }> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  // Week starts Saturday (Levant)
  const dow = now.getDay();
  const daysSinceSat = (dow + 1) % 7;

  return [
    { label: "اليوم",          start: isoDate(new Date(y, m, d)),                    end: isoDate(new Date(y, m, d)) },
    { label: "هذا الأسبوع",     start: isoDate(new Date(y, m, d - daysSinceSat)),     end: isoDate(new Date(y, m, d)) },
    { label: "هذا الشهر",      start: isoDate(new Date(y, m, 1)),                    end: isoDate(new Date(y, m, d)) },
    { label: "الشهر السابق",    start: isoDate(new Date(y, m - 1, 1)),                end: isoDate(new Date(y, m, 0)) },
    { label: "آخر 3 شهور",     start: isoDate(new Date(y, m - 2, 1)),                end: isoDate(new Date(y, m, d)) },
    { label: "هذه السنة",      start: isoDate(new Date(y, 0, 1)),                    end: isoDate(new Date(y, m, d)) },
  ];
}

export function DateRangePicker({ start, end, showPresets = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set(name, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setRange(s: string, e: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("start", s);
    params.set("end",   e);
    router.push(`${pathname}?${params.toString()}`);
  }

  const presets = showPresets ? presetRanges() : [];

  return (
    <div className="px-4 py-2">
      {showPresets && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {presets.map((p) => {
            const active = p.start === start && p.end === end;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setRange(p.start, p.end)}
                className={`text-[11px] font-cairo font-semibold px-2.5 py-1 rounded-full border ${
                  active
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-ink border-border hover:bg-info-bg"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] text-muted font-cairo mb-1">من</span>
          <input type="date" value={start} onChange={(e) => setParam("start", e.target.value)} dir="ltr"
            className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo focus:outline-none focus:ring-1 focus:ring-primary" />
        </label>
        <label className="block">
          <span className="block text-[11px] text-muted font-cairo mb-1">إلى</span>
          <input type="date" value={end} onChange={(e) => setParam("end", e.target.value)} dir="ltr"
            className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo focus:outline-none focus:ring-1 focus:ring-primary" />
        </label>
      </div>
    </div>
  );
}
