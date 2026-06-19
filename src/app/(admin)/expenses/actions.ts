"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { validateExpenseInput } from "@/lib/admin-validation";
import { revalidatePath } from "next/cache";

export interface NewExpenseInput {
  category: "fuel" | "salary" | "rent" | "milk" | "other";
  amount: number;
  spent_at: string;
  note: string | null;
  receipt_url: string | null;
}

export async function createExpense(input: NewExpenseInput): Promise<{ id?: string; error?: string }> {
  const v = validateExpenseInput({ category: input.category, amount: input.amount });
  if (!v.ok) return { error: v.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.from("expenses").insert({
    ...input, recorded_by: user.id,
  }).select("id").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الحفظ" };

  await logActivity(supabase, {
    actor_id: user.id, action: "expense_added",
    entity_type: "expense", entity_id: data.id,
    summary_ar: `سجّل مصروف ${input.category}: ${input.amount} ₪`,
    payload: { category: input.category, amount: input.amount },
  });

  revalidatePath("/expenses");
  return { id: data.id };
}

export async function deleteExpense(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return {};
}
