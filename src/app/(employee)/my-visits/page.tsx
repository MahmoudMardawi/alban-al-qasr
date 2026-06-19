import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCurrency, formatRelativeDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface RowVisit {
  id: string;
  visited_at: string;
  clients: { name: string } | null;
  visit_lines: { qty: number; unit_price: number | null; line_type: string }[];
}

export default async function MyVisits() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("visits")
    .select("id, visited_at, clients(name), visit_lines(qty, unit_price, line_type)")
    .eq("employee_id", user.id)
    .order("visited_at", { ascending: false })
    .limit(50);

  const visits = (data ?? []) as unknown as RowVisit[];

  return (
    <div className="p-4">
      <h2 className="font-cairo font-bold text-forest text-lg mb-3">زياراتي ({visits.length})</h2>
      {visits.length === 0 ? (
        <p className="text-center text-muted text-sm py-12 font-cairo">لا توجد زيارات بعد</p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => {
            const total = v.visit_lines
              .filter((l) => l.line_type === "sale")
              .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0);
            return (
              <li key={v.id}>
                <Link href={`/visit/${v.id}`} className="flex items-center justify-between bg-white border border-border rounded-xl p-3">
                  <div className="min-w-0">
                    <div className="font-cairo text-sm font-semibold text-ink truncate">{v.clients?.name ?? "?"}</div>
                    <div className="text-[10px] text-muted mt-0.5 font-cairo">{formatRelativeDate(new Date(v.visited_at))}</div>
                  </div>
                  <div className="font-cairo font-bold text-primary text-sm shrink-0 ms-2">{formatCurrency(total)}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
