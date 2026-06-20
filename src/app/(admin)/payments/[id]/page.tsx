import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { formatCurrency, formatDateShort, formatInvoiceNo } from "@/lib/format";
import { numberToArabicWords } from "@/lib/number-to-arabic";

export const dynamic = "force-dynamic";

const METHOD_AR: Record<string, string> = {
  cash:     "نقدًا",
  transfer: "تحويل بنكي",
  other:    "أخرى",
};

export default async function PaymentReceiptVoucher({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, paid_at, method, note, visit_id, recorded_by, clients(name, phone), visits(invoice_no), users(full_name)")
    .eq("id", id)
    .single();

  if (!data) return notFound();

  type Row = {
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    note: string | null;
    visit_id: string | null;
    clients: { name: string; phone: string | null } | null;
    visits: { invoice_no: number } | null;
    users: { full_name: string } | null;
  };
  const p = data as unknown as Row;

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";
  const brandArea = process.env.NEXT_PUBLIC_BRAND_AREA ?? "عرّابة — جنين";
  const amountWords = numberToArabicWords(Math.round(Number(p.amount) * 100) / 100);

  // Voucher number — use last 6 chars of UUID for a short reference until a sequential numbering is added.
  const voucherRef = p.id.slice(0, 8).toUpperCase();

  return (
    <div className="pb-4 print:pb-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-md mx-auto print:hidden">
        <Link href="/payments" className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white max-w-md mx-auto print:max-w-full">
        {/* Header */}
        <div className="bg-gradient-to-b from-forest to-primary-dk text-white p-5 text-center flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" aria-hidden="true" className="h-16 w-16 mb-2" />
          <div className="font-display text-2xl">{brandName}</div>
          <div className="text-xs opacity-80 mt-1">{brandArea}</div>
          <div className="mt-3 bg-white/20 px-4 py-1.5 rounded-full">
            <div className="font-cairo font-extrabold text-base">سند قبض</div>
          </div>
          <div className="text-[11px] opacity-80 mt-2 font-cairo" dir="ltr">رقم: {voucherRef}</div>
        </div>

        <div className="p-5 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-cairo">
            <div className="text-muted">التاريخ:</div>
            <div className="text-ink font-semibold text-left" dir="ltr">{formatDateShort(new Date(p.paid_at))}</div>
            <div className="text-muted">طريقة الدفع:</div>
            <div className="text-ink font-semibold text-left">{METHOD_AR[p.method] ?? p.method}</div>
            {p.users && (
              <>
                <div className="text-muted">حُرِّر بواسطة:</div>
                <div className="text-ink font-semibold text-left">{p.users.full_name}</div>
              </>
            )}
            {p.visits?.invoice_no != null && (
              <>
                <div className="text-muted">مرتبط بفاتورة:</div>
                <div className="text-ink font-semibold text-left" dir="ltr">{formatInvoiceNo(p.visits.invoice_no)}</div>
              </>
            )}
          </div>

          {/* Body */}
          <div className="bg-info-bg rounded-xl p-4 space-y-3 border border-border">
            <div className="font-cairo text-sm text-ink leading-loose">
              استلمنا من السيد / المؤسسة:
              <div className="font-bold text-base text-primary-dk mt-1">{p.clients?.name ?? "—"}</div>
              {p.clients?.phone && (
                <div className="text-[11px] text-muted mt-0.5" dir="ltr">{p.clients.phone}</div>
              )}
            </div>

            <div className="font-cairo text-sm text-ink leading-loose">
              مبلغًا وقدره:
              <div className="font-extrabold text-xl text-primary mt-1" dir="ltr">{formatCurrency(Number(p.amount))}</div>
              <div className="text-[11px] text-muted mt-1">فقط {amountWords} لا غير</div>
            </div>

            <div className="font-cairo text-sm text-ink leading-loose">
              وذلك عن:
              <div className="font-semibold text-sm mt-1">{p.note || "تسديد ذمم مستحقة"}</div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-6 grid grid-cols-2 gap-4 text-[11px] text-muted font-cairo print:mt-12">
            <div className="border-t-2 border-dashed border-border pt-3 text-center">
              توقيع المستلِم (المصنع):
              <br />____________________
            </div>
            <div className="border-t-2 border-dashed border-border pt-3 text-center">
              توقيع الدافع (الزبون):
              <br />____________________
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
