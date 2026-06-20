"use client";

import { useRouter } from "next/navigation";

export interface MonthOption {
  year: number;
  month: number;
  label: string;
}

export function MonthPicker({ options, current }: { options: MonthOption[]; current: string }) {
  const router = useRouter();
  return (
    <select
      defaultValue={current}
      onChange={(e) => {
        const [y, m] = e.target.value.split("-").map(Number);
        router.push(`?year=${y}&month=${m}`);
      }}
      className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {options.map((o) => (
        <option key={o.label} value={`${o.year}-${o.month}`}>{o.label}</option>
      ))}
    </select>
  );
}
