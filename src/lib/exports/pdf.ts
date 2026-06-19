"use client";

/**
 * HTML-based "PDF export" — opens a printable Arabic report in a new tab,
 * auto-launches the browser print dialog. User picks "Save as PDF".
 *
 * Why not pdfmake? pdfmake/pdfkit don't have built-in Arabic shaping — glyphs
 * render unjoined and right-to-left bidi breaks. Browsers handle Arabic
 * correctly out of the box (same Cairo font, full bidi/shaping support).
 */

export interface PrintableReport {
  title: string;              // E.g., "تقرير المبيعات"
  subtitle?: string;          // E.g., "من 2026-05-01 إلى 2026-06-19"
  headers: string[];          // Column labels (Arabic)
  rows: (string | number)[][];// Cell values (currency strings like "50 ₪" allowed)
  totalLine?: string;         // E.g., "إجمالي: 1,245 ₪"
}

function escapeHtml(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(brandName: string, brandArea: string, report: PrintableReport): string {
  const headerRow = report.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyRows = report.rows.map((r) =>
    `<tr>${r.map((c) => `<td><span dir="auto">${escapeHtml(c)}</span></td>`).join("")}</tr>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(report.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Cairo', sans-serif;
    color: #1a2e1a;
    background: #f7faf7;
    direction: rtl;
    padding: 20px;
  }
  .container {
    max-width: 210mm;
    margin: 0 auto;
    background: white;
    padding: 24px;
    box-shadow: 0 4px 16px rgba(26,62,43,0.10);
  }
  .toolbar {
    background: #eef6f0; color: #1a3d2b;
    padding: 10px 14px; border-radius: 8px;
    margin-bottom: 16px;
    font-size: 12px;
    border-right: 4px solid #2d8659;
  }
  .toolbar strong { color: #1a3d2b; }
  .header { text-align: center; border-bottom: 2px solid #d8e7d8; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-family: 'Amiri', serif; font-size: 28px; color: #1a3d2b; line-height: 1.1; }
  .area  { font-size: 12px; color: #6b7d72; margin-top: 4px; }
  .title { font-size: 18px; color: #1a3d2b; margin-top: 14px; font-weight: 700; }
  .subtitle { font-size: 12px; color: #6b7d72; margin-top: 4px; }

  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  thead { background: #eef6f0; }
  th { padding: 10px 12px; font-weight: 700; text-align: right; color: #1a3d2b; border: 1px solid #d8e7d8; }
  td { padding: 8px 12px; text-align: right; border-bottom: 1px solid #f0f5f1; unicode-bidi: isolate; }
  tbody tr:nth-child(even) { background: #fafdfa; }

  .total-line {
    margin-top: 16px;
    background: #1a3d2b; color: white;
    border-radius: 8px; padding: 12px 16px;
    font-size: 14px; font-weight: 700;
    display: flex; justify-content: space-between;
  }
  .footer {
    text-align: center; font-size: 11px; color: #6b7d72;
    margin-top: 22px; border-top: 1px solid #d8e7d8; padding-top: 10px;
  }
  @media print {
    body { background: white; padding: 0; }
    .container { box-shadow: none; padding: 0; max-width: none; }
    .toolbar { display: none; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="toolbar">
    📄 <strong>للحفظ كـ PDF:</strong> اضغط <strong>Ctrl+P</strong> ← اختر <em>"Save as PDF"</em>.
    <br/>💡 في "More settings" قم بإلغاء <em>"Headers and footers"</em> لإزالة التاريخ والرابط من أعلى/أسفل الصفحة.
  </div>
  <div class="header">
    <div class="brand">${escapeHtml(brandName)}</div>
    <div class="area">${escapeHtml(brandArea)}</div>
    <div class="title">${escapeHtml(report.title)}</div>
    ${report.subtitle ? `<div class="subtitle">${escapeHtml(report.subtitle)}</div>` : ""}
  </div>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  ${report.totalLine ? `<div class="total-line"><span>الإجمالي</span><span dir="ltr">${escapeHtml(report.totalLine)}</span></div>` : ""}
  <div class="footer">
    عدد الصفوف: ${report.rows.length} · تم التوليد ${new Date().toLocaleString("en-GB")}
  </div>
</div>
<script>
  // Auto-trigger the print dialog after fonts have loaded.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() { setTimeout(function() { window.print(); }, 300); });
  } else {
    setTimeout(function() { window.print(); }, 1200);
  }
</script>
</body>
</html>`;
}

export function downloadPdf(report: PrintableReport, _filename: string): void {
  void _filename;
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";
  const brandArea = process.env.NEXT_PUBLIC_BRAND_AREA ?? "عرّابة — جنين";

  const html = renderHtml(brandName, brandArea, report);

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("تم حظر النوافذ المنبثقة. اسمح بها لهذا الموقع ثم أعد المحاولة.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
