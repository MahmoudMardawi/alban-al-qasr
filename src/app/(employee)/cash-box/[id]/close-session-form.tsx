"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCashBoxSession } from "../actions";
import { formatCurrency } from "@/lib/format";

export function CloseSessionForm({ sessionId, expected }: { sessionId: string; expected: number }) {
  const router = useRouter();
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  const actualNum = Number(actual);
  const diff = actual !== "" && Number.isFinite(actualNum) ? expected - actualNum : null;

  function submit() {
    setError(null);
    if (actual === "" || !Number.isFinite(actualNum) || actualNum < 0) {
      setError("أدخل المبلغ الفعلي المعدود"); return;
    }
    startTx(async () => {
      const res = await closeCashBoxSession({ session_id: sessionId, closing_actual: actualNum, notes: notes.trim() || null });
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="bg-white border-2 border-primary/30 rounded-xl p-4 space-y-3">
      <h3 className="font-cairo font-bold text-ink text-sm">إغلاق الصندوق</h3>

      <div className="bg-info-bg rounded-lg p-2.5 text-xs font-cairo">
        💡 عُدّ المبلغ النقدي الذي معك الآن وأدخله بالضبط. سنقارنه بالمتوقع
        <strong className="text-forest"> ({formatCurrency(expected)}) </strong>
        ونحسب الفرق.
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">العدّ الفعلي (₪)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          placeholder={`المتوقع: ${formatCurrency(expected)}`}
          className="w-full rounded-xl border border-border bg-white px-3 py-3 text-ink font-cairo text-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {diff !== null && actual !== "" && (
        <div className={`rounded-lg p-2.5 text-xs font-cairo ${
          diff === 0 ? "bg-primary/10 text-primary-dk border border-primary/30" :
          diff > 0   ? "bg-red-50 text-danger border border-red-200" :
                       "bg-orange-50 text-warn border border-orange-200"
        }`}>
          {diff === 0
            ? "✓ تطابق تام — لا فرق"
            : diff > 0
              ? `⚠ عجز ${formatCurrency(diff)} — أين الفرق؟`
              : `زيادة ${formatCurrency(-diff)} — مصدر غير مسجّل؟`}
        </div>
      )}

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">ملاحظات (لتفسير الفرق إن وجد)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: دفعت 50 إيجار باص للأولاد"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">{error}</div>}

      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60"
      >
        {pending ? "جارٍ الإغلاق..." : "✓ إغلاق الصندوق"}
      </button>
    </div>
  );
}
