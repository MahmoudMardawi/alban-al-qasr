"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatQty, type Unit } from "@/lib/format";
import { startTruckLoad } from "./actions";

interface Product {
  id: string;
  name_ar: string;
  base_unit: Unit;
}

export function StartLoadForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [qtys, setQtys] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  function setQty(productId: string, value: string) {
    setQtys((prev) => {
      const next = new Map(prev);
      if (!value || Number(value) === 0) next.delete(productId);
      else next.set(productId, value);
      return next;
    });
  }

  function submit() {
    setError(null);
    const items = Array.from(qtys.entries()).map(([product_id, raw]) => ({
      product_id,
      qty_loaded: Number(raw),
    })).filter((i) => i.qty_loaded > 0);

    if (!items.length) { setError("أدخل كمية واحدة على الأقل"); return; }

    startTx(async () => {
      const res = await startTruckLoad({ items, notes: notes.trim() || null });
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  const totalUnits = Array.from(qtys.values()).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div>
      <h3 className="font-cairo font-bold text-base text-ink mb-3">كمية التحميل لكل منتج</h3>
      <ul className="space-y-2">
        {products.map((p) => {
          const v = qtys.get(p.id) ?? "";
          return (
            <li key={p.id} className="bg-white border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-cairo font-semibold text-sm text-ink">{p.name_ar}</div>
                <div className="text-[10px] text-muted font-cairo">الوحدة: {p.base_unit === "L" ? "لتر" : p.base_unit === "kg" ? "كغم" : "حبة"}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  value={v}
                  onChange={(e) => setQty(p.id, e.target.value)}
                  placeholder="0"
                  className="w-20 text-center rounded-xl border border-border bg-white py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-[10px] text-muted font-cairo w-8">{v ? formatQty(Number(v), p.base_unit).split(" ").pop() : ""}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <label className="block text-xs font-cairo text-muted mb-1">ملاحظات (اختياري)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: تحميل خاص لمنطقة عرّابة الشمالية"
          className="w-full rounded-xl border border-border bg-white p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">{error}</div>}

      <div className="mt-4 bg-forest text-white rounded-xl p-3 flex items-center justify-between">
        <span className="font-cairo text-sm opacity-90">إجمالي الوحدات المحمَّلة</span>
        <span className="font-cairo font-extrabold text-lg">{totalUnits}</span>
      </div>

      <button
        onClick={submit}
        disabled={pending}
        className="mt-3 w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ..." : "🚚 تأكيد التحميل"}
      </button>
    </div>
  );
}
