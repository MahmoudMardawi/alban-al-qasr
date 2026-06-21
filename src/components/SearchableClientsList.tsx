"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, ShoppingCart, FileText } from "lucide-react";

export interface SearchableClientRow {
  id: string;
  name: string;
  type: string | null;
  phone: string | null;
  address: string | null;
}

export function SearchableClientsList({ clients }: { clients: SearchableClientRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    if (!norm) return clients;
    return clients.filter((c) =>
      (c.name?.toLowerCase().includes(norm)) ||
      (c.phone?.toLowerCase().includes(norm)) ||
      (c.address?.toLowerCase().includes(norm)),
    );
  }, [q, clients]);

  return (
    <div>
      <div className="px-3 mb-2 relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-6 text-muted pointer-events-none" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم، الهاتف، أو العنوان..."
          className="w-full ps-9 pe-9 py-2.5 rounded-xl border border-border bg-white text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute top-1/2 -translate-y-1/2 end-6 text-muted hover:text-ink"
            aria-label="مسح البحث"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {q && (
        <div className="px-4 mb-2 text-[11px] text-muted font-cairo">
          {filtered.length === 0 ? "لا توجد نتائج" : `${filtered.length} نتيجة`}
        </div>
      )}

      <ul className="px-3 space-y-2">
        {filtered.map((c) => (
          <li key={c.id} className="bg-white border border-border rounded-2xl p-3">
            <Link href={`/clients/${c.id}/statement`} className="block mb-2">
              <h3 className="font-cairo font-semibold text-ink text-sm">{c.name}</h3>
              <p className="text-[10px] text-muted font-cairo mt-0.5 truncate">
                {c.type ?? "—"} · {c.phone ?? "بدون هاتف"} · {c.address ?? "بدون عنوان"}
              </p>
            </Link>
            <div className="grid grid-cols-3 gap-1.5">
              <Link
                href={`/clients/${c.id}/statement`}
                className="flex items-center justify-center gap-1 bg-info-bg text-primary-dk text-[11px] font-cairo font-bold px-2 py-1.5 rounded-lg border border-border"
              >
                <FileText size={11} /> كشف حساب
              </Link>
              <Link
                href={`/visit/new?client=${c.id}`}
                className="flex items-center justify-center gap-1 bg-primary text-white text-[11px] font-cairo font-bold px-2 py-1.5 rounded-lg"
              >
                <ShoppingCart size={11} /> بيع
              </Link>
              <Link
                href={`/clients/${c.id}`}
                className="flex items-center justify-center gap-1 bg-white text-muted text-[11px] font-cairo px-2 py-1.5 rounded-lg border border-border"
              >
                تعديل
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
