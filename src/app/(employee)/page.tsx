import { getCurrentUserWithRole } from "@/lib/auth";
import { BrandHeader } from "@/components/BrandHeader";

export default async function EmployeeHome() {
  const user = await getCurrentUserWithRole();
  return (
    <div className="min-h-screen">
      <BrandHeader subtitle={`مرحباً ${user?.full_name ?? ""} · موظف توزيع`} />
      <main className="p-6 text-center text-muted">
        <p className="text-sm">قائمة الزبائن ستظهر هنا (المرحلة 2)</p>
      </main>
    </div>
  );
}
