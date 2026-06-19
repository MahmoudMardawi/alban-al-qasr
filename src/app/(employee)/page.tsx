import { createClient } from "@/lib/supabase/server";
import { ClientCard, type ClientCardData } from "@/components/ClientCard";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  name: string;
  type: "supermarket" | "market" | "individual" | null;
  is_approved: boolean;
}

interface MoneyRow { client_id: string; balance: number }
interface ReplRow  { client_id: string; product_id: string; owed_base_qty: number }
interface ProductRow { id: string; name_ar: string; base_unit: "L" | "kg" | "piece" }

async function loadClientsWithBalances(): Promise<ClientCardData[]> {
  const supabase = await createClient();

  const [clientsRes, moneyRes, replRes, productsRes] = await Promise.all([
    supabase.from("clients")
      .select("id, name, type, is_approved")
      .is("merged_into_client_id", null)
      .order("name"),
    supabase.from("v_client_money_balance").select("*"),
    supabase.from("v_client_replacement_debt").select("*"),
    supabase.from("products").select("id, name_ar, base_unit"),
  ]);

  const clients = (clientsRes.data ?? []) as ClientRow[];
  const moneyMap = new Map<string, number>(
    ((moneyRes.data ?? []) as MoneyRow[]).map((r) => [r.client_id, Number(r.balance)]),
  );
  const products = new Map<string, ProductRow>(
    ((productsRes.data ?? []) as ProductRow[]).map((p) => [p.id, p]),
  );
  const replByClient = new Map<string, ReplRow[]>();
  for (const r of ((replRes.data ?? []) as ReplRow[])) {
    const list = replByClient.get(r.client_id) ?? [];
    list.push(r);
    replByClient.set(r.client_id, list);
  }

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    is_approved: c.is_approved,
    balance: {
      money_owed: moneyMap.get(c.id) ?? 0,
      replacements: (replByClient.get(c.id) ?? [])
        .map((r) => {
          const p = products.get(r.product_id);
          if (!p) return null;
          return { product_name_ar: p.name_ar, unit: p.base_unit, owed_base_qty: Number(r.owed_base_qty) };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    },
  }));
}

export default async function EmployeeHome() {
  const clients = await loadClientsWithBalances();

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الزبائن ({clients.length})</h2>
        <Link
          href="/client/new"
          className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border"
        >
          <Plus size={14} /> زبون جديد
        </Link>
      </div>
      <div className="px-3">
        {clients.length === 0 ? (
          <p className="text-center text-muted text-sm py-12">لا يوجد زبائن بعد</p>
        ) : (
          clients.map((c) => <ClientCard key={c.id} client={c} />)
        )}
      </div>
    </div>
  );
}
