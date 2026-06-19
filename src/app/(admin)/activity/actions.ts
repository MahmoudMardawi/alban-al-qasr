"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAllRead(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("activity_log").update({ read_by_admin: true }).eq("read_by_admin", false);
  if (error) return { error: error.message };
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  return {};
}
