import { createClient } from "@/lib/supabase/server";

export interface ActivityRow {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary_ar: string | null;
  read_by_admin: boolean;
  created_at: string;
}

export interface ActivityFilters {
  actorId?: string | null;
  action?: string | null;
  unreadOnly?: boolean;
}

export async function getActivityFeed(filters: ActivityFilters = {}, limit = 100): Promise<ActivityRow[]> {
  const supabase = await createClient();
  let q = supabase.from("activity_log")
    .select("id, actor_id, action, entity_type, entity_id, summary_ar, read_by_admin, created_at, users(full_name)")
    .order("created_at", { ascending: false }).limit(limit);

  if (filters.actorId)    q = q.eq("actor_id", filters.actorId);
  if (filters.action)     q = q.eq("action", filters.action);
  if (filters.unreadOnly) q = q.eq("read_by_admin", false);

  const { data } = await q;
  type Row = {
    id: string; actor_id: string; action: string; entity_type: string | null; entity_id: string | null;
    summary_ar: string | null; read_by_admin: boolean; created_at: string;
    users: { full_name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, actor_id: r.actor_id, actor_name: r.users?.full_name ?? "?", action: r.action,
    entity_type: r.entity_type, entity_id: r.entity_id, summary_ar: r.summary_ar,
    read_by_admin: r.read_by_admin, created_at: r.created_at,
  }));
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("activity_log")
    .select("id", { count: "exact", head: true }).eq("read_by_admin", false);
  return count ?? 0;
}
