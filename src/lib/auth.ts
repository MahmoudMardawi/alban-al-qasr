import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "employee";

export interface CurrentUser {
  id: string;
  email: string;
  role: AppRole;
  full_name: string;
}

export async function getCurrentUserWithRole(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role as AppRole,
    full_name: profile.full_name,
  };
}
