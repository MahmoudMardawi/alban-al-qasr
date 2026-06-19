"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReceiptPhotoInput } from "@/components/ReceiptPhotoInput";
import { createExpense } from "../actions";

type Category = "fuel" | "salary" | "rent" | "milk" | "other";

const LABELS: Record<Category, string> = {
  fuel: "وقود", salary: "رواتب", rent: "إيجار", milk: "حليب خام", other: "أخرى",
};

export default function NewExpense() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("fuel");
  const [amount, setAmount]     = useState("");
  const [spentAt, setSpentAt]   = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote]         = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createExpense({
        category, amount: Number(amount),
        spent_at: new Date(spentAt + "T12:00:00").toISOString(),
        note: note.trim() || null,
        receipt_url: receiptUrl,
      });
      if (res.error) setError(res.error);
      else router.push("/expenses");
    });
  }

  return (
    <div className="p-4">
      <Link href="/expenses" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">مصروف جديد</h2>
      <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">التصنيف *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary">
            {(Object.keys(LABELS) as Category[]).map((c) => <option key={c} value={c}>{LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">المبلغ (₪) *</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={amount}
            onChange={(e) => setAmount(e.target.value)} required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink text-center font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">التاريخ</label>
          <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} dir="ltr"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <ReceiptPhotoInput onUploaded={setReceiptUrl} />
        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}
        <button onClick={submit} disabled={pending || !amount}
          className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
          {pending ? "جارٍ الحفظ..." : "حفظ المصروف"}
        </button>
      </div>
    </div>
  );
}
