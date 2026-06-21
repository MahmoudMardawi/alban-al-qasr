"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type PaymentKind = "receipt" | "disbursement";

export interface RecordPaymentInput {
  client_id: string;
  amount: number;
  method: "cash" | "transfer" | "other";
  kind?: PaymentKind;
  paid_at?: string;        // ISO date; defaults to now
  note?: string | null;
}

export async function recordStandalonePayment(input: RecordPaymentInput): Promise<{ error?: string; paymentId?: string }> {
  if (!input.client_id) return { error: "زبون غير محدد" };
  if (!input.amount || input.amount <= 0) return { error: "أدخل مبلغًا أكبر من صفر" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const kind = input.kind ?? "receipt";

  // kind column from migration 0014 — not in generated types until db push + types:gen
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const insertPayload: any = {
    client_id:   input.client_id,
    amount:      input.amount,
    method:      input.method,
    kind,
    paid_at:     input.paid_at ? new Date(input.paid_at).toISOString() : new Date().toISOString(),
    recorded_by: user.id,
    note:        input.note ?? null,
    visit_id:    null,
  };
  const { data, error } = await supabase
    .from("payments")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "تعذّر حفظ السند" };

  const clientRes = await supabase.from("clients").select("name").eq("id", input.client_id).maybeSingle();
  const clientName = clientRes.data?.name ?? "(زبون)";

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      kind === "receipt" ? "payment_received" : "payment_disbursed",
    entity_type: "payment",
    entity_id:   data.id,
    summary_ar:  kind === "receipt"
      ? `استلم تحصيل ${input.amount} ₪ من ${clientName} (سند قبض)`
      : `صرف للزبون ${input.amount} ₪ — ${clientName} (سند صرف)`,
    payload:     { client_id: input.client_id, amount: input.amount, method: input.method, kind },
  });

  revalidatePath("/payments");
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/statement`);
  revalidatePath("/reports/receivables");
  return { paymentId: data.id };
}

export async function recordPaymentAndRedirect(formData: FormData): Promise<void> {
  const client_id  = String(formData.get("client_id") ?? "");
  const amount     = Number(formData.get("amount") ?? 0);
  const method     = String(formData.get("method") ?? "cash") as RecordPaymentInput["method"];
  const note       = String(formData.get("note") ?? "") || null;
  const paid_at    = String(formData.get("paid_at") ?? "") || undefined;

  const res = await recordStandalonePayment({ client_id, amount, method, note, paid_at });
  if (res.error) throw new Error(res.error);
  if (res.paymentId) redirect(`/payments/${res.paymentId}`);
}
