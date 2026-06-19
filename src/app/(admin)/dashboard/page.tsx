import { getCurrentUserWithRole } from "@/lib/auth";
import { BrandHeader } from "@/components/BrandHeader";

export default async function AdminDashboard() {
  const user = await getCurrentUserWithRole();
  return (
    <div className="min-h-screen">
      <BrandHeader subtitle={`مرحباً ${user?.full_name ?? ""} · المدير`} />
      <main className="p-6 text-center text-muted">
        <p className="text-sm">لوحة التحكم ستظهر هنا (المرحلة 4)</p>
      </main>
    </div>
  );
}
