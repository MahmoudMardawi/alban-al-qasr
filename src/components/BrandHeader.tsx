import type { ReactNode } from "react";

export function BrandHeader({ subtitle, rightSlot }: { subtitle?: string; rightSlot?: ReactNode }) {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";
  const area = process.env.NEXT_PUBLIC_BRAND_AREA ?? "عرّابة — جنين";
  return (
    <header className="bg-white border-b border-border px-4 py-3 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-lg text-forest leading-tight truncate">{name}</h1>
            <p className="text-[11px] text-muted mt-0.5 truncate">{subtitle ?? area}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-xs text-muted hover:text-ink underline"
            >
              خروج
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
