"use client";

import Link from "next/link";
import { type LucideIcon, Receipt, Factory, UserCog, BarChart3, ClipboardList, Download, Sparkles, Bell, Truck, LogOut } from "lucide-react";

interface Props { open: boolean; onClose: () => void }

interface MoreItem { href: string; label: string; icon: LucideIcon; disabled?: boolean }

const ITEMS: MoreItem[] = [
  { href: "/load",       label: "تحميل السيارة",            icon: Truck },
  { href: "/expenses",   label: "المصاريف",                icon: Receipt },
  { href: "/production", label: "الإنتاج والفاقد",          icon: Factory },
  { href: "/users",      label: "الموظفين",                 icon: UserCog },
  { href: "/reports",    label: "التقارير",                 icon: BarChart3 },
  { href: "/inventory",  label: "الجرد",                    icon: ClipboardList },
  { href: "/export",     label: "تصدير",                    icon: Download },
  { href: "/ai",         label: "اسأل بياناتك",             icon: Sparkles },
  { href: "/activity",   label: "الإشعارات",                icon: Bell },
];

export function AdminMoreSheet({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo font-bold text-ink text-base">المزيد</h3>
          <button onClick={onClose} className="text-muted text-xs font-cairo">إغلاق</button>
        </div>
        <ul className="grid grid-cols-2 gap-2 mb-4">
          {ITEMS.map(({ href, label, icon: Icon, disabled }) => disabled ? (
            <li key={href}>
              <div className="flex flex-col items-center gap-1.5 bg-info-bg/40 border border-border rounded-xl p-4 text-muted opacity-60 cursor-not-allowed">
                <Icon size={22} />
                <span className="font-cairo text-xs">{label}</span>
              </div>
            </li>
          ) : (
            <li key={href}>
              <Link href={href} onClick={onClose} className="flex flex-col items-center gap-1.5 bg-info-bg/40 border border-border rounded-xl p-4 text-primary-dk hover:bg-info-bg">
                <Icon size={22} />
                <span className="font-cairo text-xs font-semibold">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <form action="/logout" method="post">
          <button type="submit" className="w-full rounded-xl bg-red-50 text-danger border border-red-200 font-cairo font-bold py-3 flex items-center justify-center gap-2">
            <LogOut size={18} /> تسجيل الخروج من الحساب
          </button>
          <p className="text-[10px] text-muted text-center mt-1 font-cairo">
            (سيُطلب منك إدخال كلمة المرور مجدداً)
          </p>
        </form>
      </div>
    </div>
  );
}
