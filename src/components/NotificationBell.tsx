"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props { initialCount: number }

export function NotificationBell({ initialCount }: Props) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("activity_log_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, () => {
        setCount((c) => c + 1);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "activity_log" }, async () => {
        const { count: c } = await supabase
          .from("activity_log")
          .select("id", { count: "exact", head: true })
          .eq("read_by_admin", false);
        setCount(c ?? 0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Link href="/activity" aria-label="الإشعارات"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-info-bg">
      <Bell size={18} className="text-forest" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-warn text-white text-[10px] font-cairo font-bold rounded-full flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
