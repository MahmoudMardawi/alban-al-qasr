"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Users, Package, Menu } from "lucide-react";
import { AdminMoreSheet } from "./AdminMoreSheet";

const PRIMARY = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutGrid },
  { href: "/clients",   label: "الزبائن",   icon: Users },
  { href: "/products",  label: "المنتجات",  icon: Package },
] as const;

export function AdminBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = ["/expenses", "/production", "/users", "/reports", "/inventory", "/export", "/ai", "/activity", "/load", "/payments"]
    .some((p) => pathname.startsWith(p));

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-40 print:hidden">
        <ul className="flex justify-around items-center max-w-md mx-auto">
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link href={href} className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-cairo font-semibold ${active ? "text-primary" : "text-muted"}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-cairo font-semibold ${moreActive ? "text-primary" : "text-muted"}`}
            >
              <Menu size={20} strokeWidth={moreActive ? 2.5 : 2} />
              <span>المزيد</span>
            </button>
          </li>
        </ul>
      </nav>
      <AdminMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
