import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Users, GitMerge } from "lucide-react";
import { ClientApprovalCard } from "@/components/ClientApprovalCard";
import { EmptyState } from "@/components/EmptyState";
import { SearchableClientsList } from "@/components/SearchableClientsList";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string; name: string; type: string | null; phone: string | null; address: string | null;
  is_approved: boolean; added_by: string | null; merged_into_client_id: string | null;
  users: { full_name: string } | null;
}

export default async function AdminClientsList() {
  const supabase = await createClient();
  const { data } = await supabase.from("clients")
    .select("id, name, type, phone, address, is_approved, added_by, merged_into_client_id, users(full_name)")
    .is("merged_into_client_id", null).order("created_at", { ascending: false });
  const all = ((data ?? []) as unknown as ClientRow[]);
  const pending  = all.filter((c) => !c.is_approved);
  const approved = all.filter((c) =>  c.is_approved);

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الزبائن ({all.length})</h2>
        <div className="flex gap-1.5">
          <Link href="/clients/merge" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary-dk bg-info-bg px-3 py-1.5 rounded-full border border-border">
            <GitMerge size={14} /> دمج
          </Link>
          <Link href="/clients/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
            <Plus size={14} /> زبون جديد
          </Link>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="px-3 mb-4">
          <h3 className="text-[11px] font-cairo font-bold text-muted uppercase mb-2">بانتظار الموافقة ({pending.length})</h3>
          {pending.map((c) => (
            <ClientApprovalCard key={c.id} id={c.id} name={c.name} type={c.type} phone={c.phone}
              added_by_name={c.users?.full_name ?? null} />
          ))}
        </div>
      )}

      {approved.length === 0 && pending.length === 0 ? (
        <EmptyState icon={Users} title="لا يوجد زبائن بعد" ctaHref="/clients/new" ctaLabel="إضافة أول زبون" />
      ) : approved.length > 0 && (
        <SearchableClientsList clients={approved.map((c) => ({
          id: c.id, name: c.name, type: c.type, phone: c.phone, address: c.address,
        }))} />
      )}
    </div>
  );
}
