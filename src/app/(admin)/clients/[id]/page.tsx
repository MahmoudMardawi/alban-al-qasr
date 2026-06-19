import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClientEditForm } from "@/components/ClientEditForm";

export const dynamic = "force-dynamic";

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error || !data) return notFound();
  return (
    <div className="p-4">
      <Link href="/clients" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">تعديل الزبون: {data.name}</h2>
      <ClientEditForm initial={{
        id: data.id, name: data.name, type: (data.type ?? "market") as "supermarket" | "market" | "individual",
        phone: data.phone ?? "", address: data.address ?? "", notes: data.notes ?? "",
      }} />
    </div>
  );
}
