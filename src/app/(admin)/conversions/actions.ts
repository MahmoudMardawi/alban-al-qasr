"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

export interface ConversionInput {
  source_product_id: string;
  source_qty: number;
  target_product_id: string;
  target_qty: number;
  converted_at?: string;       // ISO date; defaults to now
  notes?: string | null;
}

export async function recordConversion(input: ConversionInput): Promise<{ error?: string; conversionId?: string }> {
  if (!input.source_product_id || !input.target_product_id) return { error: "اختر الصنفين المصدر والوجهة" };
  if (input.source_product_id === input.target_product_id) return { error: "الصنف المصدر يجب أن يكون مختلفًا عن الوجهة" };
  if (input.source_qty <= 0 || input.target_qty <= 0) return { error: "الكميات يجب أن تكون أكبر من صفر" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const db = supabase as unknown as { from: (t: string) => any };
  const { data, error } = await db
    .from("product_conversions")
    .insert({
      source_product_id: input.source_product_id,
      source_qty:        input.source_qty,
      target_product_id: input.target_product_id,
      target_qty:        input.target_qty,
      converted_at:      input.converted_at ? new Date(input.converted_at).toISOString() : new Date().toISOString(),
      notes:             input.notes ?? null,
      recorded_by:       user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "تعذّر حفظ التحويل" };

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "product_converted",
    entity_type: "product_conversion",
    entity_id:   data.id,
    summary_ar:  `تحويل ${input.source_qty} من صنف إلى ${input.target_qty} من صنف آخر`,
    payload:     { source_qty: input.source_qty, target_qty: input.target_qty },
  });

  revalidatePath("/conversions");
  revalidatePath("/inventory");
  return { conversionId: data.id };
}
