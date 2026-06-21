"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordRepExpense } from "../actions";
import { formatCurrency } from "@/lib/format";
import { Plus } from "lucide-react";

const CATEGORIES = [
  { value: "fuel",   label: "وقود" },
  { value: "salary", label: "بدل غذاء / راتب" },
  { value: "other",  label: "متفرقات" },
] as const;
type Category = typeof CATEGORIES[number]["value"];

export function QuickExpenseForm({ available }: { available: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("fuel");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  function reset() {
    setAmount(""); setCategory("fuel"); setNote(""); setError(null);
  }

  function submit() {
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("أدخل مبلغًا أكبر من صفر"); return; }
    if (amt > available) { setError(`المبلغ يفوق ما هو متاح في الصندوق (${formatCurrency(available)})`); return; }

    startTx(async () => {
      const res = await recordRepExpense({ amount: amt, category, note: note.trim() || null });
      if (res.error) { setError(res.error); return; }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 bg-warn text-white text-xs font-cairo font-bold py-2.5 rounded-xl"
      >
        <Plus size={14} /> سند صرف (وقود / غذاء / متفرقات)
      </button>
    );
  }

  return (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-cairo font-bold text-sm text-warn">سند صرف من الصندوق</h4>
        <button onClick={() => { setOpen(false); reset(); }} className="text-xs text-muted font-cairo">إلغاء</button>
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">المبلغ (₪)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          max={available}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`المتاح: ${formatCurrency(available)}`}
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-warn"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">السبب</label>
        <div className="grid grid-cols-3 gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-lg py-2 px-1 font-cairo font-bold text-[11px] border-2 ${
                category === c.value ? "bg-warn text-white border-warn" : "bg-white text-ink border-border"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">ملاحظة (اختياري)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثال: عشاء عمل، تعبئة بنزين السيارة"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-warn"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-danger text-xs p-2 font-cairo">{error}</div>}

      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-warn text-white font-cairo font-bold py-2.5 rounded-xl disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ..." : "✓ تسجيل الصرف"}
      </button>
    </div>
  );
}
