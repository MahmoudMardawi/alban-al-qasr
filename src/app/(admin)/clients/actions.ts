"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

export async function approveClient(clientId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("clients").update({ is_approved: true })
    .eq("id", clientId).select("name").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الموافقة" };

  await logActivity(supabase, {
    actor_id: user.id, action: "client_approved",
    entity_type: "client", entity_id: clientId,
    summary_ar: `وافق على الزبون: ${data.name}`, payload: null,
  });
  revalidatePath("/clients");
  return {};
}

export interface ClientEditInput {
  name: string; type: "supermarket" | "market" | "individual";
  phone: string | null; address: string | null; notes: string | null;
}

export async function createClientFull(input: ClientEditInput & { is_approved?: boolean }): Promise<{ id?: string; error?: string }> {
  if (!input.name.trim()) return { error: "الاسم مطلوب" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.from("clients")
    .insert({ ...input, name: input.name.trim(), added_by: user.id, is_approved: input.is_approved ?? true })
    .select("id, name").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الإضافة" };

  revalidatePath("/clients");
  return { id: data.id };
}

export async function updateClient(clientId: string, input: ClientEditInput): Promise<{ error?: string }> {
  if (!input.name.trim()) return { error: "الاسم مطلوب" };
  const supabase = await createClient();
  const { error } = await supabase.from("clients")
    .update({ ...input, name: input.name.trim() }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return {};
}

export async function deleteClient(clientId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { count } = await supabase.from("visits")
    .select("id", { count: "exact", head: true }).eq("client_id", clientId);
  if ((count ?? 0) > 0) {
    return { error: "لا يمكن حذف زبون لديه زيارات سابقة. عطّله أو ادمجه بزبون آخر بدلاً من ذلك." };
  }
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath("/clients");
  return {};
}

export async function mergeClients(primaryId: string, duplicateIds: string[]): Promise<{ moved?: number; error?: string }> {
  if (!primaryId || duplicateIds.length === 0) return { error: "اختر زبون رئيسي وزبون مكرر واحد على الأقل" };
  if (duplicateIds.includes(primaryId)) return { error: "الزبون الرئيسي لا يمكن أن يكون من المكررات" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.rpc("fn_merge_clients", {
    primary_id: primaryId, duplicate_ids: duplicateIds,
  });
  if (error) return { error: error.message };

  const primary = await supabase.from("clients").select("name").eq("id", primaryId).maybeSingle();
  const dupNames = await supabase.from("clients").select("name").in("id", duplicateIds);
  await logActivity(supabase, {
    actor_id: user.id, action: "clients_merged",
    entity_type: "client", entity_id: primaryId,
    summary_ar: `دمج ${duplicateIds.length} زبون مكرر إلى ${primary.data?.name ?? "(زبون)"}: ${(dupNames.data ?? []).map((x) => x.name).join(" · ")}`,
    payload: { primary_id: primaryId, duplicate_ids: duplicateIds, moved_count: data },
  });

  revalidatePath("/clients");
  return { moved: data ?? 0 };
}
