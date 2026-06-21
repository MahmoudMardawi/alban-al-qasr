import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewDisbursementForm } from "./new-disbursement-form";

export const dynamic = "force-dynamic";

export default async function NewDisbursementPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("clients")
    .select("id, name")
    .is("merged_into_client_id", null)
    .order("name");
  const clients = (data ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="p-4">
      <Link href="/payments" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-1">سند صرف للزبون</h2>
      <p className="text-xs text-muted font-cairo mb-4">
        يُستخدم لرد مبلغ إلى الزبون: تعويض بضاعة تالفة، تصحيح تحصيل زائد، أو أي حالة استثنائية.
      </p>

      <NewDisbursementForm clients={clients} initialClientId={sp.client ?? null} />
    </div>
  );
}
