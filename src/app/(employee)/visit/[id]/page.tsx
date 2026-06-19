import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReceiptCard } from "@/components/ReceiptCard";
import { PrintButton } from "@/components/PrintButton";
import type { Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VisitReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: visit, error } = await supabase
    .from("visits")
    .select(`
      id, visited_at, client_id,
      visit_lines (
        line_type, qty, base_qty, unit_price, package_id,
        products ( name_ar, base_unit ),
        product_packages ( package_name )
      ),
      clients ( name ),
      users ( full_name )
    `)
    .eq("id", id)
    .single();

  if (error || !visit) return notFound();

  type Line = NonNullable<typeof visit.visit_lines>[number];
  const lines = (visit.visit_lines as Line[]).map((l) => ({
    line_type:        l.line_type as "sale" | "return_in" | "replacement_out",
    qty:              Number(l.qty),
    base_qty:         Number(l.base_qty),
    unit_price:       l.unit_price === null ? null : Number(l.unit_price),
    product_name_ar:  (l.products as unknown as { name_ar: string } | null)?.name_ar ?? "?",
    product_unit:    ((l.products as unknown as { base_unit: Unit } | null)?.base_unit ?? "piece") as Unit,
    package_name:     (l.product_packages as unknown as { package_name: string } | null)?.package_name ?? null,
  }));

  return (
    <div>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-md mx-auto print:hidden">
        <Link href={`/client/${visit.client_id}`} className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <PrintButton />
      </div>
      <ReceiptCard
        data={{
          visit_id:      visit.id,
          visited_at:    visit.visited_at,
          client_name:  (visit.clients as unknown as { name: string } | null)?.name ?? "?",
          employee_name:(visit.users as unknown as { full_name: string } | null)?.full_name ?? "?",
          lines,
        }}
      />
    </div>
  );
}
