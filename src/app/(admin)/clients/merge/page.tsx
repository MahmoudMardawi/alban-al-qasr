import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MergeWizard } from "@/components/MergeWizard";

export default function MergePage() {
  return (
    <div className="p-4">
      <Link href="/clients" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">دمج زبائن مكررين</h2>
      <MergeWizard />
    </div>
  );
}
