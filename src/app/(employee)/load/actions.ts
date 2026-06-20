"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

// truck_loads / truck_load_items were added in migration 0010 and aren't yet in
// the generated Database type. Until `npm run types:gen` runs, we bypass typing
// for these queries only.

export interface LoadItemInput {
  product_id: string;
  qty_loaded: number;
}

export interface StartLoadInput {
  items: LoadItemInput[];
  notes?: string | null;
}

export async function startTruckLoad(input: StartLoadInput): Promise<{ loadId?: string; error?: string }> {
  if (!input.items.length) return { error: "أضف منتج واحد على الأقل" };
  const validItems = input.items.filter((i) => i.qty_loaded > 0);
  if (!validItems.length) return { error: "أدخل كمية للتحميل" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const db = supabase as unknown as { from: (t: string) => any };

  const insertRes = await db.from("truck_loads")
    .insert({ employee_id: user.id, notes: input.notes ?? null })
    .select("id")
    .single();

  if (insertRes.error) {
    if (String(insertRes.error.message).includes("idx_one_open_load_per_employee_per_day")) {
      return { error: "يوجد تحميل مفتوح اليوم بالفعل — أغلقه أولاً" };
    }
    return { error: insertRes.error.message };
  }
  const loadId: string = insertRes.data.id;

  const itemsPayload = validItems.map((i) => ({
    load_id:    loadId,
    product_id: i.product_id,
    qty_loaded: i.qty_loaded,
  }));
  const itemsRes = await db.from("truck_load_items").insert(itemsPayload);
  if (itemsRes.error) return { error: itemsRes.error.message };

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "truck_load_started",
    entity_type: "truck_load",
    entity_id:   loadId,
    summary_ar:  `بدأ تحميل السيارة (${validItems.length} منتج)`,
    payload:     { items_count: validItems.length },
  });

  revalidatePath("/load");
  return { loadId };
}

export interface CloseLoadInput {
  load_id: string;
  returns: Array<{ product_id: string; qty_returned: number }>;
  notes?: string | null;
}

export async function closeTruckLoad(input: CloseLoadInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const db = supabase as unknown as { from: (t: string) => any };

  for (const r of input.returns) {
    if (r.qty_returned < 0) continue;
    const upd = await db.from("truck_load_items")
      .update({ qty_returned: r.qty_returned })
      .eq("load_id", input.load_id)
      .eq("product_id", r.product_id);
    if (upd.error) return { error: upd.error.message };
  }

  const closeRes = await db.from("truck_loads")
    .update({
      status:    "closed",
      closed_at: new Date().toISOString(),
      notes:     input.notes ?? null,
    })
    .eq("id", input.load_id);
  if (closeRes.error) return { error: closeRes.error.message };

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "truck_load_closed",
    entity_type: "truck_load",
    entity_id:   input.load_id,
    summary_ar:  "أغلق تحميل السيارة (تسوية نهاية اليوم)",
    payload:     { returns_count: input.returns.length },
  });

  revalidatePath("/load");
  return {};
}
