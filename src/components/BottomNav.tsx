"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Truck, Wallet, User } from "lucide-react";

const items = [
  { href: "/",          label: "الزبائن",   icon: Home },
  { href: "/load",      label: "التحميل",   icon: Truck },
  { href: "/cash-box",  label: "الصندوق",   icon: Wallet },
  { href: "/my-visits", label: "زياراتي",   icon: ClipboardList },
  { href: "/profile",   label: "حسابي",    icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-40 print:hidden">
      <ul className="flex justify-around items-center max-w-md mx-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 px-4 py-1 text-[11px] font-cairo font-semibold ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
