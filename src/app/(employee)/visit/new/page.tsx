"use client";

import { Suspense, useEffect, useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const clientId = sp.get("client") ?? "";

  const [client, setClient] = useState<ClientRow | null>(null);
  const [balance, setBalance] = useState<BalanceData>({ money_owed: 0, replacements: [] });
  const [products, setProducts] = useState<ProductForPicker[]>([]);
  const [replacementDebt, setReplacementDebt] = useState<Map<string, number>>(new Map());
  /** Truck stock as of last DB read — combined with draft lines below for live remaining */
  const [baseTruckStock, setBaseTruckStock] = useState<Map<string, number>>(new Map());
  const [hasOpenLoad, setHasOpenLoad] = useState(false);

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<LineType>("sale");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Payment mode at visit close: cash = full payment, credit = آجل, partial = some now
  type PayMode = "cash" | "credit" | "partial";
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [partialAmount, setPartialAmount] = useState<string>("");

  useEffect(() => {
    if (!clientId) return;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const dayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const [clientRes, moneyRes, replRes, productsRes, packagesRes, openLoadRes, todayVisitsRes] = await Promise.all([
        supabase.from("clients").select("id, name, address").eq("id", clientId).single(),
        supabase.from("v_client_money_balance").select("balance").eq("client_id", clientId).maybeSingle(),
        supabase.from("v_client_replacement_debt").select("product_id, owed_base_qty").eq("client_id", clientId),
        supabase.from("products").select("id, name_ar, base_unit, base_price").eq("is_active", true),
        supabase.from("product_packages").select("id, product_id, package_name, contains_qty, package_price").eq("is_active", true),
        user ? supabase.from("truck_loads")
          .select("id, truck_load_items(product_id, qty_loaded, qty_returned)")
          .eq("employee_id", user.id)
          .eq("status", "open")
          .eq("loaded_at", todayDate)
          .maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from("visits")
          .select("id, visit_lines(product_id, base_qty, line_type)")
          .eq("employee_id", user.id)
          .gte("visited_at", dayStart)
          .lt("visited_at", dayEnd) : Promise.resolve({ data: [] }),
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

      // Compute truck stock = qty_loaded - qty_returned - already-sold-today (across all OTHER visits)
      type LoadRow = { id: string; truck_load_items: Array<{ product_id: string; qty_loaded: number; qty_returned: number }> };
      const openLoad = openLoadRes.data as LoadRow | null;
      if (openLoad) {
        setHasOpenLoad(true);
        type VisitLite = { visit_lines: Array<{ product_id: string; base_qty: number; line_type: string }> };
        const todayVisits = (todayVisitsRes.data ?? []) as unknown as VisitLite[];
        const soldByProduct = new Map<string, number>();
        for (const v of todayVisits) for (const l of v.visit_lines) {
          if (l.line_type === "sale" || l.line_type === "replacement_out") {
            soldByProduct.set(l.product_id, (soldByProduct.get(l.product_id) ?? 0) + Number(l.base_qty));
          }
        }
        const stock = new Map<string, number>();
        for (const item of openLoad.truck_load_items) {
          const remaining = Number(item.qty_loaded) - Number(item.qty_returned) - (soldByProduct.get(item.product_id) ?? 0);
          stock.set(item.product_id, remaining);
        }
        setBaseTruckStock(stock);
      } else {
        setHasOpenLoad(false);
        setBaseTruckStock(new Map());
      }
    })();
  }, [clientId]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const packageMap = useMemo(() => {
    const m = new Map<string, { name: string; contains_qty: number }>();
    for (const p of products) for (const pk of p.packages) m.set(pk.id, { name: pk.package_name, contains_qty: pk.contains_qty });
    return m;
  }, [products]);

  // Combine persisted DB debt with pending draft lines so the user can replace
  // products they JUST returned in this same visit, before confirming.
  const effectiveReplacementDebt = useMemo(() => {
    const m = new Map(replacementDebt);
    for (const l of lines) {
      if (l.line_type === "return_in") {
        m.set(l.product_id, (m.get(l.product_id) ?? 0) + l.base_qty);
      } else if (l.line_type === "replacement_out") {
        m.set(l.product_id, (m.get(l.product_id) ?? 0) - l.base_qty);
      }
    }
    return m;
  }, [replacementDebt, lines]);

  // Live truck stock = DB snapshot minus what's already in this draft visit
  const effectiveTruckStock = useMemo(() => {
    const m = new Map(baseTruckStock);
    for (const l of lines) {
      if (l.line_type === "sale" || l.line_type === "replacement_out") {
        m.set(l.product_id, (m.get(l.product_id) ?? 0) - l.base_qty);
      }
    }
    return m;
  }, [baseTruckStock, lines]);

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

  function resolvePaymentAmount(): number {
    if (payMode === "cash")    return total;
    if (payMode === "credit")  return 0;
    const parsed = Number(partialAmount);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, total);
  }

  function confirm() {
    setError(null);
    const payment_amount = resolvePaymentAmount();
    if (payMode === "partial" && payment_amount <= 0) {
      setError("أدخل مبلغ الدفعة الجزئية");
      return;
    }
    startSubmit(async () => {
      try {
        const res = await createVisitWithLines({ client_id: clientId, lines, payment_amount });
        if (res?.error) {
          setError(res.error);
          return;
        }
        if (res?.visitId) {
          router.push(`/visit/${res.visitId}`);
        } else {
          setError("استجابة غير متوقعة من الخادم");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
        setError(msg);
        console.error("[createVisitWithLines] threw:", e);
      }
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

      {hasOpenLoad && effectiveTruckStock.size > 0 && (
        <div className="bg-white border-b border-border px-3 py-2">
          <div className="text-[10px] text-muted font-cairo mb-1.5">🚚 المتبقي بالسيارة الآن</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(effectiveTruckStock.entries()).map(([pid, qty]) => {
              const p = productMap.get(pid);
              if (!p) return null;
              const isLow  = qty < 5 && qty > 0;
              const isOut  = qty <= 0;
              return (
                <span
                  key={pid}
                  className={`text-[11px] font-cairo px-2 py-1 rounded-full border ${
                    isOut ? "bg-red-50 text-danger border-red-200 font-bold" :
                    isLow ? "bg-orange-50 text-warn border-orange-200 font-bold" :
                            "bg-info-bg text-primary-dk border-border"
                  }`}
                >
                  {p.name_ar}: {qty} {p.base_unit === "L" ? "لتر" : p.base_unit === "kg" ? "كغم" : "حبة"}
                </span>
              );
            })}
          </div>
        </div>
      )}

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

      {lines.length > 0 && total > 0 && (
        <div className="px-4 mt-4">
          <h3 className="font-cairo font-semibold text-muted text-xs mb-2">طريقة الدفع</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setPayMode("cash")}
              className={`rounded-xl p-3 font-cairo font-bold text-xs border-2 transition ${
                payMode === "cash"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-ink border-border"
              }`}
            >
              💵 نقدًا الآن
            </button>
            <button
              type="button"
              onClick={() => setPayMode("partial")}
              className={`rounded-xl p-3 font-cairo font-bold text-xs border-2 transition ${
                payMode === "partial"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-ink border-border"
              }`}
            >
              ½ دفعة جزئية
            </button>
            <button
              type="button"
              onClick={() => setPayMode("credit")}
              className={`rounded-xl p-3 font-cairo font-bold text-xs border-2 transition ${
                payMode === "credit"
                  ? "bg-warn text-white border-warn"
                  : "bg-white text-warn border-orange-200"
              }`}
            >
              📒 آجل (ذمم)
            </button>
          </div>

          {payMode === "partial" && (
            <div className="mb-3">
              <label className="block text-[11px] text-muted font-cairo mb-1">المبلغ المدفوع الآن (₪)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                max={total}
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder={`من أصل ${formatCurrency(total)}`}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-ink font-cairo text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {lines.length > 0 && (
        <div className="px-4 mt-2">
          <div className="bg-forest text-white rounded-xl p-3 flex items-center justify-between">
            <span className="font-cairo text-sm opacity-90">
              {payMode === "credit" ? "الإجمالي (آجل بالكامل)"
               : payMode === "partial" ? "الإجمالي"
               : "المطلوب تحصيله الآن"}
            </span>
            <span className="font-cairo font-extrabold text-xl">{formatCurrency(total)}</span>
          </div>

          {payMode === "partial" && Number(partialAmount) > 0 && (
            <div className="mt-2 bg-info-bg rounded-xl p-2.5 flex items-center justify-between text-xs font-cairo">
              <span className="text-muted">المتبقي على الذمم</span>
              <span className="text-warn font-bold">{formatCurrency(Math.max(0, total - Number(partialAmount)))}</span>
            </div>
          )}

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
        replacementDebt={effectiveReplacementDebt}
        truckStock={hasOpenLoad ? effectiveTruckStock : undefined}
      />
    </div>
  );
}
