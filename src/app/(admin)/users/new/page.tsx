"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { inviteUser } from "../actions";

export default function NewUser() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [name, setName]       = useState("");
  const [password, setPwd]    = useState("");
  const [role, setRole]       = useState<"admin" | "employee">("employee");
  const [error, setError]     = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await inviteUser({ email, full_name: name, password, role });
      if (res.error) setError(res.error);
      else router.push("/users");
    });
  }

  return (
    <div className="p-4">
      <Link href="/users" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">دعوة موظف</h2>
      <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">الاسم *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">البريد *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">كلمة مرور أولية * (8 أحرف على الأقل)</label>
          <input type="text" value={password} onChange={(e) => setPwd(e.target.value)} required dir="ltr" minLength={8}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3" />
          <p className="text-[10px] text-muted font-cairo mt-1">سيدخل بها الموظف. شاركها معه آمناً ثم اطلب تغييرها لاحقاً.</p>
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">الدور *</label>
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "employee")}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 font-cairo">
            <option value="employee">موظف توزيع</option>
            <option value="admin">مدير</option>
          </select>
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}
        <button onClick={submit} disabled={pending || !email || !password || !name}
          className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
          {pending ? "جارٍ الإضافة..." : "إنشاء الحساب"}
        </button>
      </div>
    </div>
  );
}
