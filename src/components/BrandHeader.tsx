export function BrandHeader({ subtitle }: { subtitle?: string }) {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";
  const area = process.env.NEXT_PUBLIC_BRAND_AREA ?? "عرّابة — جنين";
  return (
    <header className="bg-white border-b border-border px-4 py-3 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-forest leading-tight">{name}</h1>
          <p className="text-[11px] text-muted mt-0.5">{subtitle ?? area}</p>
        </div>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-xs text-muted hover:text-ink underline"
          >
            خروج
          </button>
        </form>
      </div>
    </header>
  );
}
