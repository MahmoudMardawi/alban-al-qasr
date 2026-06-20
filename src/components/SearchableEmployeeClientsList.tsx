"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { ClientCard, type ClientCardData } from "@/components/ClientCard";

export function SearchableEmployeeClientsList({ clients }: { clients: ClientCardData[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    if (!norm) return clients;
    return clients.filter((c) => c.name?.toLowerCase().includes(norm));
  }, [q, clients]);

  return (
    <div>
      <div className="px-3 mb-2 relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-6 text-muted pointer-events-none" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الزبون..."
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
          {filtered.length === 0 ? "لا توجد نتائج" : `${filtered.length} زبون`}
        </div>
      )}

      <div>
        {filtered.length === 0 && !q ? (
          <p className="text-center text-muted text-sm py-12 font-cairo">لا يوجد زبائن بعد</p>
        ) : (
          filtered.map((c) => <ClientCard key={c.id} client={c} />)
        )}
      </div>
    </div>
  );
}
