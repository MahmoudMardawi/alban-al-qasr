"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordStandalonePayment } from "../actions";
import { formatCurrency } from "@/lib/format";

interface Client { id: string; name: string }

export function NewPaymentForm({
  clients,
  initialClientId,
  prefillAmount,
}: {
  clients: Client[];
  initialClientId: string | null;
  prefillAmount: number;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [amount, setAmount] = useState(prefillAmount > 0 ? String(prefillAmount) : "");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  // Live filter for client picker
  const [clientQuery, setClientQuery] = useState("");
  const filteredClients = clientQuery.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(clientQuery.trim().toLowerCase()))
    : clients;

  function submit() {
    setError(null);
    const amt = Number(amount);
    if (!clientId) { setError("اختر الزبون"); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError("أدخل مبلغًا أكبر من صفر"); return; }

    startTx(async () => {
      const res = await recordStandalonePayment({
        client_id: clientId,
        amount:    amt,
        method:    "cash",
        note:      note.trim() || null,
        paid_at:   paidAt,
      });
      if (res.error) { setError(res.error); return; }
      if (res.paymentId) router.push(`/payments/${res.paymentId}`);
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-cairo text-muted mb-1">الزبون *</label>
        <input
          type="search"
          value={clientQuery}
          onChange={(e) => setClientQuery(e.target.value)}
          placeholder="ابحث عن الزبون..."
          className="w-full mb-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          size={Math.min(6, Math.max(3, filteredClients.length))}
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">— اختر —</option>
          {filteredClients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">المبلغ المُستلَم (₪) *</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={prefillAmount > 0 ? `الرصيد المستحق: ${formatCurrency(prefillAmount)}` : "مثال: 500"}
          className="w-full rounded-xl border border-border bg-white px-3 py-3 text-ink font-cairo text-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {prefillAmount > 0 && (
          <p className="text-[10px] text-muted font-cairo mt-1">
            الرصيد المستحق على الزبون: <strong className="text-warn">{formatCurrency(prefillAmount)}</strong>
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">تاريخ التحصيل</label>
        <input
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-cairo text-muted mb-1">ملاحظات</label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثال: تسديد جزئي من فواتير شهر مايو"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5 font-cairo">{error}</div>}

      <button
        onClick={submit}
        disabled={pending}
        className="w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ..." : "✓ حفظ سند القبض وطباعته"}
      </button>
    </div>
  );
}
