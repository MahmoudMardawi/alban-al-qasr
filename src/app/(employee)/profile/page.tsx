import { getCurrentUserWithRole } from "@/lib/auth";

export default async function Profile() {
  const user = await getCurrentUserWithRole();

  return (
    <div className="p-4">
      <h2 className="font-cairo font-bold text-forest text-lg mb-3">حسابي</h2>
      <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
        <div>
          <div className="text-[11px] text-muted font-cairo">الاسم</div>
          <div className="font-cairo font-semibold text-ink mt-0.5">{user?.full_name ?? "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted font-cairo">البريد الإلكتروني</div>
          <div className="font-cairo text-sm text-ink mt-0.5" dir="ltr">{user?.email ?? "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted font-cairo">الدور</div>
          <div className="font-cairo text-sm text-ink mt-0.5">{user?.role === "admin" ? "مدير" : "موظف توزيع"}</div>
        </div>
        <form action="/logout" method="post" className="pt-3 border-t border-border">
          <button
            type="submit"
            className="w-full rounded-xl bg-red-50 text-danger border border-red-200 font-cairo font-bold py-3"
          >
            خروج من الحساب
          </button>
        </form>
      </div>
    </div>
  );
}
