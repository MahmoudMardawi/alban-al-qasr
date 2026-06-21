import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClientStatementPicker } from "./client-statement-picker";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientStatementsIndex() {
  const supabase = await createClient();
  const [clientsRes, balancesRes] = await Promise.all([
    supabase.from("clients").select("id, name, phone").is("merged_into_client_id", null).order("name"),
    supabase.from("v_client_money_balance").select("client_id, balance"),
  ]);

  type Client = { id: string; name: string; phone: string | null };
  const clients = (clientsRes.data ?? []) as Client[];
  const balMap = new Map<string, number>(
    ((balancesRes.data ?? []) as Array<{ client_id: string; balance: number }>).map((b) => [b.client_id, Number(b.balance)]),
  );

  const enriched = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    balance: balMap.get(c.id) ?? 0,
    balance_label: formatCurrency(balMap.get(c.id) ?? 0),
  }));

  return (
    <div className="pb-4">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-md mx-auto">
        <Link href="/reports" className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
      </div>

      <div className="px-4 pb-2">
        <h1 className="font-display text-xl text-ink mb-1">كشف حساب الزبائن</h1>
        <p className="text-xs text-muted font-cairo">اختر زبون لعرض كشف الحساب الكامل (مدين / دائن / رصيد)</p>
      </div>

      <ClientStatementPicker clients={enriched} />
    </div>
  );
}
