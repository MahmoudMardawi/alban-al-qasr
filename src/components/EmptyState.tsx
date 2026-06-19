import Link from "next/link";
import { type LucideIcon, Plus } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
}

export function EmptyState({ icon: Icon, title, subtitle, ctaHref, ctaLabel }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-16 h-16 rounded-full bg-info-bg flex items-center justify-center mb-3">
        <Icon size={28} className="text-primary-dk" />
      </div>
      <h3 className="font-cairo font-semibold text-ink text-base">{title}</h3>
      {subtitle && <p className="text-muted text-xs mt-1 font-cairo">{subtitle}</p>}
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="mt-4 inline-flex items-center gap-1.5 bg-primary text-white font-cairo font-semibold text-sm px-4 py-2 rounded-xl">
          <Plus size={16} /> {ctaLabel}
        </Link>
      )}
    </div>
  );
}
