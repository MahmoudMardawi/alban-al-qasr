"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordConversion } from "./actions";
import type { Unit } from "@/lib/format";

interface Product { id: string; name_ar: string; base_unit: Unit }

export function ConversionForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState("");
  const [sourceQty, setSourceQty] = useState("");
  const [targetId, setTargetId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [convertedAt, setConvertedAt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  const source = products.find((p) => p.id === sourceId);
  const target = products.find((p) => p.id === targetId);

  function unitLabel(u: Unit | undefined): string {
    return u === "L" ? "لتر" : u === "kg" ? "كغم" : "حبة";
  }

  function submit() {
    setError(null);
    const sq = Number(sourceQty);
    const tq = Number(targetQty);
    if (!sourceId || !targetId) { setError("اختر الصنفين"); return; }
    if (sourceId === targetId) { setError("الصنف المصدر يجب أن يكون مختلفًا عن الوجهة"); return; }
    if (!Number.isFinite(sq) || sq <= 0 || !Number.isFinite(tq) || tq <= 0) {
      setError("الكميات يجب أن تكون أكبر من صفر"); return;
    }

    startTx(async () => {
      const res = await recordConversion({
        source_product_id: sourceId,
        source_qty:        sq,
        target_product_id: targetId,
        target_qty:        tq,
        converted_at:      convertedAt,
        notes:             notes.trim() || null,
      });
      if (res.error) { setError(res.error); return; }
      setSourceId(""); setSourceQty(""); setTargetId(""); setTargetQty(""); setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-cairo font-bold text-ink text-sm">تسجيل تحويل جديد</h3>

      <div className="grid grid-cols-2 gap-2 items-start">
        <div>
          <label className="block text-[10px] text-warn font-cairo mb-1 font-bold">من (الصنف المصدر) ←</label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full rounded-xl border border-border bg-white px-2 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-warn"
          >
            <option value="">— اختر —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={p.id === targetId}>{p.name_ar}</option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={sourceQty}
            onChange={(e) => setSourceQty(e.target.value)}
            placeholder={source ? `الكمية (${unitLabel(source.base_unit)})` : "الكمية"}
            className="w-full mt-1 rounded-xl border border-border bg-white px-2 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-warn"
          />
        </div>
        <div>
          <label className="block text-[10px] text-primary-dk font-cairo mb-1 font-bold">→ إلى (الصنف الناتج)</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-xl border border-border bg-white px-2 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— اختر —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={p.id === sourceId}>{p.name_ar}</option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={targetQty}
            onChange={(e) => setTargetQty(e.target.value)}
            placeholder={target ? `الكمية (${unitLabel(target.base_unit)})` : "الكمية"}
            className="w-full mt-1 rounded-xl border border-border bg-white px-2 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">التاريخ</label>
        <input
          type="date"
          value={convertedAt}
          onChange={(e) => setConvertedAt(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">ملاحظة (اختياري)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: لبن تالف من زيارة أبو سامي، حُوّل لجبنة بيضاء"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">{error}</div>}

      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-info text-white font-cairo font-bold py-2.5 rounded-xl disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ..." : "♻ تسجيل التحويل"}
      </button>
    </div>
  );
}
