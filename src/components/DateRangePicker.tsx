"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props { start: string; end: string }

export function DateRangePicker({ start, end }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set(name, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-2">
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
  );
}
