"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { validateProductionInput } from "@/lib/admin-validation";
import { revalidatePath } from "next/cache";

export interface NewProductionInput {
  product_id: string;
  qty_produced: number;
  qty_wasted: number;
  produced_at: string;
  note: string | null;
}

export async function createProductionEntry(input: NewProductionInput): Promise<{ id?: string; error?: string }> {
  const v = validateProductionInput({ product_id: input.product_id, qty_produced: input.qty_produced, qty_wasted: input.qty_wasted });
  if (!v.ok) return { error: v.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.from("production").insert({
    ...input, recorded_by: user.id,
  }).select("id").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الحفظ" };

  const pName = (await supabase.from("products").select("name_ar").eq("id", input.product_id).maybeSingle()).data?.name_ar ?? "?";
  await logActivity(supabase, {
    actor_id: user.id, action: "production_recorded",
    entity_type: "production", entity_id: data.id,
    summary_ar: `سجّل إنتاج ${pName}: ${input.qty_produced}، فاقد ${input.qty_wasted}`,
    payload: { product_id: input.product_id, qty_produced: input.qty_produced, qty_wasted: input.qty_wasted },
  });

  revalidatePath("/production");
  return { id: data.id };
}
