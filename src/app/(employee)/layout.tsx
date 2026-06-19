import { getCurrentUserWithRole } from "@/lib/auth";
import { BrandHeader } from "@/components/BrandHeader";
import { BottomNav } from "@/components/BottomNav";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserWithRole();
  return (
    <div className="min-h-screen pb-20">
      <BrandHeader subtitle={`مرحباً ${user?.full_name ?? ""} · موظف توزيع`} />
      <main className="max-w-md mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
