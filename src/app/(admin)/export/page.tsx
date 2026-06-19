"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toCsv } from "@/lib/exports/csv";
import { downloadPdf } from "@/lib/exports/pdf";
import { DownloadButton } from "@/components/DownloadButton";
import { formatCurrency, formatDateShort } from "@/lib/format";

type ReportType = "sales" | "expenses" | "production";

const LABELS: Record<ReportType, string> = {
  sales:      "المبيعات (الزيارات)",
  expenses:   "المصاريف",
  production: "الإنتاج والفاقد",
};

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

interface SalesRow   { visit_id: string; date: string; client: string; employee: string; sale_total: number; returns: number; replacements: number }
interface ExpenseRow { date: string; category: string; amount: number; note: string }
interface ProdRow    { date: string; product: string; unit: string; produced: number; wasted: number; note: string }
type AnyRow = SalesRow | ExpenseRow | ProdRow;

export default function ExportCenter() {
  const def = defaultRange();
  const [start, setStart] = useState(def.start);
  const [end, setEnd]     = useState(def.end);
  const [reportType, setReportType] = useState<ReportType>("sales");

  async function fetchRows(): Promise<AnyRow[]> {
    const supabase = createClient();
    const startIso = new Date(start + "T00:00:00").toISOString();
    const endIso   = new Date(end + "T23:59:59.999Z").toISOString();

    if (reportType === "sales") {
      const { data } = await supabase.from("visits")
        .select("id, visited_at, clients(name), users(full_name), visit_lines(qty, unit_price, line_type)")
        .gte("visited_at", startIso).lt("visited_at", endIso).order("visited_at", { ascending: false });
      type R = { id: string; visited_at: string; clients: { name: string } | null; users: { full_name: string } | null; visit_lines: Array<{ qty: number; unit_price: number | null; line_type: string }> };
      return ((data ?? []) as unknown as R[]).map((v) => ({
        visit_id: v.id,
        date:     formatDateShort(new Date(v.visited_at)),
        client:   v.clients?.name ?? "?",
        employee: v.users?.full_name ?? "?",
        sale_total:   v.visit_lines.filter((l) => l.line_type === "sale").reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0),
        returns:      v.visit_lines.filter((l) => l.line_type === "return_in").reduce((s, l) => s + Number(l.qty), 0),
        replacements: v.visit_lines.filter((l) => l.line_type === "replacement_out").reduce((s, l) => s + Number(l.qty), 0),
      }));
    }
    if (reportType === "expenses") {
      const { data } = await supabase.from("expenses")
        .select("id, spent_at, category, amount, note")
        .gte("spent_at", startIso).lt("spent_at", endIso).order("spent_at", { ascending: false });
      type R = { id: string; spent_at: string; category: string; amount: number; note: string | null };
      const LBL: Record<string, string> = { fuel: "وقود", salary: "رواتب", rent: "إيجار", milk: "حليب خام", other: "أخرى" };
      return ((data ?? []) as R[]).map((e) => ({
        date:     formatDateShort(new Date(e.spent_at)),
        category: LBL[e.category] ?? e.category,
        amount:   Number(e.amount),
        note:     e.note ?? "",
      }));
    }
    const { data } = await supabase.from("production")
      .select("id, produced_at, qty_produced, qty_wasted, products(name_ar, base_unit), note")
      .gte("produced_at", startIso).lt("produced_at", endIso).order("produced_at", { ascending: false });
    type R = { id: string; produced_at: string; qty_produced: number; qty_wasted: number; products: { name_ar: string; base_unit: string } | null; note: string | null };
    return ((data ?? []) as unknown as R[]).map((p) => ({
      date:     formatDateShort(new Date(p.produced_at)),
      product:  p.products?.name_ar ?? "?",
      unit:     p.products?.base_unit ?? "",
      produced: Number(p.qty_produced),
      wasted:   Number(p.qty_wasted),
      note:     p.note ?? "",
    }));
  }

  async function downloadCsv() {
    const rows = await fetchRows();
    let csv = "";
    if (reportType === "sales") {
      csv = toCsv(rows as SalesRow[], [
        { key: "date",         header: "التاريخ" },
        { key: "client",       header: "الزبون" },
        { key: "employee",     header: "الموظف" },
        { key: "sale_total",   header: "إجمالي البيع (₪)" },
        { key: "returns",      header: "مرتجع (وحدات)" },
        { key: "replacements", header: "بدل (وحدات)" },
        { key: "visit_id",     header: "رقم الزيارة" },
      ]);
    } else if (reportType === "expenses") {
      csv = toCsv(rows as ExpenseRow[], [
        { key: "date",     header: "التاريخ" },
        { key: "category", header: "التصنيف" },
        { key: "amount",   header: "المبلغ (₪)" },
        { key: "note",     header: "ملاحظة" },
      ]);
    } else {
      csv = toCsv(rows as ProdRow[], [
        { key: "date",     header: "التاريخ" },
        { key: "product",  header: "المنتج" },
        { key: "unit",     header: "الوحدة" },
        { key: "produced", header: "إنتاج" },
        { key: "wasted",   header: "فاقد" },
        { key: "note",     header: "ملاحظة" },
      ]);
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}_${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdfReport() {
    const rows = await fetchRows();
    const title = `${LABELS[reportType]} — ${start} → ${end}`;

    let body: (string | number)[][] = [];
    let headers: string[] = [];
    if (reportType === "sales") {
      headers = ["التاريخ", "الزبون", "الموظف", "إجمالي البيع", "مرتجع", "بدل"];
      body = (rows as SalesRow[]).map((r) => [
        r.date, r.client, r.employee, formatCurrency(r.sale_total), r.returns, r.replacements,
      ]);
    } else if (reportType === "expenses") {
      headers = ["التاريخ", "التصنيف", "المبلغ", "ملاحظة"];
      body = (rows as ExpenseRow[]).map((r) => [r.date, r.category, formatCurrency(r.amount), r.note]);
    } else {
      headers = ["التاريخ", "المنتج", "الوحدة", "إنتاج", "فاقد", "ملاحظة"];
      body = (rows as ProdRow[]).map((r) => [r.date, r.product, r.unit, r.produced, r.wasted, r.note]);
    }

    await downloadPdf({
      content: [
        { text: "ألبان وأجبان القصر", style: "brand", alignment: "center" },
        { text: title,                style: "subtitle", alignment: "center", margin: [0, 4, 0, 12] },
        {
          table: {
            headerRows: 1, widths: Array(headers.length).fill("*"),
            body: [headers.map((h) => ({ text: h, style: "th" })), ...body],
          },
          layout: "lightHorizontalLines",
        },
        { text: `عدد الصفوف: ${rows.length}`, style: "footer", margin: [0, 12, 0, 0] },
      ],
      styles: {
        brand:    { fontSize: 18, bold: true, color: "#1a3d2b" },
        subtitle: { fontSize: 11, color: "#6b7d72" },
        th:       { bold: true, fillColor: "#eef6f0", color: "#1a3d2b" },
        footer:   { fontSize: 9, color: "#6b7d72", alignment: "left" },
      },
      pageMargins: [30, 30, 30, 30],
      defaultStyle: { alignment: "right" },
    }, `${reportType}_${start}_${end}.pdf`);
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-cairo font-bold text-forest text-lg">📤 تصدير التقارير</h2>

      <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">نوع التقرير</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-cairo">
            {(Object.keys(LABELS) as ReportType[]).map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-cairo text-ink mb-1">من</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} dir="ltr"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-cairo" />
          </div>
          <div>
            <label className="block text-xs font-cairo text-ink mb-1">إلى</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} dir="ltr"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-cairo" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DownloadButton label="تحميل CSV"  onClick={downloadCsv} />
        <DownloadButton label="تحميل PDF"  onClick={downloadPdfReport} />
      </div>

      <p className="text-[11px] text-muted font-cairo bg-info-bg/40 rounded-xl p-3">
        💡 CSV يفتح في Excel بمحارف عربية صحيحة (BOM). PDF مع خط Cairo جاهز للطباعة والمشاركة.
      </p>
    </div>
  );
}
