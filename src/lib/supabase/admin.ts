import { createClient as createSupaClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Service-role client — bypasses RLS. ONLY use from Server Actions/Routes after
 * verifying the caller is admin. NEVER expose to client components.
 */
export function createAdminClient() {
  return createSupaClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
