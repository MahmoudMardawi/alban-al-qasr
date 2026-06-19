import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityAction =
  | "visit_created"
  | "visit_edited"
  | "client_added"
  | "client_approved"
  | "clients_merged"
  | "expense_added"
  | "payment_recorded";

export interface ActivityPayload {
  actor_id: string;
  action: ActivityAction | string;
  entity_type: string | null;
  entity_id: string | null;
  summary_ar: string;
  payload: Record<string, unknown> | null;
}

export async function logActivity(supabase: SupabaseClient, p: ActivityPayload): Promise<void> {
  try {
    const { error } = await supabase.from("activity_log").insert({
      actor_id:     p.actor_id,
      action:       p.action,
      entity_type:  p.entity_type,
      entity_id:    p.entity_id,
      summary_ar:   p.summary_ar,
      payload:      p.payload,
    });
    if (error) {
      console.warn("[activity_log] insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[activity_log] threw:", e);
  }
}
