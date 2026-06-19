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

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button type="button"
            onClick={() => {
              // Open maps centered on the address text, or fall back to Arraba/Jenin (factory).
              // The "search?api=1" URL launches the native Google Maps app on Android,
              // Apple Maps prompt on iOS, or maps.google.com in any browser.
              const query = address.trim() || "32.4083,35.2031 (مصنع ألبان وأجبان القصر)";
              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
            }}
            className="flex items-center justify-center gap-1.5 bg-info-bg text-primary-dk font-cairo font-semibold text-xs py-2.5 rounded-xl border border-border">
            📍 افتح الخريطة
          </button>
          <button type="button"
            onClick={() => {
              if (!navigator.geolocation) {
                alert("متصفحك لا يدعم تحديد الموقع.");
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const lat = pos.coords.latitude.toFixed(6);
                  const lng = pos.coords.longitude.toFixed(6);
                  const coords = `${lat},${lng}`;
                  setAddress(coords);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${coords}`, "_blank");
                },
                (err) => {
                  const msg =
                    err.code === err.PERMISSION_DENIED ? "رفض إذن الوصول للموقع."  :
                    err.code === err.POSITION_UNAVAILABLE ? "تعذّر تحديد الموقع."  :
                    err.code === err.TIMEOUT ? "انتهت مهلة التحديد."             :
                    err.message;
                  alert(`تعذّر الحصول على موقعك: ${msg}`);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
              );
            }}
            className="flex items-center justify-center gap-1.5 bg-primary text-white font-cairo font-semibold text-xs py-2.5 rounded-xl">
            🎯 استخدم موقعي الحالي
          </button>
        </div>

        <p className="text-[10px] text-muted font-cairo mt-1.5">
          📍 يفتح خرائط Google. على الموبايل سيُحوّلك للتطبيق المثبّت (Google Maps على Android، Apple Maps على iOS).<br />
          🎯 سيطلب منك إذن الوصول للموقع، ثم يضع إحداثياتك في الحقل.
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
