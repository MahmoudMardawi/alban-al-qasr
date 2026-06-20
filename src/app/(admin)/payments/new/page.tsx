import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewPaymentForm } from "./new-payment-form";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("clients")
    .select("id, name")
    .is("merged_into_client_id", null)
    .order("name");
  const clients = (data ?? []) as Array<{ id: string; name: string }>;

  // Optionally pre-fill from outstanding balance if a client is selected
  let prefillAmount = 0;
  if (sp.client) {
    const { data: bal } = await supabase
      .from("v_client_money_balance")
      .select("balance")
      .eq("client_id", sp.client)
      .maybeSingle();
    prefillAmount = Math.max(0, Number(bal?.balance ?? 0));
  }

  return (
    <div className="p-4">
      <Link href="/payments" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-1">سند قبض جديد</h2>
      <p className="text-xs text-muted font-cairo mb-4">سجّل تحصيل نقدي من زبون لتسديد ذمم سابقة</p>

      <NewPaymentForm clients={clients} initialClientId={sp.client ?? null} prefillAmount={prefillAmount} />
    </div>
  );
}
