"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllRead } from "@/app/(admin)/activity/actions";
import { ACTIVITY_READ_EVENT } from "@/components/NotificationBell";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  function go() {
    startTransition(async () => {
      const res = await markAllRead();
      // Always notify the bell to clear so the badge updates immediately —
      // Realtime UPDATE events can race or arrive out-of-order.
      if (!res.error && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(ACTIVITY_READ_EVENT));
      }
    });
  }
  return (
    <button onClick={go} disabled={pending}
      className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border disabled:opacity-50">
      <CheckCheck size={14} /> {pending ? "جارٍ..." : "وضع الكل كمقروء"}
    </button>
  );
}
