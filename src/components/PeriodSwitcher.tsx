"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { type Period } from "@/lib/periods";

const PERIODS: { v: Period; label: string }[] = [
  { v: "daily",   label: "يومي" },
  { v: "weekly",  label: "أسبوعي" },
  { v: "monthly", label: "شهري" },
  { v: "yearly",  label: "سنوي" },
];

export function PeriodSwitcher({ current }: { current: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function pick(p: Period) {
    const params = new URLSearchParams(sp.toString());
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-4 gap-1 px-4 py-2">
      {PERIODS.map(({ v, label }) => {
        const active = current === v;
        return (
          <button
            key={v}
            onClick={() => pick(v)}
            className={`font-cairo text-xs font-semibold py-2 rounded-lg transition-colors ${
              active ? "bg-primary text-white" : "bg-white border border-border text-muted"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
