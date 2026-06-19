import { describe, it, expect, vi, beforeEach } from "vitest";
import { logActivity } from "@/lib/activity-log";

describe("logActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts an activity_log row with the given payload", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    await logActivity(supabase as never, {
      actor_id: "u1",
      action: "visit_created",
      entity_type: "visit",
      entity_id: "v1",
      summary_ar: "أحمد سجّل زيارة جديدة لـ سوبر ماركت الأخوة",
      payload: { lines_count: 3 },
    });

    expect(supabase.from).toHaveBeenCalledWith("activity_log");
    expect(insert).toHaveBeenCalledWith({
      actor_id: "u1",
      action: "visit_created",
      entity_type: "visit",
      entity_id: "v1",
      summary_ar: "أحمد سجّل زيارة جديدة لـ سوبر ماركت الأخوة",
      payload: { lines_count: 3 },
    });
  });

  it("does NOT throw if insert returns an error (best-effort logging)", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "RLS" } });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    await expect(
      logActivity(supabase as never, {
        actor_id: "u1",
        action: "visit_created",
        entity_type: "visit",
        entity_id: null,
        summary_ar: "x",
        payload: null,
      }),
    ).resolves.toBeUndefined();
  });
});
