"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mergeClients } from "@/app/(admin)/clients/actions";
import { formatCurrency, formatQty, type Unit } from "@/lib/format";
import { GitMerge } from "lucide-react";

interface ClientRow { id: string; name: string; phone: string | null; type: string | null }
interface MoneyRow  { client_id: string; balance: number }
interface ReplRow   { client_id: string; product_id: string; owed_base_qty: number }
interface ProductRow { id: string; name_ar: string; base_unit: Unit }

export function MergeWizard() {
  const router = useRouter();
  const [clients, setClients]       = useState<ClientRow[]>([]);
  const [moneyMap, setMoneyMap]     = useState<Map<string, number>>(new Map());
  const [replByClient, setReplByClient] = useState<Map<string, ReplRow[]>>(new Map());
  const [products, setProducts]     = useState<Map<string, ProductRow>>(new Map());
  const [visitCount, setVisitCount] = useState<Map<string, number>>(new Map());

  const [primary, setPrimary]       = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [pending, startTransition]  = useTransition();
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [cRes, mRes, rRes, pRes, vRes] = await Promise.all([
        supabase.from("clients").select("id, name, phone, type").is("merged_into_client_id", null).order("name"),
        supabase.from("v_client_money_balance").select("*"),
        supabase.from("v_client_replacement_debt").select("*"),
        supabase.from("products").select("id, name_ar, base_unit"),
        supabase.from("visits").select("client_id"),
      ]);
      setClients((cRes.data ?? []) as ClientRow[]);
      setMoneyMap(new Map(((mRes.data ?? []) as MoneyRow[]).map((x) => [x.client_id, Number(x.balance)])));
      const r = new Map<string, ReplRow[]>();
      for (const row of (rRes.data ?? []) as ReplRow[]) {
        const arr = r.get(row.client_id) ?? []; arr.push(row); r.set(row.client_id, arr);
      }
      setReplByClient(r);
      setProducts(new Map(((pRes.data ?? []) as ProductRow[]).map((x) => [x.id, x])));
      const v = new Map<string, number>();
      for (const row of (vRes.data ?? []) as { client_id: string }[]) {
        v.set(row.client_id, (v.get(row.client_id) ?? 0) + 1);
      }
      setVisitCount(v);
    })();
  }, []);

  function toggleDuplicate(id: string) {
    const n = new Set(duplicates);
    if (n.has(id)) n.delete(id); else n.add(id);
    setDuplicates(n);
  }

  const preview = useMemo(() => {
    if (!primary) return null;
    const all = [primary, ...Array.from(duplicates)];
    const money = all.reduce((s, id) => s + (moneyMap.get(id) ?? 0), 0);
    const visits = all.reduce((s, id) => s + (visitCount.get(id) ?? 0), 0);
    const replAgg = new Map<string, number>();
    for (const id of all) {
      for (const r of (replByClient.get(id) ?? [])) {
        replAgg.set(r.product_id, (replAgg.get(r.product_id) ?? 0) + Number(r.owed_base_qty));
      }
    }
    return { money, visits, replacements: replAgg };
  }, [primary, duplicates, moneyMap, replByClient, visitCount]);

  function confirm() {
    if (!primary || duplicates.size === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await mergeClients(primary, Array.from(duplicates));
      if (res.error) setError(res.error);
      else router.push(`/clients/${primary}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-info-bg/40 border border-border rounded-xl p-3 font-cairo text-xs text-muted">
        اختر الزبون الرئيسي ثم اختر زبون مكرر واحد على الأقل. سيتم نقل كل الزيارات والمدفوعات للزبون الرئيسي، والزبائن المكررين سيختفون من القائمة (مع حفظ تاريخهم).
      </div>

      <div className="bg-white border border-border rounded-2xl p-4">
        <h4 className="font-cairo font-semibold text-ink text-sm mb-3">1. اختر الزبون الرئيسي:</h4>
        <select value={primary ?? ""} onChange={(e) => { setPrimary(e.target.value || null); setDuplicates(new Set()); }}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-cairo">
          <option value="">— اختر —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>)}
        </select>
      </div>

      {primary && (
        <div className="bg-white border border-border rounded-2xl p-4">
          <h4 className="font-cairo font-semibold text-ink text-sm mb-3">2. اختر الزبائن المكررين:</h4>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {clients.filter((c) => c.id !== primary).map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 p-2.5 border border-border rounded-lg cursor-pointer hover:bg-info-bg/40">
                  <input type="checkbox" checked={duplicates.has(c.id)} onChange={() => toggleDuplicate(c.id)} />
                  <span className="flex-1 font-cairo text-sm text-ink">
                    {c.name}{c.phone ? ` (${c.phone})` : ""} · {visitCount.get(c.id) ?? 0} زيارة
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && duplicates.size > 0 && (
        <div className="bg-forest text-white rounded-2xl p-4">
          <h4 className="font-cairo font-bold text-base mb-2 flex items-center gap-2">
            <GitMerge size={18} /> معاينة الدمج
          </h4>
          <ul className="space-y-1 text-sm font-cairo">
            <li>إجمالي الزيارات بعد الدمج: <strong>{preview.visits}</strong></li>
            <li>إجمالي الديون: <strong>{formatCurrency(preview.money)}</strong></li>
            <li>
              إجمالي البدائل المستحقة:
              {preview.replacements.size === 0 ? " لا يوجد" : (
                <ul className="mt-1 mr-3 text-xs">
                  {Array.from(preview.replacements.entries()).map(([pid, qty]) => {
                    const p = products.get(pid);
                    return <li key={pid}>· {p?.name_ar ?? "?"}: {formatQty(qty, p?.base_unit ?? "piece")}</li>;
                  })}
                </ul>
              )}
            </li>
          </ul>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}

      <button onClick={confirm} disabled={!primary || duplicates.size === 0 || pending}
        className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
        {pending ? "جارٍ الدمج..." : `دمج ${duplicates.size} زبون`}
      </button>
    </div>
  );
}
