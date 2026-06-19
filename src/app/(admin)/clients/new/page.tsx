import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClientEditForm } from "@/components/ClientEditForm";

export default function NewClient() {
  return (
    <div className="p-4">
      <Link href="/clients" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">زبون جديد</h2>
      <ClientEditForm initial={{ name: "", type: "market", phone: "", address: "", notes: "" }} />
    </div>
  );
}
