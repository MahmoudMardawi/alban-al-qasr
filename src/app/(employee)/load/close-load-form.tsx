"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatQty, type Unit } from "@/lib/format";
import { closeTruckLoad } from "./actions";

interface LoadItem {
  product_id: string;
  qty_loaded: number;
  qty_returned: number;
  product_name: string;
  product_unit: Unit;
}

interface LoadView {
  id: string;
  loaded_at: string;
  items: LoadItem[];
  soldByProduct: Map<string, number>;
}

export function CloseLoadForm({ load }: { load: LoadView }) {
  const router = useRouter();
  const [returns, setReturns] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const i of load.items) if (i.qty_returned > 0) m.set(i.product_id, String(i.qty_returned));
    return m;
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  function setReturn(productId: string, value: string) {
    setReturns((prev) => {
      const next = new Map(prev);
      if (!value || Number(value) === 0) next.delete(productId);
      else next.set(productId, value);
      return next;
    });
  }

  const rows = useMemo(() => load.items.map((i) => {
    const sold = load.soldByProduct.get(i.product_id) ?? 0;
    const ret  = Number(returns.get(i.product_id) ?? 0);
    const balance = i.qty_loaded - sold - ret;
    return { ...i, sold, ret, balance };
  }), [load, returns]);

  const totalShortage = rows.reduce((s, r) => s + r.balance, 0);

  function submit() {
    setError(null);
    const payload = Array.from(returns.entries()).map(([product_id, raw]) => ({
      product_id,
      qty_returned: Number(raw),
    }));
    // Include zero-returns for products that were on the load so we explicitly mark them.
    for (const i of load.items) {
      if (!returns.has(i.product_id)) payload.push({ product_id: i.product_id, qty_returned: 0 });
    }

    startTx(async () => {
      const res = await closeTruckLoad({ load_id: load.id, returns: payload, notes: notes.trim() || null });
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="bg-info-bg border border-border rounded-xl p-3 mb-3 text-xs font-cairo text-muted leading-relaxed">
        💡 <strong className="text-ink">كيف يعمل التسوية:</strong>{" "}
        <span className="text-ink">المُحَمَّل</span> هو ما حمّلته صباحاً ·{" "}
        <span className="text-ink">الموزَّع</span> هو ما بعته أو سلّمته بدلاً اليوم ·{" "}
        <span className="text-ink">المُرتجَع</span> هو ما رجع للمصنع نهاية اليوم ·{" "}
        <span className="text-ink">الفرق</span> يجب أن يكون صفراً (وإلا فقدان)
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.product_id} className="bg-white border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-cairo font-bold text-sm text-ink">{r.product_name}</div>
              <div className={`text-xs font-cairo font-bold ${
                r.balance === 0 ? "text-primary-dk"
                : r.balance > 0 ? "text-warn"
                : "text-danger"
              }`}>
                {r.balance === 0 ? "✓ مُسوّى" : r.balance > 0 ? `فقدان: ${formatQty(r.balance, r.product_unit)}` : `زيادة: ${formatQty(-r.balance, r.product_unit)}`}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-[9px] text-muted font-cairo mb-0.5">المُحَمَّل</div>
                <div className="bg-info-bg rounded-lg py-1.5 text-sm font-cairo font-bold text-ink">{r.qty_loaded}</div>
              </div>
              <div>
                <div className="text-[9px] text-muted font-cairo mb-0.5">المُوزَّع</div>
                <div className="bg-info-bg rounded-lg py-1.5 text-sm font-cairo font-bold text-primary-dk">{r.sold}</div>
              </div>
              <div>
                <div className="text-[9px] text-muted font-cairo mb-0.5">المُرتجَع</div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  max={r.qty_loaded}
                  value={returns.get(r.product_id) ?? ""}
                  onChange={(e) => setReturn(r.product_id, e.target.value)}
                  placeholder="0"
                  className="w-full text-center rounded-lg border border-border bg-white py-1.5 text-sm font-cairo font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <div className="text-[9px] text-muted font-cairo mb-0.5">الفرق</div>
                <div className={`rounded-lg py-1.5 text-sm font-cairo font-bold ${
                  r.balance === 0 ? "bg-primary/10 text-primary-dk"
                  : r.balance > 0 ? "bg-orange-50 text-warn"
                  : "bg-red-50 text-danger"
                }`}>
                  {r.balance}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <label className="block text-xs font-cairo text-muted mb-1">ملاحظات الإغلاق (اختياري)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: 2 كرتونة لبن وقعت من السيارة"
          className="w-full rounded-xl border border-border bg-white p-3 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">{error}</div>}

      <div className="mt-4 bg-forest text-white rounded-xl p-3 flex items-center justify-between">
        <span className="font-cairo text-sm opacity-90">إجمالي الفرق</span>
        <span className={`font-cairo font-extrabold text-lg ${totalShortage === 0 ? "" : "text-orange-200"}`}>{totalShortage}</span>
      </div>

      <button
        onClick={submit}
        disabled={pending}
        className="mt-3 w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60"
      >
        {pending ? "جارٍ الإغلاق..." : "✓ إغلاق التحميل وتسوية اليوم"}
      </button>
    </div>
  );
}
