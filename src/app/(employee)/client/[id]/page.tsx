import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { BalanceBadges, type BalanceData } from "@/components/BalanceBadges";
import { formatCurrency, formatRelativeDate, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

interface VisitRow {
  id: string;
  visited_at: string;
  visit_lines: { qty: number; unit_price: number | null; line_type: string }[];
}

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [clientRes, moneyRes, replRes, productsRes, visitsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("v_client_money_balance").select("balance").eq("client_id", id).maybeSingle(),
    supabase.from("v_client_replacement_debt").select("product_id, owed_base_qty").eq("client_id", id),
    supabase.from("products").select("id, name_ar, base_unit"),
    supabase.from("visits")
      .select("id, visited_at, visit_lines(qty, unit_price, line_type)")
      .eq("client_id", id)
      .order("visited_at", { ascending: false })
      .limit(20),
  ]);

  if (clientRes.error || !clientRes.data) return notFound();
  const client = clientRes.data;

  const productsById = new Map(
    ((productsRes.data ?? []) as { id: string; name_ar: string; base_unit: Unit }[]).map((p) => [p.id, p]),
  );

  const balance: BalanceData = {
    money_owed: Number(moneyRes.data?.balance ?? 0),
    replacements: ((replRes.data ?? []) as { product_id: string; owed_base_qty: number }[])
      .map((r) => {
        const p = productsById.get(r.product_id);
        if (!p) return null;
        return { product_name_ar: p.name_ar, unit: p.base_unit, owed_base_qty: Number(r.owed_base_qty) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };

  const visits = (visitsRes.data ?? []) as VisitRow[];

  return (
    <div className="pb-6">
      <div className="bg-gradient-to-b from-info-bg to-white p-4 border-b border-border">
        <h2 className="font-cairo font-bold text-forest text-lg">{client.name}</h2>
        <p className="text-xs text-muted mt-1">{client.address || "—"} · {client.phone || "بدون هاتف"}</p>
        <div className="mt-3"><BalanceBadges data={balance} /></div>
      </div>

      <div className="px-4 py-3">
        <Link
          href={`/visit/new?client=${client.id}`}
          className="flex items-center justify-center gap-2 w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk"
        >
          <Plus size={18} /> زيارة جديدة
        </Link>
      </div>

      <div className="px-4 mt-2">
        <h3 className="font-cairo font-semibold text-ink text-sm mb-2">آخر الزيارات ({visits.length})</h3>
        {visits.length === 0 ? (
          <p className="text-center text-muted text-xs py-6">لا توجد زيارات بعد</p>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => {
              const total = v.visit_lines
                .filter((l) => l.line_type === "sale")
                .reduce((sum, l) => sum + Number(l.qty) * Number(l.unit_price ?? 0), 0);
              return (
                <li key={v.id}>
                  <Link
                    href={`/visit/${v.id}`}
                    className="flex items-center justify-between bg-white border border-border rounded-xl p-3"
                  >
                    <div>
                      <div className="font-cairo text-xs text-ink">{formatRelativeDate(new Date(v.visited_at))}</div>
                      <div className="text-[10px] text-muted mt-0.5">{v.visit_lines.length} عنصر</div>
                    </div>
                    <div className="text-left">
                      <div className="font-cairo font-bold text-primary text-sm">{formatCurrency(total)}</div>
                      <ArrowRight size={14} className="text-muted inline-block rotate-180" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
