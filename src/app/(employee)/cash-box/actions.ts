"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

export async function recordRepExpense(input: { amount: number; category: "fuel" | "salary" | "rent" | "milk" | "other"; note?: string | null }): Promise<{ error?: string }> {
  if (input.amount <= 0) return { error: "أدخل مبلغًا أكبر من صفر" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      category:    input.category,
      amount:      input.amount,
      recorded_by: user.id,
      note:        input.note ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "تعذّر حفظ السند" };

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "rep_expense_recorded",
    entity_type: "expense",
    entity_id:   data.id,
    summary_ar:  `صرف ${input.amount} ₪ من الصندوق (${input.category})`,
    payload:     { category: input.category, amount: input.amount },
  });

  revalidatePath("/cash-box");
  return {};
}

export async function openCashBoxSession(input: { opening_float: number; notes?: string | null }): Promise<{ error?: string; sessionId?: string }> {
  if (input.opening_float < 0) return { error: "الرصيد الافتتاحي لا يمكن أن يكون سالباً" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("cash_box_sessions")
    .insert({ employee_id: user.id, opening_float: input.opening_float, notes: input.notes ?? null })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.message.includes("idx_one_open_cash_box_per_employee_per_day")) {
      return { error: "يوجد صندوق مفتوح اليوم بالفعل — أغلقه أولاً" };
    }
    return { error: error?.message ?? "تعذّر فتح الصندوق" };
  }

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "cash_box_opened",
    entity_type: "cash_box_session",
    entity_id:   data.id,
    summary_ar:  `فتح صندوقًا اليوم برصيد ${input.opening_float} ₪`,
    payload:     { opening_float: input.opening_float },
  });

  revalidatePath("/cash-box");
  return { sessionId: data.id };
}

export async function closeCashBoxSession(input: { session_id: string; closing_actual: number; notes?: string | null }): Promise<{ error?: string }> {
  if (input.closing_actual < 0) return { error: "العدّ الفعلي لا يمكن أن يكون سالباً" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { error } = await supabase
    .from("cash_box_sessions")
    .update({
      status:          "closed",
      closing_actual:  input.closing_actual,
      closed_at:       new Date().toISOString(),
      notes:           input.notes ?? null,
    })
    .eq("id", input.session_id);
  if (error) return { error: error.message };

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "cash_box_closed",
    entity_type: "cash_box_session",
    entity_id:   input.session_id,
    summary_ar:  `أقفل صندوقه بمبلغ ${input.closing_actual} ₪`,
    payload:     { closing_actual: input.closing_actual },
  });

  revalidatePath("/cash-box");
  revalidatePath(`/cash-box/${input.session_id}`);
  return {};
}
