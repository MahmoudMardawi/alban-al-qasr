"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProductionEntry } from "../actions";

interface Product { id: string; name_ar: string; base_unit: "L" | "kg" | "piece" }

export default function NewProduction() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [produced, setProduced] = useState("");
  const [wasted, setWasted]     = useState("0");
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.from("products").select("id, name_ar, base_unit").eq("is_active", true).order("name_ar")
      .then(({ data }) => {
        const list = (data ?? []) as Product[];
        setProducts(list);
        if (list.length > 0) setProductId(list[0].id);
      });
  }, []);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createProductionEntry({
        product_id: productId,
        qty_produced: Number(produced),
        qty_wasted: Number(wasted),
        produced_at: new Date(date + "T12:00:00").toISOString(),
        note: note.trim() || null,
      });
      if (res.error) setError(res.error);
      else router.push("/production");
    });
  }

  return (
    <div className="p-4">
      <Link href="/production" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">تسجيل إنتاج</h2>
      <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">المنتج *</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo">
            {products.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-cairo text-ink mb-1">الكمية المنتجة *</label>
            <input type="number" inputMode="decimal" step="any" min="0" value={produced}
              onChange={(e) => setProduced(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo" />
          </div>
          <div>
            <label className="block text-sm font-cairo text-ink mb-1">الفاقد</label>
            <input type="number" inputMode="decimal" step="any" min="0" value={wasted}
              onChange={(e) => setWasted(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink" />
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}
        <button onClick={submit} disabled={pending || !produced || !productId}
          className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
          {pending ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}
