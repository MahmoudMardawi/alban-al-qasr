"use client";

import { useState, useTransition } from "react";
import { toggleUserActive } from "@/app/(admin)/users/actions";

interface User { id: string; email: string; full_name: string; role: string; is_active: boolean }

export function UserRow({ user }: { user: User }) {
  const [active, setActive] = useState(user.is_active);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await toggleUserActive(user.id, !active);
      if (!res.error) setActive(!active);
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="font-cairo font-semibold text-ink text-sm">{user.full_name || user.email}</div>
        <div className="text-[10px] text-muted font-cairo mt-0.5" dir="ltr">{user.email}</div>
        <div className="text-[10px] text-primary-dk font-cairo mt-0.5">{user.role === "admin" ? "مدير" : "موظف توزيع"}</div>
      </div>
      <button onClick={toggle} disabled={pending}
        className={`text-xs font-cairo font-semibold px-3 py-1.5 rounded-full border ${
          active ? "bg-info-bg text-primary border-border" : "bg-red-50 text-danger border-red-200"
        }`}>
        {active ? "فعّال" : "موقوف"}
      </button>
    </div>
  );
}
