import { getCurrentUserWithRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { AdminBottomNav } from "@/components/AdminBottomNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserWithRole();
  if (!user || user.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen pb-20">
      <BrandHeader subtitle={`مرحباً ${user.full_name} · المدير`} />
      <main className="max-w-md mx-auto">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
