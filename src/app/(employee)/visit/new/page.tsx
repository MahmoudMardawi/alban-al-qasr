"use client";

import { Suspense, useEffect, useState, useTransition, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus, RotateCcw, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calcVisitTotal, type DraftLine } from "@/lib/ledgers";
import { formatCurrency, type Unit } from "@/lib/format";
import { ProductPackagePicker, type ProductForPicker, type PickedLine } from "@/components/ProductPackagePicker";
import { VisitLineRow } from "@/components/VisitLineRow";
import { type BalanceData } from "@/components/BalanceBadges";
import { createVisitWithLines } from "./actions";

type LineType = DraftLine["line_type"];

interface ClientRow { id: string; name: string; address: string | null }

export default function NewVisitPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted font-cairo text-sm">جارٍ التحميل...</div>}>
      <NewVisitContent />
    </Suspense>
  );
}

function NewVisitContent() {
  const sp = useSearchParams();
  const clientId = sp.get("client") ?? "";

  const [client, setClient] = useState<ClientRow | null>(null);
  const [balance, setBalance] = useState<BalanceData>({ money_owed: 0, replacements: [] });
  const [products, setProducts] = useState<ProductForPicker[]>([]);
  const [replacementDebt, setReplacementDebt] = useState<Map<string, number>>(new Map());

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<LineType>("sale");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const supabase = createClient();
    (async () => {
      const [clientRes, moneyRes, replRes, productsRes, packagesRes] = await Promise.all([
        supabase.from("clients").select("id, name, address").eq("id", clientId).single(),
        supabase.from("v_client_money_balance").select("balance").eq("client_id", clientId).maybeSingle(),
        supabase.from("v_client_replacement_debt").select("product_id, owed_base_qty").eq("client_id", clientId),
        supabase.from("products").select("id, name_ar, base_unit, base_price").eq("is_active", true),
        supabase.from("product_packages").select("id, product_id, package_name, contains_qty, package_price").eq("is_active", true),
      ]);
      if (clientRes.data) setClient(clientRes.data);

      const productsData = (productsRes.data ?? []) as Array<{ id: string; name_ar: string; base_unit: Unit; base_price: number }>;
      const packagesData = (packagesRes.data ?? []) as Array<{ id: string; product_id: string; package_name: string; contains_qty: number; package_price: number }>;
      const productsForPicker: ProductForPicker[] = productsData.map((p) => ({
        id: p.id,
        name_ar: p.name_ar,
        base_unit: p.base_unit,
        base_price: Number(p.base_price),
        packages: packagesData
          .filter((pk) => pk.product_id === p.id)
          .map((pk) => ({
            id: pk.id,
            package_name: pk.package_name,
            contains_qty: Number(pk.contains_qty),
            package_price: Number(pk.package_price),
          })),
      }));
      setProducts(productsForPicker);

      const replMap = new Map<string, number>();
      for (const r of (replRes.data ?? []) as Array<{ product_id: string; owed_base_qty: number }>) {
        replMap.set(r.product_id, Number(r.owed_base_qty));
      }
      setReplacementDebt(replMap);

      const productById = new Map(productsData.map((p) => [p.id, p]));
      setBalance({
        money_owed: Number(moneyRes.data?.balance ?? 0),
        replacements: Array.from(replMap.entries())
          .map(([pid, owed]) => {
            const p = productById.get(pid);
            if (!p) return null;
            return { product_name_ar: p.name_ar, unit: p.base_unit, owed_base_qty: owed };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      });
    })();
  }, [clientId]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const packageMap = useMemo(() => {
    const m = new Map<string, { name: string; contains_qty: number }>();
    for (const p of products) for (const pk of p.packages) m.set(pk.id, { name: pk.package_name, contains_qty: pk.contains_qty });
    return m;
  }, [products]);

  const total = calcVisitTotal(lines);

  function openPicker(type: LineType) {
    setPickerType(type);
    setPickerOpen(true);
  }

  function onPick(line: PickedLine) {
    setLines((prev) => [...prev, line]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function confirm() {
    setError(null);
    startSubmit(async () => {
      const res = await createVisitWithLines({ client_id: clientId, lines });
      if (res?.error) setError(res.error);
    });
  }

  if (!clientId) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted text-sm mb-3 font-cairo">يجب اختيار زبون أولاً</p>
        <Link href="/" className="text-primary font-cairo text-sm">← العودة للزبائن</Link>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white p-4">
        <Link href={`/client/${clientId}`} className="flex items-center gap-1 text-xs text-white/80 mb-2">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <h2 className="font-cairo font-bold text-lg">{client?.name ?? "..."}</h2>
        <p className="text-xs opacity-80 mt-0.5">{client?.address || ""}</p>
      </div>

      <div className="bg-info-bg p-3 grid grid-cols-2 gap-2 border-b border-border">
        <div className="bg-white rounded-xl p-2.5 border border-border">
          <div className="text-[10px] text-muted font-cairo">💰 يدين لك</div>
          <div className="font-cairo font-bold text-warn text-base mt-1">{formatCurrency(balance.money_owed)}</div>
        </div>
        <div className="bg-white rounded-xl p-2.5 border border-border">
          <div className="text-[10px] text-muted font-cairo">🥛 تدين له</div>
          <div className="font-cairo font-bold text-primary-dk text-xs mt-1 leading-tight">
            {balance.replacements.length === 0 ? "—" : balance.replacements.map((r) => `${r.owed_base_qty} ${r.product_name_ar}`).join(" · ")}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => openPicker("sale")}
          className="bg-primary text-white rounded-xl p-3 font-cairo font-bold text-xs shadow-sm flex flex-col items-center gap-1"
        >
          <Plus size={20} />
          <span>بيع جديد</span>
        </button>
        <button
          onClick={() => openPicker("return_in")}
          className="bg-white text-warn border border-orange-200 rounded-xl p-3 font-cairo font-bold text-xs flex flex-col items-center gap-1"
        >
          <RotateCcw size={20} />
          <span>مرتجع تالف</span>
        </button>
        <button
          onClick={() => openPicker("replacement_out")}
          className="bg-white text-primary-dk border border-border rounded-xl p-3 font-cairo font-bold text-xs flex flex-col items-center gap-1"
        >
          <RefreshCw size={20} />
          <span>بدل</span>
        </button>
      </div>

      <div className="px-4 mt-4">
        <h3 className="font-cairo font-semibold text-muted text-xs mb-2">عناصر هذه الزيارة</h3>
        {lines.length === 0 ? (
          <p className="text-center text-muted text-xs py-6 font-cairo">اضغط أحد الأزرار أعلاه لإضافة عنصر</p>
        ) : (
          lines.map((l, idx) => {
            const p = productMap.get(l.product_id);
            const pkg = l.package_id ? packageMap.get(l.package_id) : null;
            return (
              <VisitLineRow
                key={idx}
                line={l}
                productName={p?.name_ar ?? "?"}
                productUnit={p?.base_unit ?? "piece"}
                packageName={pkg?.name ?? null}
                onRemove={() => removeLine(idx)}
              />
            );
          })
        )}
      </div>

      {lines.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-forest text-white rounded-xl p-3 flex items-center justify-between">
            <span className="font-cairo text-sm opacity-90">المطلوب تحصيله الآن</span>
            <span className="font-cairo font-extrabold text-xl">{formatCurrency(total)}</span>
          </div>
          {error && (
            <div className="mt-2 rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5">{error}</div>
          )}
          <button
            onClick={confirm}
            disabled={submitting}
            className="mt-2 w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60"
          >
            {submitting ? "جارٍ التأكيد..." : "✓ تأكيد الزيارة"}
          </button>
        </div>
      )}

      <ProductPackagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPick}
        lineType={pickerType}
        products={products}
        replacementDebt={replacementDebt}
      />
    </div>
  );
}
