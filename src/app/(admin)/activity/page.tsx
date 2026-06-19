import { createClient } from "@/lib/supabase/server";
import { getActivityFeed } from "@/lib/activity-data";
import { ActivityFeedItem } from "@/components/ActivityFeedItem";
import { ClientApprovalCard } from "@/components/ClientApprovalCard";
import { MarkAllReadButton } from "@/components/MarkAllReadButton";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ actor?: string; action?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [feed, employeesRes, pendingRes] = await Promise.all([
    getActivityFeed({ actorId: sp.actor || null, action: sp.action || null }),
    supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("clients")
      .select("id, name, type, phone, added_by, users(full_name)")
      .eq("is_approved", false).is("merged_into_client_id", null),
  ]);

  type P = { id: string; name: string; type: string | null; phone: string | null; added_by: string | null; users: { full_name: string } | null };
  const pending = (pendingRes.data ?? []) as unknown as P[];

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base flex items-center gap-1.5"><Bell size={16} /> الإشعارات</h2>
        <MarkAllReadButton />
      </div>

      {pending.length > 0 && (
        <div className="px-3 mb-4">
          <h3 className="text-[11px] font-cairo font-bold text-muted uppercase mb-2">بانتظار الموافقة ({pending.length})</h3>
          {pending.map((c) => (
            <ClientApprovalCard key={c.id} id={c.id} name={c.name} type={c.type} phone={c.phone} added_by_name={c.users?.full_name ?? null} />
          ))}
        </div>
      )}

      <form method="get" className="px-4 py-2 grid grid-cols-2 gap-2">
        <select name="actor" defaultValue={sp.actor ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
          <option value="">كل الفاعلين</option>
          {(employeesRes.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select name="action" defaultValue={sp.action ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
          <option value="">كل الإجراءات</option>
          <option value="visit_created">زيارة جديدة</option>
          <option value="client_added">زبون جديد</option>
          <option value="client_approved">موافقة على زبون</option>
          <option value="clients_merged">دمج زبائن</option>
          <option value="expense_added">مصروف جديد</option>
          <option value="product_added">منتج جديد</option>
          <option value="production_recorded">إنتاج جديد</option>
        </select>
        <button type="submit" className="col-span-2 bg-primary text-white text-xs font-cairo font-semibold py-1.5 rounded-lg">تطبيق</button>
      </form>

      <h3 className="text-[11px] font-cairo font-bold text-muted uppercase px-4 mt-2 mb-2">سجل النشاط ({feed.length})</h3>
      {feed.length === 0 ? (
        <EmptyState icon={Bell} title="لا يوجد نشاط بعد" />
      ) : (
        <ul className="px-3 space-y-1.5">
          {feed.map((a) => (
            <ActivityFeedItem
              key={a.id} actor={a.actor_name} action={a.action} summary={a.summary_ar}
              createdAt={a.created_at} unread={!a.read_by_admin}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
