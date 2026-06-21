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
  damagedByProduct: Map<string, number>;
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

  // Shortage math: loaded − sold − returned-unsold = remaining/lost
  // Damaged returns (from customers) are tracked separately — they don't affect this.
  const rows = useMemo(() => load.items.map((i) => {
    const sold     = load.soldByProduct.get(i.product_id) ?? 0;
    const damaged  = load.damagedByProduct.get(i.product_id) ?? 0;
    const ret      = Number(returns.get(i.product_id) ?? 0);
    const balance  = i.qty_loaded - sold - ret;
    const returnEntered = returns.has(i.product_id) || i.qty_returned > 0;
    return { ...i, sold, damaged, ret, balance, returnEntered };
  }), [load, returns]);

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const totalDamaged = rows.reduce((s, r) => s + r.damaged, 0);
  const anyReturnEntered = rows.some((r) => r.returnEntered);

  function submit() {
    setError(null);
    const payload = Array.from(returns.entries()).map(([product_id, raw]) => ({
      product_id,
      qty_returned: Number(raw),
    }));
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
        💡 <strong className="text-ink">كيف يعمل التسوية:</strong><br />
        <span className="text-ink">المُحَمَّل</span> = كمية حُمّلت صباحاً ·{" "}
        <span className="text-ink">المُوزَّع</span> = ما بعته أو سلّمته مجاناً اليوم ·{" "}
        <span className="text-ink">غير مُباع</span> = كميات راجعة للمصنع من السيارة (سليمة)<br />
        <span className="text-ink">مرتجع تالف</span> = ما رجع من الزبائن (يعرض تلقائيًا، يدار من /reports/damaged-returns) ·{" "}
        <span className="text-ink">الفرق</span> = المُحَمَّل − المُوزَّع − غير المُباع. الصفر معناه تطابق تام.
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.product_id} className="bg-white border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-cairo font-bold text-sm text-ink">{r.product_name}</div>
              <div className={`text-xs font-cairo font-bold ${
                r.balance === 0 ? "text-primary-dk"
                : r.balance > 0
                  ? r.returnEntered ? "text-danger" : "text-info"
                  : "text-warn"
              }`}>
                {r.balance === 0
                  ? "✓ مُسوّى"
                  : r.balance > 0
                    ? r.returnEntered
                      ? `فقدان: ${formatQty(r.balance, r.product_unit)}`
                      : `متبقي بالسيارة: ${formatQty(r.balance, r.product_unit)}`
                    : `زيادة: ${formatQty(-r.balance, r.product_unit)}`}
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
                <div className="text-[9px] text-muted font-cairo mb-0.5">غير مُباع</div>
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
                <div className="text-[9px] text-muted font-cairo mb-0.5">{r.returnEntered ? "الفرق" : "متبقي"}</div>
                <div className={`rounded-lg py-1.5 text-sm font-cairo font-bold ${
                  r.balance === 0 ? "bg-primary/10 text-primary-dk"
                  : r.balance > 0
                    ? r.returnEntered ? "bg-red-50 text-danger" : "bg-cyan-50 text-info"
                    : "bg-orange-50 text-warn"
                }`}>
                  {r.balance}
                </div>
              </div>
            </div>

            {r.damaged > 0 && (
              <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5 text-[11px] font-cairo flex items-center justify-between">
                <span className="text-warn">↩️ مرتجع تالف من زبائن اليوم</span>
                <span className="text-warn font-bold">{formatQty(r.damaged, r.product_unit)}</span>
              </div>
            )}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="bg-forest text-white rounded-xl p-3 flex items-center justify-between">
          <span className="font-cairo text-xs opacity-90">{anyReturnEntered ? "إجمالي الفرق" : "متبقي بالسيارة"}</span>
          <span className="font-cairo font-extrabold text-lg">{totalBalance}</span>
        </div>
        <div className="bg-warn text-white rounded-xl p-3 flex items-center justify-between">
          <span className="font-cairo text-xs opacity-90">إجمالي تالف اليوم</span>
          <span className="font-cairo font-extrabold text-lg">{totalDamaged}</span>
        </div>
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
