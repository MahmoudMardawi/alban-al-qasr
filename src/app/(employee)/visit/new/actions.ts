"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import type { DraftLine } from "@/lib/ledgers";

export type PaymentMethod = "cash" | "transfer";

export interface CreateVisitInput {
  client_id: string;
  lines: DraftLine[];
  notes?: string | null;
  /** Amount the customer paid at the time of the visit. 0 = الزيارة آجل. */
  payment_amount?: number;
  payment_method?: PaymentMethod;
}

export interface CreateVisitResult {
  visitId?: string;
  error?: string;
}

export async function createVisitWithLines(input: CreateVisitInput): Promise<CreateVisitResult> {
  if (!input.client_id) return { error: "زبون غير محدد" };
  if (!input.lines.length) return { error: "أضف عنصر واحد على الأقل" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data: visit, error: visitErr } = await supabase
    .from("visits")
    .insert({
      client_id:   input.client_id,
      employee_id: user.id,
      notes:       input.notes ?? null,
    })
    .select("id, client_id")
    .single();

  if (visitErr || !visit) {
    return { error: visitErr?.message ?? "تعذّر إنشاء الزيارة" };
  }

  const linesPayload = input.lines.map((l) => ({
    visit_id:    visit.id,
    product_id:  l.product_id,
    package_id:  l.package_id,
    qty:         l.qty,
    base_qty:    l.base_qty,
    unit_price:  l.unit_price,
    line_type:   l.line_type,
    note:        l.note ?? null,
  }));

  const { error: linesErr } = await supabase.from("visit_lines").insert(linesPayload);
  if (linesErr) {
    await supabase.from("visits").delete().eq("id", visit.id);
    return { error: linesErr.message };
  }

  // If the customer paid at the visit, record the payment linked to this visit.
  // 0 / undefined / null means آجل — leave it on the receivables (ذمم).
  const paid = Number(input.payment_amount ?? 0);
  if (paid > 0) {
    const { error: payErr } = await supabase.from("payments").insert({
      client_id:   input.client_id,
      amount:      paid,
      method:      input.payment_method ?? "cash",
      recorded_by: user.id,
      visit_id:    visit.id,
      note:        "دفعة مرفقة بالزيارة",
    });
    if (payErr) {
      // Non-fatal — visit + lines exist. Receivables can be cleared later via /clients.
      console.warn("[createVisitWithLines] payment insert failed:", payErr.message);
    }
  }

  const clientRes = await supabase.from("clients").select("name").eq("id", input.client_id).maybeSingle();
  const clientName = clientRes.data?.name ?? "(زبون)";

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "visit_created",
    entity_type: "visit",
    entity_id:   visit.id,
    summary_ar:  `سجّل زيارة جديدة لـ ${clientName} (${input.lines.length} عنصر)`,
    payload:     { client_id: visit.client_id, lines_count: input.lines.length, payment_amount: paid },
  });

  revalidatePath("/");
  revalidatePath(`/client/${input.client_id}`);
  return { visitId: visit.id };
}
