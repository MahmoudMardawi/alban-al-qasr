import { formatCurrency, formatQty, formatRelativeDate, type Unit } from "@/lib/format";

interface ReceiptLine {
  line_type: "sale" | "return_in" | "replacement_out";
  qty: number;
  base_qty: number;
  unit_price: number | null;
  product_name_ar: string;
  product_unit: Unit;
  package_name: string | null;
}

interface ReceiptData {
  visit_id: string;
  visited_at: string;
  client_name: string;
  employee_name: string;
  lines: ReceiptLine[];
}

const SECTION = {
  sale:             { title: "🛒 المبيعات",          border: "border-r-primary",    text: "text-primary" },
  replacement_out:  { title: "🔄 البدل (بدون مقابل)", border: "border-r-primary-dk", text: "text-primary-dk" },
  return_in:        { title: "↩ المرتجع التالف",     border: "border-r-warn",       text: "text-warn" },
} as const;

export function ReceiptCard({ data }: { data: ReceiptData }) {
  const sales         = data.lines.filter((l) => l.line_type === "sale");
  const replacements  = data.lines.filter((l) => l.line_type === "replacement_out");
  const returns       = data.lines.filter((l) => l.line_type === "return_in");
  const total         = sales.reduce((s, l) => s + l.qty * (l.unit_price ?? 0), 0);

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";
  const brandArea = process.env.NEXT_PUBLIC_BRAND_AREA ?? "عرّابة — جنين";

  function Section({ kind, items }: { kind: keyof typeof SECTION; items: ReceiptLine[] }) {
    if (items.length === 0) return null;
    const s = SECTION[kind];
    return (
      <div className="mb-4">
        <h4 className={`font-cairo font-bold text-xs mb-2 ${s.text}`}>{s.title}</h4>
        <ul className="space-y-1.5">
          {items.map((l, i) => (
            <li key={i} className={`bg-white border border-border ${s.border} border-r-4 rounded-lg px-3 py-2 flex items-center justify-between`}>
              <div className="min-w-0">
                <div className="font-cairo text-sm text-ink font-semibold">
                  {l.product_name_ar} · {formatQty(l.base_qty, l.product_unit)}
                </div>
                <div className="text-[10px] text-muted font-cairo mt-0.5">
                  {l.package_name ? `${l.qty} × ${l.package_name}` : "مفرد"}
                </div>
              </div>
              <div className="font-cairo font-bold text-sm shrink-0 ms-2">
                {l.line_type === "sale" ? formatCurrency(l.qty * (l.unit_price ?? 0)) : "بدون مقابل"}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="bg-white max-w-md mx-auto print:max-w-full">
      <div className="bg-gradient-to-b from-forest to-primary-dk text-white p-5 text-center">
        <div className="font-display text-2xl">{brandName}</div>
        <div className="text-xs opacity-80 mt-1">{brandArea}</div>
        <div className="text-[11px] opacity-70 mt-3 font-cairo">إيصال زيارة</div>
      </div>

      <div className="p-4 bg-info-bg border-b border-border">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-cairo">
          <div className="text-muted">الزبون:</div>
          <div className="text-ink font-semibold text-left">{data.client_name}</div>
          <div className="text-muted">التاريخ:</div>
          <div className="text-ink font-semibold text-left">
            {formatRelativeDate(new Date(data.visited_at))} · {new Date(data.visited_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-muted">الموظف:</div>
          <div className="text-ink font-semibold text-left">{data.employee_name}</div>
          <div className="text-muted">رقم الزيارة:</div>
          <div className="text-ink font-mono text-[10px] text-left">{data.visit_id.slice(0, 8)}</div>
        </div>
      </div>

      <div className="p-4">
        <Section kind="sale"            items={sales} />
        <Section kind="replacement_out" items={replacements} />
        <Section kind="return_in"       items={returns} />

        <div className="mt-4 bg-forest text-white rounded-xl p-4 flex items-center justify-between">
          <span className="font-cairo text-sm opacity-90">المبلغ المستحق</span>
          <span className="font-cairo font-extrabold text-2xl">{formatCurrency(total)}</span>
        </div>

        <div className="mt-6 border-t-2 border-dashed border-border pt-4 text-[11px] text-muted font-cairo text-center">
          توقيع المستلم: ____________________
        </div>
      </div>
    </div>
  );
}
