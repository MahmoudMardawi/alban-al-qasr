"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openCashBoxSession } from "./actions";

export function OpenSessionForm() {
  const router = useRouter();
  const [opening, setOpening] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  function submit() {
    setError(null);
    const amt = Number(opening || 0);
    if (!Number.isFinite(amt) || amt < 0) { setError("أدخل رصيدًا صحيحًا (≥ 0)"); return; }

    startTx(async () => {
      const res = await openCashBoxSession({ opening_float: amt, notes: notes.trim() || null });
      if (res.error) { setError(res.error); return; }
      if (res.sessionId) router.push(`/cash-box/${res.sessionId}`);
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-cairo font-bold text-ink text-sm">فتح صندوق جديد لليوم</h3>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">الرصيد الافتتاحي (₪)</label>
        <input
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          placeholder="مثال: 200 (فلوس فكّة)"
          className="w-full rounded-xl border border-border bg-white px-3 py-3 text-ink font-cairo text-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-[10px] text-muted font-cairo mt-1">
          المبلغ النقدي الذي بدأت به اليوم (للفكّة أو سلف).
        </p>
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">ملاحظات (اختياري)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: أخذت سلفة 100 شيكل من الإدارة"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">{error}</div>}

      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60"
      >
        {pending ? "جارٍ الفتح..." : "💰 فتح الصندوق"}
      </button>
    </div>
  );
}
