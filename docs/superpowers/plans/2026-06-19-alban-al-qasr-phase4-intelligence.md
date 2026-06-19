# Alban Al-Qasr — Phase 4: Intelligence (Dashboard / Reports / Inventory / Export) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the raw operational data Phase 1–3 collects into actionable intelligence for Majdi. Real Dashboard with period switcher + hero net-profit + revenue line chart + expense pie + top-clients leaderboard. Reports page with drill-down filters. Inventory (الجرد) page showing opening → production → sales → returns → waste → closing per product per period with prior-period comparison. Export Center generating CSV (Excel/Dahbour-friendly) and PDF (printable, Arabic) on demand. End state: Majdi opens /dashboard, sees this month's net profit at a glance + breakdown + top performers; clicks "تصدير" to download a clean CSV he forwards to Ahmad at Dahbour.

**Architecture:** All new admin pages live in `src/app/(admin)/`. Heavy aggregation in `src/lib/aggregations.ts` (pure functions, TDD) + `src/lib/dashboard-data.ts` (server queries that compose pure helpers). Charts use Recharts (already installed). Period selection driven by `?period=daily|weekly|monthly|yearly` URL search params so server components re-render and links are shareable. CSV generation is pure (`src/lib/exports/csv.ts`) — UTF-8 with BOM so Excel opens Arabic correctly. PDF generation uses pdfmake (already installed) with **Cairo font served from `/public/fonts/`** and fetched into pdfmake's vfs at runtime; client-side generation to avoid server-render cost. AdminMoreSheet's disabled items get re-enabled.

**Tech Stack:** Same as Phase 3. Newly used: `recharts` (charts), `pdfmake` (PDF). No new npm installs.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-06-19-alban-al-qasr-design.md`
- Phase 3 plan: `docs/superpowers/plans/2026-06-19-alban-al-qasr-phase3-admin-world.md`

---

## File Structure (Phase 4 only — new + modified)

```
public/
└── fonts/
    └── Cairo-Variable.ttf               # NEW — one variable font, ~585 KB, covers all weights

src/
├── lib/
│   ├── periods.ts                       # NEW — periodStartEnd, label helpers (TDD)
│   ├── aggregations.ts                  # NEW — pure: bucketByDay, topN, netProfit calc (TDD)
│   ├── dashboard-data.ts                # NEW — server: getDashboardData(period)
│   ├── reports-data.ts                  # NEW — server: getReportsData(filters)
│   ├── inventory-data.ts                # NEW — server: getInventorySnapshot(periodStart, periodEnd)
│   └── exports/
│       ├── csv.ts                       # NEW — toCsv(rows, columns): string (TDD)
│       └── pdf.ts                       # NEW — generatePdf(definition): Promise<Blob>
├── components/
│   ├── PeriodSwitcher.tsx               # NEW — pill nav reads/writes ?period= URL param
│   ├── StatTile.tsx                     # NEW — colored card with label + big number + delta
│   ├── RevenueLineChart.tsx             # NEW — Recharts AreaChart
│   ├── ExpensePieChart.tsx              # NEW — Recharts PieChart
│   ├── TopRanked.tsx                    # NEW — reusable ranked list (clients/products)
│   ├── DateRangePicker.tsx              # NEW — two HTML date inputs in a row
│   └── DownloadButton.tsx               # NEW — async button that triggers download + spinner
├── app/
│   ├── (admin)/
│   │   ├── dashboard/page.tsx           # MODIFY — replace placeholder with real dashboard
│   │   ├── reports/page.tsx             # NEW — filtered visits table
│   │   ├── inventory/page.tsx           # NEW — per-product جرد with period selector + comparison
│   │   └── export/page.tsx              # NEW — picker for report-type + period + format
│   └── api/                             # NEW — none yet; all done via Server Actions / Components
└── components/AdminMoreSheet.tsx        # MODIFY — un-disable Reports/Inventory/Export

tests/
└── lib/
    ├── periods.test.ts                  # NEW
    ├── aggregations.test.ts             # NEW
    └── exports/
        └── csv.test.ts                  # NEW
```

---

## Prerequisites Check

Before Task 1:
- [ ] Phase 3 tagged `v0.3.0-phase3` locally
- [ ] Tests + build clean (52+ passing)
- [ ] Local dev works
- [ ] `recharts` and `pdfmake` already in `package.json` (verified via Phase 1 Task 2)

---

## Task 1: Period helpers (TDD)

**Files:**
- Create: `src/lib/periods.ts`, `tests/lib/periods.test.ts`

Pure functions that turn a `Period` + a reference date into a `[start, end]` interval, plus human labels.

- [ ] **Step 1: Write the failing test**

`tests/lib/periods.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { periodStartEnd, periodLabel, previousPeriod, type Period } from "@/lib/periods";

describe("periodStartEnd", () => {
  const ref = new Date(2026, 5, 19);   // Fri 19 Jun 2026 local

  it("daily returns the calendar day boundaries", () => {
    const { start, end } = periodStartEnd("daily", ref);
    expect(start.toISOString().slice(0,10)).toBe("2026-06-19");
    expect(end.getDate()).toBe(20);   // exclusive end = next day 00:00
  });

  it("weekly returns Sat→next Sat (Levant week starts Saturday)", () => {
    const { start, end } = periodStartEnd("weekly", ref);
    // 19 Jun 2026 is Friday → week starts the prior Saturday (13 Jun)
    expect(start.getDate()).toBe(13);
    expect(end.getDate()).toBe(20);     // exclusive end = next Sat
  });

  it("monthly returns 1st of this month → 1st of next month", () => {
    const { start, end } = periodStartEnd("monthly", ref);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);   // June (0-indexed)
    expect(end.getMonth()).toBe(6);     // July
    expect(end.getDate()).toBe(1);
  });

  it("yearly returns Jan 1 → next Jan 1", () => {
    const { start, end } = periodStartEnd("yearly", ref);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(2026);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
  });
});

describe("previousPeriod", () => {
  const ref = new Date(2026, 5, 19);
  it("daily → previous day", () => {
    const prev = previousPeriod("daily", ref);
    expect(prev.getDate()).toBe(18);
  });
  it("monthly → previous month", () => {
    const prev = previousPeriod("monthly", ref);
    expect(prev.getMonth()).toBe(4);   // May
  });
  it("yearly → previous year", () => {
    const prev = previousPeriod("yearly", ref);
    expect(prev.getFullYear()).toBe(2025);
  });
});

describe("periodLabel", () => {
  it("returns Arabic label for each", () => {
    expect(periodLabel("daily")).toBe("يومي");
    expect(periodLabel("weekly")).toBe("أسبوعي");
    expect(periodLabel("monthly")).toBe("شهري");
    expect(periodLabel("yearly")).toBe("سنوي");
  });
});
```

- [ ] **Step 2: Run — expect RED**

```bash
npm test -- tests/lib/periods.test.ts
```

- [ ] **Step 3: Implement `src/lib/periods.ts`**

```typescript
export type Period = "daily" | "weekly" | "monthly" | "yearly";

export function periodLabel(p: Period): string {
  switch (p) {
    case "daily":   return "يومي";
    case "weekly":  return "أسبوعي";
    case "monthly": return "شهري";
    case "yearly":  return "سنوي";
  }
}

/**
 * Returns inclusive-start, exclusive-end (canonical half-open interval).
 * Week starts Saturday (Levant convention).
 */
export function periodStartEnd(period: Period, ref: Date = new Date()): { start: Date; end: Date } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  if (period === "daily") {
    const start = new Date(y, m, d);
    const end   = new Date(y, m, d + 1);
    return { start, end };
  }
  if (period === "weekly") {
    // JS getDay(): Sun=0 ... Sat=6 ; Levant week starts Saturday so offset from Sat
    const dow = ref.getDay();                    // Fri=5
    const daysSinceSat = (dow + 1) % 7;          // Sat→0, Sun→1, ..., Fri→6
    const start = new Date(y, m, d - daysSinceSat);
    const end   = new Date(y, m, d - daysSinceSat + 7);
    return { start, end };
  }
  if (period === "monthly") {
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 1);
    return { start, end };
  }
  // yearly
  const start = new Date(y, 0, 1);
  const end   = new Date(y + 1, 0, 1);
  return { start, end };
}

/**
 * Returns a Date that, when fed to periodStartEnd with the same period,
 * yields the immediately preceding period.
 */
export function previousPeriod(period: Period, ref: Date = new Date()): Date {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  switch (period) {
    case "daily":   return new Date(y, m, d - 1);
    case "weekly":  return new Date(y, m, d - 7);
    case "monthly": return new Date(y, m - 1, d);
    case "yearly":  return new Date(y - 1, m, d);
  }
}
```

- [ ] **Step 4: Run — expect GREEN**

```bash
npm test -- tests/lib/periods.test.ts
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/periods.ts tests/lib/periods.test.ts
git commit -m "feat(periods): period boundaries + Arabic labels + previousPeriod (TDD)"
```

---

## Task 2: Aggregation helpers (TDD)

**Files:**
- Create: `src/lib/aggregations.ts`, `tests/lib/aggregations.test.ts`

Pure aggregation functions used by dashboard/reports/inventory data layers. Operate on already-fetched arrays so they're trivially testable.

- [ ] **Step 1: Write the failing test**

`tests/lib/aggregations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { bucketByDay, sumBy, topN, calcNetProfit } from "@/lib/aggregations";

describe("bucketByDay", () => {
  it("buckets timestamped values into per-day totals", () => {
    const rows = [
      { day: new Date(2026, 5, 19), amount: 50 },
      { day: new Date(2026, 5, 19), amount: 30 },
      { day: new Date(2026, 5, 20), amount: 20 },
    ];
    const out = bucketByDay(rows, (r) => r.day, (r) => r.amount);
    expect(out).toEqual([
      { date: "2026-06-19", value: 80 },
      { date: "2026-06-20", value: 20 },
    ]);
  });
  it("returns empty for no rows", () => {
    expect(bucketByDay([], (r: { day: Date }) => r.day, () => 1)).toEqual([]);
  });
});

describe("sumBy", () => {
  it("sums via accessor", () => {
    expect(sumBy([{ x: 1 }, { x: 2 }, { x: 3 }], (r) => r.x)).toBe(6);
  });
  it("skips null/undefined", () => {
    expect(sumBy([{ x: 1 }, { x: null }, { x: undefined }, { x: 4 }] as Array<{ x: number | null | undefined }>, (r) => r.x ?? 0)).toBe(5);
  });
});

describe("topN", () => {
  it("returns top N by value descending", () => {
    const rows = [
      { name: "A", v: 10 }, { name: "B", v: 30 }, { name: "C", v: 20 }, { name: "D", v: 5 },
    ];
    expect(topN(rows, (r) => r.v, 2)).toEqual([
      { name: "B", v: 30 }, { name: "C", v: 20 },
    ]);
  });
});

describe("calcNetProfit", () => {
  it("revenue − (expenses + waste cost)", () => {
    expect(calcNetProfit({ revenue: 1000, expenses: 300, wasteCost: 50 })).toBe(650);
  });
  it("handles zero expenses", () => {
    expect(calcNetProfit({ revenue: 100, expenses: 0, wasteCost: 0 })).toBe(100);
  });
  it("can go negative", () => {
    expect(calcNetProfit({ revenue: 100, expenses: 200, wasteCost: 0 })).toBe(-100);
  });
});
```

- [ ] **Step 2: Run — RED.**

```bash
npm test -- tests/lib/aggregations.test.ts
```

- [ ] **Step 3: Implement `src/lib/aggregations.ts`**

```typescript
export function bucketByDay<T>(
  rows: T[],
  getDate: (r: T) => Date,
  getValue: (r: T) => number,
): Array<{ date: string; value: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = getDate(r);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + getValue(r));
  }
  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function sumBy<T>(rows: T[], getValue: (r: T) => number): number {
  return rows.reduce((s, r) => s + (getValue(r) ?? 0), 0);
}

export function topN<T>(rows: T[], getValue: (r: T) => number, n: number): T[] {
  return [...rows]
    .sort((a, b) => getValue(b) - getValue(a))
    .slice(0, n);
}

export function calcNetProfit(args: { revenue: number; expenses: number; wasteCost: number }): number {
  return args.revenue - (args.expenses + args.wasteCost);
}
```

- [ ] **Step 4: Run — GREEN.**

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aggregations.ts tests/lib/aggregations.test.ts
git commit -m "feat(aggregations): bucketByDay, sumBy, topN, calcNetProfit (TDD)"
```

---

## Task 3: Dashboard data loader (server-side)

**Files:**
- Create: `src/lib/dashboard-data.ts`

Composes periods + aggregations to produce the dashboard payload. Server-only (uses Supabase server client + RLS).

- [ ] **Step 1: Implement**

```typescript
import { createClient } from "@/lib/supabase/server";
import { periodStartEnd, previousPeriod, type Period } from "@/lib/periods";
import { bucketByDay, sumBy, topN, calcNetProfit } from "@/lib/aggregations";

export interface DashboardData {
  period: Period;
  windowStart: Date;
  windowEnd: Date;
  hero: { netProfit: number; deltaPct: number | null };
  stats: {
    sales: number; salesDeltaPct: number | null;
    expenses: number; expensesDeltaPct: number | null;
    wasteUnits: number;
    returnsUnits: number;
  };
  revenueByDay: Array<{ date: string; value: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  topClients:  Array<{ id: string; name: string; revenue: number }>;
  topProducts: Array<{ id: string; name_ar: string; revenue: number }>;
}

async function periodRevenue(supabase: Awaited<ReturnType<typeof createClient>>, start: Date, end: Date) {
  const { data } = await supabase
    .from("visits")
    .select("visited_at, client_id, visit_lines(line_type, qty, unit_price, product_id, products(name_ar))")
    .gte("visited_at", start.toISOString())
    .lt("visited_at",  end.toISOString());
  return (data ?? []) as Array<{
    visited_at: string; client_id: string;
    visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null }>;
  }>;
}

export async function getDashboardData(period: Period, ref: Date = new Date()): Promise<DashboardData> {
  const supabase = await createClient();
  const { start, end } = periodStartEnd(period, ref);
  const prevEnd = start;
  const { start: prevStart } = periodStartEnd(period, previousPeriod(period, ref));

  const [visits, prevVisits, expenses, prevExpenses, production, clientsList] = await Promise.all([
    periodRevenue(supabase, start, end),
    periodRevenue(supabase, prevStart, prevEnd),
    supabase.from("expenses").select("amount, category, spent_at").gte("spent_at", start.toISOString()).lt("spent_at", end.toISOString()),
    supabase.from("expenses").select("amount").gte("spent_at", prevStart.toISOString()).lt("spent_at", prevEnd.toISOString()),
    supabase.from("production").select("qty_wasted, product_id, products(base_cost)").gte("produced_at", start.toISOString()).lt("produced_at", end.toISOString()),
    supabase.from("clients").select("id, name").is("merged_into_client_id", null),
  ]);

  const clientNameMap = new Map<string, string>(((clientsList.data ?? []) as Array<{id:string;name:string}>).map((c) => [c.id, c.name]));

  // Sales
  const saleLinesNow  = visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "sale"));
  const saleLinesPrev = prevVisits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "sale"));
  const salesNow  = sumBy(saleLinesNow,  (l) => Number(l.qty) * Number(l.unit_price ?? 0));
  const salesPrev = sumBy(saleLinesPrev, (l) => Number(l.qty) * Number(l.unit_price ?? 0));
  const salesDelta = salesPrev > 0 ? Math.round(((salesNow - salesPrev) / salesPrev) * 100) : null;

  // Expenses
  const expRows  = (expenses.data ?? []) as Array<{ amount: number; category: string }>;
  const expRowsP = (prevExpenses.data ?? []) as Array<{ amount: number }>;
  const expensesNow  = sumBy(expRows,  (e) => Number(e.amount));
  const expensesPrev = sumBy(expRowsP, (e) => Number(e.amount));
  const expensesDelta = expensesPrev > 0 ? Math.round(((expensesNow - expensesPrev) / expensesPrev) * 100) : null;

  // Waste (units + cost)
  const prodRows = (production.data ?? []) as Array<{ qty_wasted: number; product_id: string; products: { base_cost: number | null } | null }>;
  const wasteUnits = sumBy(prodRows, (p) => Number(p.qty_wasted));
  const wasteCost  = sumBy(prodRows, (p) => Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0));

  // Returns count (units, all return_in lines this period)
  const returnsUnits = sumBy(
    visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "return_in")),
    (l) => Number(l.qty),
  );

  // Net profit
  const netProfit  = calcNetProfit({ revenue: salesNow,  expenses: expensesNow,  wasteCost });
  const netProfitP = calcNetProfit({ revenue: salesPrev, expenses: expensesPrev, wasteCost: 0 });
  const profitDelta = netProfitP !== 0 ? Math.round(((netProfit - netProfitP) / Math.abs(netProfitP)) * 100) : null;

  // Revenue by day
  const revenueByDay = bucketByDay(
    saleLinesNow.flatMap((l, i) => {
      const v = visits.find((vv) => vv.visit_lines.includes(l))!;
      return [{ day: new Date(v.visited_at), amount: Number(l.qty) * Number(l.unit_price ?? 0) }];
    }),
    (r) => r.day, (r) => r.amount,
  );

  // Expense pie
  const expCats = new Map<string, number>();
  for (const e of expRows) expCats.set(e.category, (expCats.get(e.category) ?? 0) + Number(e.amount));
  const expensesByCategory = Array.from(expCats.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Top clients
  const clientRevMap = new Map<string, number>();
  for (const v of visits) {
    const total = sumBy(v.visit_lines.filter((l) => l.line_type === "sale"), (l) => Number(l.qty) * Number(l.unit_price ?? 0));
    clientRevMap.set(v.client_id, (clientRevMap.get(v.client_id) ?? 0) + total);
  }
  const topClients = topN(
    Array.from(clientRevMap.entries()).map(([id, revenue]) => ({ id, name: clientNameMap.get(id) ?? "?", revenue })),
    (r) => r.revenue, 5,
  );

  // Top products
  const productRevMap = new Map<string, { name: string; revenue: number }>();
  for (const l of saleLinesNow) {
    const cur = productRevMap.get(l.product_id) ?? { name: l.products?.name_ar ?? "?", revenue: 0 };
    cur.revenue += Number(l.qty) * Number(l.unit_price ?? 0);
    productRevMap.set(l.product_id, cur);
  }
  const topProducts = topN(
    Array.from(productRevMap.entries()).map(([id, v]) => ({ id, name_ar: v.name, revenue: v.revenue })),
    (r) => r.revenue, 5,
  );

  return {
    period, windowStart: start, windowEnd: end,
    hero: { netProfit, deltaPct: profitDelta },
    stats: { sales: salesNow, salesDeltaPct: salesDelta, expenses: expensesNow, expensesDeltaPct: expensesDelta, wasteUnits, returnsUnits },
    revenueByDay, expensesByCategory, topClients, topProducts,
  };
}
```

- [ ] **Step 2: TS compile + commit**

```bash
npx tsc --noEmit
git add src/lib/dashboard-data.ts
git commit -m "feat(dashboard): server-side data loader composing periods + aggregations"
```

---

## Task 4: Period switcher + reusable chart components

**Files:**
- Create: `src/components/PeriodSwitcher.tsx`, `src/components/StatTile.tsx`, `src/components/RevenueLineChart.tsx`, `src/components/ExpensePieChart.tsx`, `src/components/TopRanked.tsx`

- [ ] **Step 1: Create `src/components/PeriodSwitcher.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { type Period } from "@/lib/periods";

const PERIODS: { v: Period; label: string }[] = [
  { v: "daily",   label: "يومي" },
  { v: "weekly",  label: "أسبوعي" },
  { v: "monthly", label: "شهري" },
  { v: "yearly",  label: "سنوي" },
];

export function PeriodSwitcher({ current }: { current: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function pick(p: Period) {
    const params = new URLSearchParams(sp.toString());
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-4 gap-1 px-4 py-2">
      {PERIODS.map(({ v, label }) => {
        const active = current === v;
        return (
          <button
            key={v}
            onClick={() => pick(v)}
            className={`font-cairo text-xs font-semibold py-2 rounded-lg transition-colors ${
              active ? "bg-primary text-white" : "bg-white border border-border text-muted"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/StatTile.tsx`**

```tsx
import { formatCurrency } from "@/lib/format";

interface Props {
  label: string;
  value: string | number;
  formatAsCurrency?: boolean;
  deltaPct?: number | null;
  hero?: boolean;
  emoji?: string;
}

export function StatTile({ label, value, formatAsCurrency, deltaPct, hero, emoji }: Props) {
  const display =
    typeof value === "number" && formatAsCurrency ? formatCurrency(value) : String(value);

  const deltaText =
    deltaPct === null || deltaPct === undefined
      ? null
      : deltaPct > 0
        ? `▲ ${deltaPct}%`
        : deltaPct < 0
          ? `▼ ${Math.abs(deltaPct)}%`
          : "—";
  const deltaColor =
    deltaPct === null || deltaPct === undefined
      ? "text-muted"
      : deltaPct > 0 ? "text-primary" : deltaPct < 0 ? "text-warn" : "text-muted";

  return (
    <div className={`rounded-2xl p-3 ${hero ? "bg-gradient-to-br from-forest to-primary-dk text-white col-span-2" : "bg-white border border-border"}`}>
      <div className={`text-[10px] font-cairo ${hero ? "text-white/80" : "text-muted"}`}>
        {emoji} {label}
      </div>
      <div className={`font-cairo font-extrabold mt-1 ${hero ? "text-2xl" : "text-xl text-ink"}`}>{display}</div>
      {deltaText && (
        <div className={`text-[10px] font-cairo mt-1 ${hero ? "text-white/80" : deltaColor}`}>{deltaText} مقارنة بالفترة السابقة</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/RevenueLineChart.tsx`**

```tsx
"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: Array<{ date: string; value: number }>;
}

export function RevenueLineChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-center text-muted text-xs py-6 font-cairo">لا توجد مبيعات في هذه الفترة</p>;
  }
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2d8659" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2d8659" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7d72" }} tickFormatter={(d) => String(d).slice(-2)} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid #d8e7d8", borderRadius: 8, fontFamily: "Cairo, sans-serif", fontSize: 12 }}
            formatter={(v: number) => [formatCurrency(v), "الإيراد"]}
            labelFormatter={(l) => `يوم ${l}`}
          />
          <Area type="monotone" dataKey="value" stroke="#2d8659" strokeWidth={2} fill="url(#grad-rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/ExpensePieChart.tsx`**

```tsx
"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#2d8659", "#c96f2c", "#d4a55a", "#1f6943", "#6b7d72"];
const LABELS: Record<string, string> = { fuel: "وقود", salary: "رواتب", rent: "إيجار", milk: "حليب خام", other: "أخرى" };

interface Props {
  data: Array<{ category: string; amount: number }>;
}

export function ExpensePieChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-center text-muted text-xs py-6 font-cairo">لا توجد مصاريف في هذه الفترة</p>;
  }
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-24 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" innerRadius={26} outerRadius={42} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #d8e7d8", borderRadius: 8, fontFamily: "Cairo, sans-serif", fontSize: 11 }}
              formatter={(v: number, name: string) => [formatCurrency(v), LABELS[name] ?? name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 text-[11px] font-cairo">
        {data.map((d, i) => (
          <li key={d.category} className="flex items-center justify-between mb-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {LABELS[d.category] ?? d.category}
            </span>
            <strong className="text-ink">{formatCurrency(d.amount)}</strong>
          </li>
        ))}
        <li className="flex items-center justify-between mt-1 pt-1 border-t border-border">
          <span className="text-muted">الإجمالي</span>
          <strong className="text-forest">{formatCurrency(total)}</strong>
        </li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/TopRanked.tsx`**

```tsx
import { formatCurrency } from "@/lib/format";

interface Item { id: string; label: string; value: number }

interface Props {
  items: Item[];
  emptyText?: string;
}

export function TopRanked({ items, emptyText = "لا توجد بيانات" }: Props) {
  if (items.length === 0) {
    return <p className="text-center text-muted text-xs py-4 font-cairo">{emptyText}</p>;
  }
  return (
    <ul className="bg-white border border-border rounded-xl divide-y divide-border">
      {items.map((it, idx) => (
        <li key={it.id} className="flex items-center justify-between px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-info-bg text-primary-dk text-[10px] font-cairo font-bold flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="font-cairo text-sm text-ink">{it.label}</span>
          </span>
          <span className="font-cairo font-bold text-primary text-sm">{formatCurrency(it.value)}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: TS compile + commit**

```bash
npx tsc --noEmit
git add src/components/PeriodSwitcher.tsx src/components/StatTile.tsx src/components/RevenueLineChart.tsx src/components/ExpensePieChart.tsx src/components/TopRanked.tsx
git commit -m "feat(dashboard): period switcher + stat tile + chart components + ranked list"
```

---

## Task 5: Dashboard page wiring

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Replace `src/app/(admin)/dashboard/page.tsx`**

```tsx
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { StatTile } from "@/components/StatTile";
import { RevenueLineChart } from "@/components/RevenueLineChart";
import { ExpensePieChart } from "@/components/ExpensePieChart";
import { TopRanked } from "@/components/TopRanked";
import { getDashboardData } from "@/lib/dashboard-data";
import { type Period } from "@/lib/periods";
import { formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = VALID_PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "monthly";
  const data = await getDashboardData(period);

  return (
    <div className="pb-4">
      <PeriodSwitcher current={period} />

      <div className="px-4 grid grid-cols-2 gap-2">
        <StatTile hero label="صافي الربح" value={data.hero.netProfit} formatAsCurrency deltaPct={data.hero.deltaPct} emoji="💰" />
        <StatTile label="المبيعات" value={data.stats.sales} formatAsCurrency deltaPct={data.stats.salesDeltaPct} emoji="📈" />
        <StatTile label="المصاريف" value={data.stats.expenses} formatAsCurrency deltaPct={data.stats.expensesDeltaPct} emoji="💸" />
        <StatTile label="الفاقد" value={formatQty(data.stats.wasteUnits, "L")} emoji="🗑️" />
        <StatTile label="المرتجعات" value={formatQty(data.stats.returnsUnits, "L")} emoji="↩️" />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">📈 المبيعات اليومية</h3>
      <div className="mx-4 bg-white border border-border rounded-xl p-3">
        <RevenueLineChart data={data.revenueByDay} />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">💸 توزيع المصاريف</h3>
      <div className="mx-4 bg-white border border-border rounded-xl p-3">
        <ExpensePieChart data={data.expensesByCategory} />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">🏆 أفضل الزبائن</h3>
      <div className="mx-4">
        <TopRanked items={data.topClients.map((c) => ({ id: c.id, label: c.name, value: c.revenue }))} emptyText="لا توجد مبيعات في هذه الفترة" />
      </div>

      <h3 className="font-cairo font-bold text-ink text-sm mt-4 mb-2 px-4">📦 أفضل المنتجات</h3>
      <div className="mx-4">
        <TopRanked items={data.topProducts.map((p) => ({ id: p.id, label: p.name_ar, value: p.revenue }))} emptyText="لا توجد مبيعات في هذه الفترة" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

Log in as Majdi → /dashboard → see period switcher (Monthly active) + hero net profit + 4 stat tiles + line chart (with the visits you created in Phase 2) + expense pie + top clients/products lists. Tap each period — URL changes + data refreshes.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx"
git commit -m "feat(dashboard): real dashboard with period switcher + charts + leaderboards"
```

---

## Task 6: Reports page (drill-down)

**Files:**
- Create: `src/components/DateRangePicker.tsx`, `src/lib/reports-data.ts`, `src/app/(admin)/reports/page.tsx`

- [ ] **Step 1: Create `src/lib/reports-data.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export interface ReportFilters {
  start: string; end: string;             // ISO date strings
  clientId?: string | null;
  productId?: string | null;
  employeeId?: string | null;
}

export interface ReportRow {
  visit_id: string;
  visited_at: string;
  client_id: string;
  client_name: string;
  employee_name: string;
  sale_total: number;
  return_units: number;
  replacement_units: number;
  line_count: number;
}

export async function getReportRows(filters: ReportFilters): Promise<ReportRow[]> {
  const supabase = await createClient();
  let q = supabase.from("visits")
    .select("id, visited_at, client_id, employee_id, clients(name), users(full_name), visit_lines(qty, unit_price, line_type, product_id)")
    .gte("visited_at", new Date(filters.start + "T00:00:00").toISOString())
    .lt("visited_at",  new Date(filters.end   + "T23:59:59.999Z").toISOString())
    .order("visited_at", { ascending: false });

  if (filters.clientId)   q = q.eq("client_id",   filters.clientId);
  if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);

  const { data } = await q;
  type Row = {
    id: string; visited_at: string; client_id: string;
    clients: { name: string } | null; users: { full_name: string } | null;
    visit_lines: Array<{ qty: number; unit_price: number | null; line_type: string; product_id: string }>;
  };
  const rows = (data ?? []) as unknown as Row[];

  return rows
    .map((v) => {
      const lines = filters.productId ? v.visit_lines.filter((l) => l.product_id === filters.productId) : v.visit_lines;
      return {
        visit_id:           v.id,
        visited_at:         v.visited_at,
        client_id:          v.client_id,
        client_name:        v.clients?.name ?? "?",
        employee_name:      v.users?.full_name ?? "?",
        sale_total:         lines.filter((l) => l.line_type === "sale").reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0),
        return_units:       lines.filter((l) => l.line_type === "return_in").reduce((s, l) => s + Number(l.qty), 0),
        replacement_units:  lines.filter((l) => l.line_type === "replacement_out").reduce((s, l) => s + Number(l.qty), 0),
        line_count:         lines.length,
      };
    })
    .filter((r) => r.line_count > 0);
}
```

- [ ] **Step 2: Create `src/components/DateRangePicker.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props { start: string; end: string }

export function DateRangePicker({ start, end }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set(name, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-4 py-2">
      <label className="block">
        <span className="block text-[11px] text-muted font-cairo mb-1">من</span>
        <input type="date" value={start} onChange={(e) => setParam("start", e.target.value)} dir="ltr"
          className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo focus:outline-none focus:ring-1 focus:ring-primary" />
      </label>
      <label className="block">
        <span className="block text-[11px] text-muted font-cairo mb-1">إلى</span>
        <input type="date" value={end} onChange={(e) => setParam("end", e.target.value)} dir="ltr"
          className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo focus:outline-none focus:ring-1 focus:ring-primary" />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(admin)/reports/page.tsx`**

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DateRangePicker } from "@/components/DateRangePicker";
import { getReportRows } from "@/lib/reports-data";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const def = defaultRange();
  const start      = sp.start      || def.start;
  const end        = sp.end        || def.end;
  const clientId   = sp.client     || null;
  const productId  = sp.product    || null;
  const employeeId = sp.employee   || null;

  const supabase = await createClient();
  const [clientsRes, productsRes, employeesRes, rows] = await Promise.all([
    supabase.from("clients").select("id, name").is("merged_into_client_id", null).order("name"),
    supabase.from("products").select("id, name_ar").order("name_ar"),
    supabase.from("users").select("id, full_name, role").eq("role", "employee").order("full_name"),
    getReportRows({ start, end, clientId, productId, employeeId }),
  ]);

  const totalSales       = rows.reduce((s, r) => s + r.sale_total, 0);
  const totalReturns     = rows.reduce((s, r) => s + r.return_units, 0);
  const totalReplaces    = rows.reduce((s, r) => s + r.replacement_units, 0);

  function FilterSelect({ name, value, options, placeholder }: { name: string; value: string | null; options: Array<{id:string;label:string}>; placeholder: string }) {
    return (
      <select name={name} defaultValue={value ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }

  // Build a "filter form" using GET so URL params drive everything
  return (
    <div className="pb-4">
      <h2 className="font-cairo font-bold text-ink text-base px-4 py-3">📊 التقارير</h2>
      <DateRangePicker start={start} end={end} />

      <form method="get" className="px-4 py-2 grid grid-cols-3 gap-2">
        <input type="hidden" name="start" value={start} />
        <input type="hidden" name="end"   value={end} />
        <FilterSelect name="client"   value={clientId}   options={(clientsRes.data ?? []).map((c) => ({ id: c.id, label: c.name }))} placeholder="كل الزبائن" />
        <FilterSelect name="product"  value={productId}  options={(productsRes.data ?? []).map((p) => ({ id: p.id, label: p.name_ar }))} placeholder="كل المنتجات" />
        <FilterSelect name="employee" value={employeeId} options={(employeesRes.data ?? []).map((u) => ({ id: u.id, label: u.full_name }))} placeholder="كل الموظفين" />
        <button type="submit" className="col-span-3 bg-primary text-white text-xs font-cairo font-semibold py-2 rounded-lg">تطبيق الفلاتر</button>
      </form>

      <div className="grid grid-cols-3 gap-2 px-4 mt-2">
        <div className="bg-info-bg rounded-xl p-2 text-center">
          <div className="text-[10px] text-muted font-cairo">إجمالي المبيعات</div>
          <div className="font-cairo font-bold text-primary text-sm mt-0.5">{formatCurrency(totalSales)}</div>
        </div>
        <div className="bg-info-bg rounded-xl p-2 text-center">
          <div className="text-[10px] text-muted font-cairo">مرتجع (وحدات)</div>
          <div className="font-cairo font-bold text-warn text-sm mt-0.5">{totalReturns}</div>
        </div>
        <div className="bg-info-bg rounded-xl p-2 text-center">
          <div className="text-[10px] text-muted font-cairo">بدل (وحدات)</div>
          <div className="font-cairo font-bold text-primary-dk text-sm mt-0.5">{totalReplaces}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="لا توجد بيانات في هذه الفترة" subtitle="جرّب توسيع المدى أو إزالة الفلاتر" />
      ) : (
        <ul className="px-3 mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.visit_id}>
              <Link href={`/visit/${r.visit_id}`} className="block bg-white border border-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-cairo font-semibold text-ink text-sm">{r.client_name}</div>
                    <div className="text-[10px] text-muted font-cairo mt-0.5">{formatDateShort(new Date(r.visited_at))} · {r.employee_name} · {r.line_count} عنصر</div>
                  </div>
                  <div className="font-cairo font-bold text-primary text-sm">{formatCurrency(r.sale_total)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

/reports renders with default-current-month filters, dropdowns work, list of visits with totals, clicking a row goes to receipt.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports-data.ts src/components/DateRangePicker.tsx "src/app/(admin)/reports"
git commit -m "feat(reports): drill-down visits report with client/product/employee + date range"
```

---

## Task 7: Inventory (الجرد) page

**Files:**
- Create: `src/lib/inventory-data.ts`, `src/app/(admin)/inventory/page.tsx`

- [ ] **Step 1: Create `src/lib/inventory-data.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { periodStartEnd, previousPeriod, type Period } from "@/lib/periods";
import { sumBy } from "@/lib/aggregations";

export interface ProductInventoryRow {
  product_id: string;
  name_ar: string;
  base_unit: "L" | "kg" | "piece";
  opening:   number;
  produced:  number;
  sold:      number;
  returned:  number;
  replaced:  number;
  wasted:    number;
  closing:   number;
}

export interface InventorySnapshot {
  period: Period;
  windowStart: Date;
  windowEnd: Date;
  rows: ProductInventoryRow[];
  prev: Map<string, ProductInventoryRow>;   // prior-period rows keyed by product_id
}

// "opening" = sum of (produced − sold − returned + replaced − wasted) for all activity BEFORE windowStart.
// "closing" = opening + produced − sold − returned + replaced − wasted within the window.
// (Returned reduces stock — those units came BACK to factory from the shop; they're added to "waste" tally typically,
// but for inventory purposes we treat them as physical inflow that immediately becomes waste unless cleaned. For simplicity v1,
// returned units are tracked separately and do NOT add to closing stock — Majdi can decide later.)
async function productActivity(supabase: Awaited<ReturnType<typeof createClient>>, productId: string, before: Date) {
  const [prodRes, linesRes] = await Promise.all([
    supabase.from("production").select("qty_produced, qty_wasted").eq("product_id", productId).lt("produced_at", before.toISOString()),
    supabase.from("visit_lines").select("qty, base_qty, line_type, visits(visited_at)").eq("product_id", productId),
  ]);
  const prod = (prodRes.data ?? []) as Array<{ qty_produced: number; qty_wasted: number }>;
  type LL = { qty: number; base_qty: number; line_type: string; visits: { visited_at: string } | null };
  const lines = ((linesRes.data ?? []) as unknown as LL[])
    .filter((l) => l.visits && new Date(l.visits.visited_at) < before);

  const produced = sumBy(prod, (p) => Number(p.qty_produced));
  const wasted   = sumBy(prod, (p) => Number(p.qty_wasted));
  const sold     = sumBy(lines.filter((l) => l.line_type === "sale"),            (l) => Number(l.base_qty));
  const returned = sumBy(lines.filter((l) => l.line_type === "return_in"),       (l) => Number(l.base_qty));
  const replaced = sumBy(lines.filter((l) => l.line_type === "replacement_out"), (l) => Number(l.base_qty));

  return { produced, wasted, sold, returned, replaced };
}

async function buildRow(supabase: Awaited<ReturnType<typeof createClient>>, product: { id: string; name_ar: string; base_unit: "L"|"kg"|"piece" }, windowStart: Date, windowEnd: Date): Promise<ProductInventoryRow> {
  // opening = cumulative activity before window
  const openingAct = await productActivity(supabase, product.id, windowStart);
  const opening = openingAct.produced - openingAct.sold - openingAct.replaced - openingAct.wasted;

  // within-window activity
  const [prodRes, linesRes] = await Promise.all([
    supabase.from("production").select("qty_produced, qty_wasted").eq("product_id", product.id)
      .gte("produced_at", windowStart.toISOString()).lt("produced_at", windowEnd.toISOString()),
    supabase.from("visit_lines").select("qty, base_qty, line_type, visits(visited_at)").eq("product_id", product.id),
  ]);
  const prod = (prodRes.data ?? []) as Array<{ qty_produced: number; qty_wasted: number }>;
  type LL = { qty: number; base_qty: number; line_type: string; visits: { visited_at: string } | null };
  const lines = ((linesRes.data ?? []) as unknown as LL[])
    .filter((l) => l.visits && new Date(l.visits.visited_at) >= windowStart && new Date(l.visits.visited_at) < windowEnd);

  const produced = sumBy(prod, (p) => Number(p.qty_produced));
  const wasted   = sumBy(prod, (p) => Number(p.qty_wasted));
  const sold     = sumBy(lines.filter((l) => l.line_type === "sale"),            (l) => Number(l.base_qty));
  const returned = sumBy(lines.filter((l) => l.line_type === "return_in"),       (l) => Number(l.base_qty));
  const replaced = sumBy(lines.filter((l) => l.line_type === "replacement_out"), (l) => Number(l.base_qty));

  const closing = opening + produced - sold - replaced - wasted;

  return {
    product_id: product.id, name_ar: product.name_ar, base_unit: product.base_unit,
    opening, produced, sold, returned, replaced, wasted, closing,
  };
}

export async function getInventorySnapshot(period: Period, ref: Date = new Date()): Promise<InventorySnapshot> {
  const supabase = await createClient();
  const { start, end } = periodStartEnd(period, ref);
  const { start: prevStart, end: prevEnd } = periodStartEnd(period, previousPeriod(period, ref));

  const { data: productsData } = await supabase.from("products").select("id, name_ar, base_unit").eq("is_active", true).order("name_ar");
  const products = (productsData ?? []) as Array<{ id: string; name_ar: string; base_unit: "L"|"kg"|"piece" }>;

  const rows     = await Promise.all(products.map((p) => buildRow(supabase, p, start, end)));
  const prevRows = await Promise.all(products.map((p) => buildRow(supabase, p, prevStart, prevEnd)));
  const prevMap  = new Map<string, ProductInventoryRow>(prevRows.map((r) => [r.product_id, r]));

  return { period, windowStart: start, windowEnd: end, rows, prev: prevMap };
}
```

- [ ] **Step 2: Create `src/app/(admin)/inventory/page.tsx`**

```tsx
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { getInventorySnapshot } from "@/lib/inventory-data";
import { formatQty } from "@/lib/format";
import { type Period } from "@/lib/periods";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

const VALID: Period[] = ["weekly", "monthly", "yearly"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = VALID.includes(sp.period as Period) ? (sp.period as Period) : "monthly";
  const snap = await getInventorySnapshot(period);

  if (snap.rows.length === 0) {
    return (
      <div>
        <PeriodSwitcher current={period} />
        <EmptyState icon={ClipboardList} title="لا توجد منتجات" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <PeriodSwitcher current={period} />
      <h2 className="font-cairo font-bold text-forest text-base px-4 py-2">📋 الجرد ({snap.rows.length} منتج)</h2>

      <ul className="px-3 space-y-2">
        {snap.rows.map((r) => {
          const prev = snap.prev.get(r.product_id);
          const closingDelta = prev ? r.closing - prev.closing : null;
          return (
            <li key={r.product_id} className="bg-white border border-border rounded-xl p-3">
              <h3 className="font-cairo font-bold text-ink text-sm mb-2">{r.name_ar}</h3>
              <table className="w-full text-[11px] font-cairo">
                <tbody>
                  <tr><td className="text-muted py-0.5">رصيد الافتتاح</td><td className="text-left text-ink font-semibold">{formatQty(r.opening, r.base_unit)}</td></tr>
                  <tr><td className="text-primary py-0.5">+ إنتاج</td><td className="text-left text-primary font-semibold">{formatQty(r.produced, r.base_unit)}</td></tr>
                  <tr><td className="text-warn py-0.5">− مبيعات</td><td className="text-left text-warn font-semibold">{formatQty(r.sold, r.base_unit)}</td></tr>
                  <tr><td className="text-primary-dk py-0.5">− بدل (مجاناً)</td><td className="text-left text-primary-dk font-semibold">{formatQty(r.replaced, r.base_unit)}</td></tr>
                  <tr><td className="text-warn py-0.5">− فاقد</td><td className="text-left text-warn font-semibold">{formatQty(r.wasted, r.base_unit)}</td></tr>
                  <tr><td className="text-muted py-0.5">↩️ مرتجع (مرجَع للمصنع)</td><td className="text-left text-muted font-semibold">{formatQty(r.returned, r.base_unit)}</td></tr>
                  <tr className="border-t border-border"><td className="text-forest py-1.5 font-bold">رصيد الإقفال</td><td className="text-left text-forest font-extrabold text-sm">{formatQty(r.closing, r.base_unit)}</td></tr>
                </tbody>
              </table>
              {closingDelta !== null && (
                <p className="text-[10px] font-cairo mt-2 text-muted">
                  مقارنة بالفترة السابقة: <strong className={closingDelta >= 0 ? "text-primary" : "text-warn"}>{closingDelta >= 0 ? "+" : ""}{formatQty(closingDelta, r.base_unit)}</strong>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

/inventory renders snapshot for monthly, switches to weekly/yearly via PeriodSwitcher, each product shows opening/produced/sold/replaced/wasted/returned/closing with comparison.

- [ ] **Step 4: Commit**

```bash
git add src/lib/inventory-data.ts "src/app/(admin)/inventory"
git commit -m "feat(inventory): الجرد per-product per-period snapshot with prior-period comparison"
```

---

## Task 8: CSV export utility (TDD)

**Files:**
- Create: `src/lib/exports/csv.ts`, `tests/lib/exports/csv.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/exports/csv";

describe("toCsv", () => {
  it("renders headers + rows separated by CRLF", () => {
    const out = toCsv([{ a: 1, b: "x" }], [{ key: "a", header: "A" }, { key: "b", header: "B" }]);
    expect(out).toBe("﻿A,B\r\n1,x\r\n");
  });
  it("escapes commas and quotes", () => {
    const out = toCsv([{ a: 'has, comma', b: 'has "quote"' }], [{ key: "a", header: "A" }, { key: "b", header: "B" }]);
    expect(out).toContain('"has, comma","has ""quote"""');
  });
  it("handles Arabic content", () => {
    const out = toCsv([{ name: "لبن", v: 5 }], [{ key: "name", header: "الاسم" }, { key: "v", header: "القيمة" }]);
    expect(out).toContain("الاسم,القيمة");
    expect(out).toContain("لبن,5");
  });
  it("emits BOM at start for Excel UTF-8 recognition", () => {
    const out = toCsv([], [{ key: "x", header: "X" }]);
    expect(out.charCodeAt(0)).toBe(0xFEFF);
  });
  it("handles null/undefined as empty", () => {
    const out = toCsv([{ a: null, b: undefined }] as Array<{ a: null | string; b: undefined | string }>, [{ key: "a", header: "A" }, { key: "b", header: "B" }]);
    expect(out).toContain(",\r\n");
  });
});
```

- [ ] **Step 2: RED.**

- [ ] **Step 3: Implement `src/lib/exports/csv.ts`**

```typescript
export interface CsvColumn<T> {
  key: keyof T & string;
  header: string;
  /** Optional transformer applied to cell value before stringification */
  format?: (v: unknown, row: T) => string | number | null | undefined;
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => {
      const raw = (r as Record<string, unknown>)[c.key];
      const formatted = c.format ? c.format(raw, r) : raw;
      return escapeCell(formatted);
    }).join(","),
  );
  return "﻿" + [header, ...lines].join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: GREEN.**

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exports/csv.ts tests/lib/exports/csv.test.ts
git commit -m "feat(exports): CSV serializer with UTF-8 BOM, escaping, Arabic support (TDD)"
```

---

## Task 9: PDF export utility (pdfmake + Cairo)

**Files:**
- Download: `public/fonts/Cairo-Variable.ttf` (one variable-weight TTF)
- Create: `src/lib/exports/pdf.ts`

Google removed the `static/` subdir from their fonts repo — only the variable font remains. One file covers all weights (pdfmake renders without weight-axis variation, but Arabic glyphs render correctly).

- [ ] **Step 1: Download Cairo (if not already there)**

```bash
cd "F:/Projects/Cloned/08_OtherProjects/alban-al-qasr/public/fonts"
curl -fsSL -o Cairo-Variable.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf"
ls -la Cairo-Variable.ttf   # should show ~585 KB
```

Notes:
- PowerShell's `Invoke-WebRequest` sometimes errors with "connection closed unexpectedly" on GitHub — use Git Bash `curl` (above) instead.
- Variable TTF has all weights in one file; pdfmake treats it as a single style. For receipts/reports this is fine — Arabic renders correctly, bold won't visually differ but the layout works.

- [ ] **Step 2: Implement `src/lib/exports/pdf.ts`**

```typescript
"use client";   // pdfmake must run client-side (uses fonts via fetch)

import pdfMake from "pdfmake/build/pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

let fontsReady = false;

async function ensureFonts(): Promise<void> {
  if (fontsReady) return;

  async function fetchAsBase64(url: string): Promise<string> {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  const cairo = await fetchAsBase64("/fonts/Cairo-Variable.ttf");

  // Inject into pdfmake's virtual filesystem
  type PMLike = { vfs?: Record<string, string>; fonts?: Record<string, { normal?: string; bold?: string; italics?: string; bolditalics?: string }> };
  const pm = pdfMake as unknown as PMLike;
  pm.vfs = pm.vfs ?? {};
  pm.vfs["Cairo-Variable.ttf"] = cairo;
  // Variable font: same file for all 4 slots. Bold/italic axes won't visually differ
  // but Arabic shaping works correctly — sufficient for v1 receipts/reports.
  pm.fonts = {
    Cairo: {
      normal:      "Cairo-Variable.ttf",
      bold:        "Cairo-Variable.ttf",
      italics:     "Cairo-Variable.ttf",
      bolditalics: "Cairo-Variable.ttf",
    },
  };

  fontsReady = true;
}

/**
 * Build a pdfmake document and trigger download in browser.
 * Title becomes the suggested filename (sans .pdf).
 */
export async function downloadPdf(definition: TDocumentDefinitions, filename: string): Promise<void> {
  await ensureFonts();
  const fullDef: TDocumentDefinitions = {
    ...definition,
    defaultStyle: { font: "Cairo", fontSize: 10, ...(definition.defaultStyle ?? {}) },
  };
  pdfMake.createPdf(fullDef).download(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
```

- [ ] **Step 3: TS compile + commit**

```bash
npx tsc --noEmit
git add public/fonts/ src/lib/exports/pdf.ts
git commit -m "feat(exports): pdfmake wrapper with Cairo font (Arabic-capable PDFs)"
```

---

## Task 10: Export Center page

**Files:**
- Create: `src/app/(admin)/export/page.tsx`, `src/components/DownloadButton.tsx`

- [ ] **Step 1: Create `src/components/DownloadButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface Props {
  label: string;
  onClick: () => Promise<void>;
}

export function DownloadButton({ label, onClick }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function go() {
    setErr(null); setBusy(true);
    try { await onClick(); }
    catch (e) { setErr(e instanceof Error ? e.message : "تعذّر التصدير"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <button onClick={go} disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60">
        <Download size={16} /> {busy ? "جارٍ التحضير..." : label}
      </button>
      {err && <p className="text-danger text-[11px] mt-1.5 font-cairo">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(admin)/export/page.tsx`**

```tsx
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

export default function ExportCenter() {
  const def = defaultRange();
  const [start, setStart] = useState(def.start);
  const [end, setEnd]     = useState(def.end);
  const [reportType, setReportType] = useState<ReportType>("sales");

  async function fetchRows() {
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
        sale_total: v.visit_lines.filter((l) => l.line_type === "sale").reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0),
        returns:    v.visit_lines.filter((l) => l.line_type === "return_in").reduce((s, l) => s + Number(l.qty), 0),
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
        date: formatDateShort(new Date(e.spent_at)),
        category: LBL[e.category] ?? e.category,
        amount:   Number(e.amount),
        note:     e.note ?? "",
      }));
    }
    // production
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
      csv = toCsv(rows, [
        { key: "date",         header: "التاريخ" },
        { key: "client",       header: "الزبون" },
        { key: "employee",     header: "الموظف" },
        { key: "sale_total",   header: "إجمالي البيع (₪)" },
        { key: "returns",      header: "مرتجع (وحدات)" },
        { key: "replacements", header: "بدل (وحدات)" },
        { key: "visit_id",     header: "رقم الزيارة" },
      ] as never);
    } else if (reportType === "expenses") {
      csv = toCsv(rows, [
        { key: "date",     header: "التاريخ" },
        { key: "category", header: "التصنيف" },
        { key: "amount",   header: "المبلغ (₪)" },
        { key: "note",     header: "ملاحظة" },
      ] as never);
    } else {
      csv = toCsv(rows, [
        { key: "date",     header: "التاريخ" },
        { key: "product",  header: "المنتج" },
        { key: "unit",     header: "الوحدة" },
        { key: "produced", header: "إنتاج" },
        { key: "wasted",   header: "فاقد" },
        { key: "note",     header: "ملاحظة" },
      ] as never);
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
      body = rows.map((r) => [
        (r as { date: string }).date, (r as { client: string }).client, (r as { employee: string }).employee,
        formatCurrency((r as { sale_total: number }).sale_total),
        (r as { returns: number }).returns, (r as { replacements: number }).replacements,
      ]);
    } else if (reportType === "expenses") {
      headers = ["التاريخ", "التصنيف", "المبلغ", "ملاحظة"];
      body = rows.map((r) => [(r as { date: string }).date, (r as { category: string }).category, formatCurrency((r as { amount: number }).amount), (r as { note: string }).note]);
    } else {
      headers = ["التاريخ", "المنتج", "الوحدة", "إنتاج", "فاقد", "ملاحظة"];
      body = rows.map((r) => [(r as { date: string }).date, (r as { product: string }).product, (r as { unit: string }).unit, (r as { produced: number }).produced, (r as { wasted: number }).wasted, (r as { note: string }).note]);
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
```

- [ ] **Step 3: Smoke test**

/export renders. Pick "المبيعات" + a month range → "تحميل CSV" downloads `sales_YYYY-MM-DD_YYYY-MM-DD.csv`. Open in Excel — Arabic columns + cells render correctly (BOM did its job). "تحميل PDF" downloads a PDF with Cairo Arabic text.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/export" src/components/DownloadButton.tsx
git commit -m "feat(exports): Export Center — CSV + PDF for sales/expenses/production"
```

---

## Task 11: Re-enable More-sheet items + remove "قريباً" tags

**Files:**
- Modify: `src/components/AdminMoreSheet.tsx`

- [ ] **Step 1: Remove `disabled: true` from Reports/Inventory/Export entries**

In `src/components/AdminMoreSheet.tsx`, change the ITEMS array so Reports/Inventory/Export entries no longer have `disabled: true` and the label drops the "(قريباً)" suffix:

```typescript
const ITEMS: MoreItem[] = [
  { href: "/expenses",   label: "المصاريف",                icon: Receipt },
  { href: "/production", label: "الإنتاج والفاقد",          icon: Factory },
  { href: "/users",      label: "الموظفين",                 icon: UserCog },
  { href: "/reports",    label: "التقارير",                 icon: BarChart3 },
  { href: "/inventory",  label: "الجرد",                    icon: ClipboardList },
  { href: "/export",     label: "تصدير",                    icon: Download },
  { href: "/ai",         label: "اسأل بياناتك (قريباً)",      icon: Sparkles,      disabled: true },
  { href: "/activity",   label: "الإشعارات (قريباً)",         icon: Bell,          disabled: true },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AdminMoreSheet.tsx
git commit -m "feat(admin): un-disable Reports/Inventory/Export in More sheet"
```

---

## Task 12: Full E2E + tag v0.4.0-phase4

- [ ] **Step 1: Tests + build**

```bash
cd "F:/Projects/Cloned/08_OtherProjects/alban-al-qasr"
npm test
npm run build
```

Both must pass. Expect ~70+ tests (Phase 3's 52 + ~20 new from periods/aggregations/csv).

- [ ] **Step 2: Manual E2E (local)**

Log in as Majdi:

1. ✅ /dashboard renders period switcher (monthly active by default) + hero net profit + 4 stat tiles + revenue chart + expense pie + top clients/products. Tap weekly/yearly — data refreshes.
2. ✅ "المزيد" → "التقارير" → date range picker + filter dropdowns + visits table. Apply a client filter → list shrinks. Tap a row → goes to receipt.
3. ✅ "المزيد" → "الجرد" → list of products with opening/produced/sold/replaced/wasted/returned/closing + comparison to prior period.
4. ✅ "المزيد" → "تصدير" → pick "المبيعات" + custom range → "تحميل CSV" → CSV opens cleanly in Excel with Arabic + numbers. Then "تحميل PDF" → Arabic PDF downloads + opens.
5. ✅ Same for expenses + production exports.

- [ ] **Step 3: Tag**

```bash
git tag -a v0.4.0-phase4 -m "Phase 4: Intelligence — dashboard charts, drill-down reports, الجرد inventory, CSV/PDF export"
```

(No push — held per project agreement.)

---

## Phase 4 Acceptance Checklist

- [ ] All tests pass (Phase 1-3's 52 + Phase 4's new ~20 = ~72)
- [ ] `npm run build` clean
- [ ] /dashboard, /reports, /inventory, /export all render and work locally
- [ ] CSV opens in Excel with Arabic text correctly displayed
- [ ] PDF generates with Cairo Arabic font
- [ ] AdminMoreSheet shows Reports/Inventory/Export as enabled
- [ ] No `Co-Authored-By` / 🤖 in commits
- [ ] Tag `v0.4.0-phase4` created locally

After acceptance, plan Phase 5 (Gemini AI assistant + activity log feed + notification bell).
