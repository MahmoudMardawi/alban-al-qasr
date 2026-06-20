import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listCashBoxSessions } from "@/lib/cash-box-data";
import { OpenSessionForm } from "./open-session-form";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CashBoxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-6 text-center font-cairo text-sm">سجّل دخول أولاً</div>;

  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const sessions = await listCashBoxSessions({ employeeId: user.id });
  const todaysOpen = sessions.find((s) => s.session_date === todayDate && s.status === "open");
  const history = sessions.filter((s) => s.id !== todaysOpen?.id).slice(0, 10);

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white p-4">
        <Link href="/" className="flex items-center gap-1 text-xs text-white/80 mb-2">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <div className="flex items-center gap-2">
          <Wallet size={22} />
          <h2 className="font-cairo font-bold text-lg">صندوق المندوب</h2>
        </div>
        <p className="text-xs opacity-80 mt-0.5">
          {todaysOpen ? "صندوق اليوم مفتوح — اضغط لمتابعة أو إغلاق التسوية" : "ابدأ صندوقك اليوم بتسجيل الرصيد الافتتاحي"}
        </p>
      </div>

      <div className="px-4 py-4">
        {todaysOpen ? (
          <Link
            href={`/cash-box/${todaysOpen.id}`}
            className="block bg-white border-2 border-primary rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-cairo font-bold text-sm text-primary-dk">صندوق اليوم — مفتوح</span>
              <span className="text-[10px] font-cairo text-muted" dir="ltr">{formatDateShort(new Date(todaysOpen.session_date))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-cairo text-muted">رصيد افتتاحي</span>
              <span className="font-cairo font-extrabold text-lg text-ink" dir="ltr">{formatCurrency(todaysOpen.opening_float)}</span>
            </div>
            <div className="mt-2 text-xs text-primary font-cairo">← متابعة وإغلاق التسوية</div>
          </Link>
        ) : (
          <OpenSessionForm />
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h3 className="font-cairo font-semibold text-muted text-xs mb-2">السجلّ الأخير</h3>
            <ul className="space-y-1.5">
              {history.map((s) => (
                <li key={s.id}>
                  <Link href={`/cash-box/${s.id}`} className="block bg-white border border-border rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between text-xs font-cairo">
                      <span className="text-ink font-semibold">{formatDateShort(new Date(s.session_date))}</span>
                      <span className={s.status === "open" ? "text-warn font-bold" : "text-primary-dk font-bold"}>
                        {s.status === "open" ? "🟠 مفتوح" : "✓ مُغلق"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted font-cairo mt-1">
                      <span>افتتاح: {formatCurrency(s.opening_float)}</span>
                      {s.closing_actual !== null && <span>إغلاق: {formatCurrency(s.closing_actual)}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
