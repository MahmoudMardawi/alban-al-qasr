"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientFull, updateClient } from "@/app/(admin)/clients/actions";

export interface ClientFormInitial {
  id?: string;
  name: string; type: "supermarket" | "market" | "individual";
  phone: string; address: string; notes: string;
}

export function ClientEditForm({ initial }: { initial: ClientFormInitial }) {
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [name, setName]       = useState(initial.name);
  const [type, setType]       = useState(initial.type);
  const [phone, setPhone]     = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes]     = useState(initial.notes);
  const [error, setError]     = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = {
        name, type, phone: phone.trim() || null, address: address.trim() || null, notes: notes.trim() || null,
      };
      const res = editing
        ? await updateClient(initial.id!, payload)
        : await createClientFull(payload);
      if (res.error) setError(res.error);
      else router.push("/clients");
    });
  }

  return (
    <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">الاسم *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">النوع *</label>
        <select value={type} onChange={(e) => setType(e.target.value as ClientFormInitial["type"])}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="supermarket">سوبر ماركت</option>
          <option value="market">محل / بقالة</option>
          <option value="individual">فرد</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">رقم الهاتف</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">العنوان</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="مثال: عرّابة، الحارة الغربية مقابل صيدلية..."
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        {address.trim().length > 2 && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary font-cairo font-semibold mt-1.5"
          >
            📍 افتح في خرائط Google
          </a>
        )}
        <p className="text-[10px] text-muted font-cairo mt-1">
          اكتب وصفاً نصّياً، أو لصق رابط Google Maps، أو إحداثيات (مثل: 32.4567, 35.1234).
        </p>
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">ملاحظات</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}
      <button onClick={submit} disabled={pending}
        className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
        {pending ? "جارٍ الحفظ..." : (editing ? "حفظ التغييرات" : "إضافة الزبون")}
      </button>
    </div>
  );
}
