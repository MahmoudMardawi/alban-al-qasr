import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getCurrentUserWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function mockSupabase(authUserId: string | null, profile: { role: string; full_name: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUserId ? { id: authUserId, email: "x@y.z" } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profile, error: null }),
    }),
  };
}

describe("getCurrentUserWithRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no auth user", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase(null, null));
    expect(await getCurrentUserWithRole()).toBeNull();
  });

  it("returns user with role 'admin' for admin profile", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase("u1", { role: "admin", full_name: "Majdi" }),
    );
    const u = await getCurrentUserWithRole();
    expect(u).toEqual({ id: "u1", email: "x@y.z", role: "admin", full_name: "Majdi" });
  });

  it("returns user with role 'employee' for employee profile", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase("u2", { role: "employee", full_name: "Ahmad" }),
    );
    const u = await getCurrentUserWithRole();
    expect(u?.role).toBe("employee");
  });

  it("returns null when auth user exists but no profile row", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase("u3", null));
    expect(await getCurrentUserWithRole()).toBeNull();
  });
});
