"use client";

import { useState, useTransition } from "react";
import { addPendingClient } from "./actions";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addPendingClient(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="p-4">
      <Link href="/" className="flex items-center gap-1 text-xs text-muted mb-3">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">إضافة زبون جديد</h2>

      <form action={submit} className="space-y-4 bg-white border border-border rounded-2xl p-5">
        <div>
          <label className="block text-sm text-ink mb-1 font-cairo">الاسم *</label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-ink mb-1 font-cairo">رقم الهاتف</label>
          <input
            type="tel"
            name="phone"
            dir="ltr"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-ink mb-1 font-cairo">النوع *</label>
          <select
            name="type"
            defaultValue="market"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="supermarket">سوبر ماركت</option>
            <option value="market">محل / بقالة</option>
            <option value="individual">فرد</option>
          </select>
        </div>

        <p className="text-[11px] text-muted bg-info-bg p-3 rounded-xl">
          سيظهر الزبون بانتظار موافقة مجدي. يمكنك تسجيل زيارة له مباشرة.
        </p>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60"
        >
          {pending ? "جارٍ الإضافة..." : "إضافة الزبون"}
        </button>
      </form>
    </div>
  );
}
