"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addPendingClient(formData: FormData) {
  const name  = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const type  = String(formData.get("type") ?? "market") as "supermarket" | "market" | "individual";

  if (!name) return { error: "الاسم مطلوب" };
  if (!["supermarket", "market", "individual"].includes(type)) return { error: "نوع غير صالح" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("clients")
    .insert({ name, phone, type, added_by: user.id, is_approved: false })
    .select("id, name")
    .single();

  if (error || !data) return { error: error?.message ?? "تعذّر الإضافة" };

  await logActivity(supabase, {
    actor_id: user.id,
    action: "client_added",
    entity_type: "client",
    entity_id: data.id,
    summary_ar: `أضاف زبون جديد بانتظار الموافقة: ${data.name}`,
    payload: { name: data.name, type },
  });

  revalidatePath("/");
  redirect(`/client/${data.id}`);
}
