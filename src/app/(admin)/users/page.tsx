import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { UserRow } from "@/components/UserRow";

export const dynamic = "force-dynamic";

export default async function UsersList() {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").order("created_at");
  const users = data ?? [];
  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الموظفون ({users.length})</h2>
        <Link href="/users/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> دعوة موظف
        </Link>
      </div>
      {users.length === 0 ? (
        <EmptyState icon={UserCog} title="لا يوجد موظفون" />
      ) : (
        <ul className="px-3 space-y-2">
          {users.map((u) => <li key={u.id}><UserRow user={u} /></li>)}
        </ul>
      )}
    </div>
  );
}
