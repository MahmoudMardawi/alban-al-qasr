"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  balance_label: string;
}

export function ClientStatementPicker({ clients }: { clients: Client[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    if (!norm) return clients;
    return clients.filter((c) =>
      c.name.toLowerCase().includes(norm) ||
      c.phone?.toLowerCase().includes(norm),
    );
  }, [q, clients]);

  // Sort: highest debt first when no search; alphabetical when searching
  const sorted = useMemo(() => {
    if (q.trim()) return filtered;
    return [...filtered].sort((a, b) => b.balance - a.balance);
  }, [filtered, q]);

  return (
    <div>
      <div className="px-3 mb-2 relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-6 text-muted pointer-events-none" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الزبون أو الهاتف..."
          className="w-full ps-9 pe-9 py-2.5 rounded-xl border border-border bg-white text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2 end-6 text-muted" aria-label="مسح">
            <X size={14} />
          </button>
        )}
      </div>

      {q && (
        <div className="px-4 mb-2 text-[11px] text-muted font-cairo">
          {sorted.length === 0 ? "لا توجد نتائج" : `${sorted.length} نتيجة`}
        </div>
      )}

      <ul className="px-3 space-y-2">
        {sorted.map((c) => (
          <li key={c.id}>
            <Link
              href={`/clients/${c.id}/statement`}
              className="flex items-center justify-between bg-white border border-border rounded-2xl p-3 hover:bg-info-bg/40"
            >
              <div className="min-w-0">
                <div className="font-cairo font-semibold text-ink text-sm">{c.name}</div>
                {c.phone && <div className="text-[10px] text-muted font-cairo mt-0.5" dir="ltr">{c.phone}</div>}
              </div>
              <div className="shrink-0 text-left">
                <div className="text-[10px] text-muted font-cairo">رصيد</div>
                <div
                  className={`font-cairo font-extrabold text-sm ${
                    c.balance > 0 ? "text-warn" : c.balance < 0 ? "text-primary-dk" : "text-muted"
                  }`}
                  dir="ltr"
                >
                  {c.balance_label}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
