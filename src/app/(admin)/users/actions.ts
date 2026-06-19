"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface InviteUserInput {
  email: string;
  full_name: string;
  password: string;
  role: "admin" | "employee";
}

export async function inviteUser(input: InviteUserInput): Promise<{ id?: string; error?: string }> {
  if (!input.email || !input.password) return { error: "البريد وكلمة المرور مطلوبان" };
  if (input.password.length < 8) return { error: "كلمة المرور لا تقل عن 8 أحرف" };

  // Verify caller is admin (defense in depth — layout already enforces this)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };
  const { data: callerProfile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") return { error: "ممنوع. للمدراء فقط" };

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, role: input.role },
  });
  if (createErr || !created.user) return { error: createErr?.message ?? "تعذّر الإنشاء" };

  // The DB trigger from migration 0002 mirrors auth.users → public.users with role from metadata.
  // For safety, also UPDATE in case the trigger ran with a default.
  await admin.from("users").update({
    full_name: input.full_name, role: input.role,
  }).eq("id", created.user.id);

  revalidatePath("/users");
  return { id: created.user.id };
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ is_active: isActive }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/users");
  return {};
}
