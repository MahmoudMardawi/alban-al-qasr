# Alban Al-Qasr — Phase 2: Core Employee Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the employee placeholder home with the actual delivery flow — a clients list with live two-ledger badges, a client detail screen, a New Visit screen with the 3-button magic (Sale / Return / Replacement), a quick-add client form, and a printable receipt. End state: Ahmad logs in, sees his clients with money+replacement balances, taps "+ New Visit", picks a client, adds sale/return/replacement lines (each with product + optional package + qty), confirms, and lands on a clean Arabic receipt that prints/shares cleanly. All transactions hit the live Postgres with RLS-enforced isolation, plus an activity_log row for Majdi's future notification bell.

**Architecture:** All routes under `src/app/(employee)/`. Server Components fetch data from Supabase using `@/lib/supabase/server`; mutations go through Server Actions (`'use server'`). The New Visit page is a Client Component holding local state for the in-progress line items, submitted atomically via a Server Action that inserts a `visits` row + N `visit_lines` rows + 1 `activity_log` row in a single transaction. Pure-logic helpers (currency formatting, base_qty calculation, line totals) live in `src/lib/ledgers.ts` and are TDD'd before any UI code. No new tables — schema from Phase 1 covers everything.

**Tech Stack:** Same as Phase 1. New libs touched: `lucide-react` (icons), `clsx` for conditional classes. No new npm installs needed.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-06-19-alban-al-qasr-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-06-19-alban-al-qasr-phase1-foundation.md`

---

## File Structure (Phase 2 only — new + modified)

```
src/
├── lib/
│   ├── ledgers.ts                       # NEW — pure helpers: format currency, format qty, calc base_qty, total of lines
│   ├── activity-log.ts                  # NEW — logActivity(supabase, payload)
│   └── format.ts                        # NEW — formatCurrency, formatQty, formatRelativeDate
├── app/
│   ├── (employee)/
│   │   ├── layout.tsx                   # NEW — wraps (employee) routes with BrandHeader + BottomNav
│   │   ├── page.tsx                     # MODIFY — replace placeholder with real clients list
│   │   ├── client/
│   │   │   ├── new/page.tsx             # NEW — quick-add client form (employee)
│   │   │   ├── new/actions.ts           # NEW — Server Action: insertPendingClient
│   │   │   └── [id]/page.tsx            # NEW — client detail (balances + recent visits + "+ New Visit" CTA)
│   │   ├── visit/
│   │   │   ├── new/page.tsx             # NEW — Client Component: 3-button screen, line items state, confirm
│   │   │   ├── new/actions.ts           # NEW — Server Action: createVisitWithLines
│   │   │   └── [id]/page.tsx            # NEW — receipt (Server Component, read-only)
│   │   ├── my-visits/page.tsx           # NEW — list of own visits, newest first
│   │   └── profile/page.tsx             # NEW — minimal: email + logout button
└── components/
    ├── BottomNav.tsx                    # NEW — 3-tab employee nav: الزبائن · زياراتي · حسابي
    ├── ClientCard.tsx                   # NEW — used in clients list
    ├── BalanceBadges.tsx                # NEW — "💰 يدين لك" + "🥛 تدين له" pills
    ├── ProductPackagePicker.tsx         # NEW — modal: pick product → pick unit/package → qty
    ├── VisitLineRow.tsx                 # NEW — one line in the visit editor (color-coded by type)
    └── ReceiptCard.tsx                  # NEW — receipt display (used by /visit/[id]/page.tsx)

tests/
├── lib/
│   ├── ledgers.test.ts                  # NEW
│   ├── format.test.ts                   # NEW
│   └── activity-log.test.ts             # NEW
```

---

## Prerequisites Check

Before Task 1:
- [ ] Phase 1 tagged `v0.1.0-phase1` (done — verified by `git tag`)
- [ ] Live URL https://alban-al-gasr.netlify.app works (auth + role routing)
- [ ] Supabase has the seed data (2 users, 3 products, 1 package, 2 clients)

---

## Task 1: Pure formatting helpers (TDD)

**Files:**
- Create: `src/lib/format.ts`, `tests/lib/format.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatCurrency, formatQty, formatRelativeDate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats integer ILS with currency suffix", () => {
    expect(formatCurrency(85)).toBe("85 ₪");
  });
  it("formats decimals to 2 places", () => {
    expect(formatCurrency(85.5)).toBe("85.50 ₪");
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("0 ₪");
  });
  it("formats negative as is", () => {
    expect(formatCurrency(-15.5)).toBe("-15.50 ₪");
  });
});

describe("formatQty", () => {
  it("formats liters", () => {
    expect(formatQty(10, "L")).toBe("10 لتر");
  });
  it("formats kg", () => {
    expect(formatQty(2.5, "kg")).toBe("2.5 كيلو");
  });
  it("formats piece (singular)", () => {
    expect(formatQty(1, "piece")).toBe("1 قطعة");
  });
  it("formats piece (plural)", () => {
    expect(formatQty(5, "piece")).toBe("5 قطع");
  });
});

describe("formatRelativeDate", () => {
  it("returns 'اليوم' for today", () => {
    expect(formatRelativeDate(new Date(), new Date())).toBe("اليوم");
  });
  it("returns 'أمس' for yesterday", () => {
    const today = new Date("2026-06-19T12:00:00Z");
    const yesterday = new Date("2026-06-18T12:00:00Z");
    expect(formatRelativeDate(yesterday, today)).toBe("أمس");
  });
  it("returns days-ago for older dates within 7 days", () => {
    const today = new Date("2026-06-19T12:00:00Z");
    const fiveDaysAgo = new Date("2026-06-14T12:00:00Z");
    expect(formatRelativeDate(fiveDaysAgo, today)).toBe("منذ 5 أيام");
  });
  it("returns ISO date for older dates", () => {
    const today = new Date("2026-06-19T12:00:00Z");
    const monthAgo = new Date("2026-05-19T12:00:00Z");
    expect(formatRelativeDate(monthAgo, today)).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

- [ ] **Step 2: Run test — verify RED**

```bash
npm test -- tests/lib/format.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/format.ts`**

```typescript
export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded} ₪`;
  return `${rounded.toFixed(2)} ₪`;
}

export type Unit = "L" | "kg" | "piece";

export function formatQty(qty: number, unit: Unit): string {
  if (unit === "L")   return `${qty} لتر`;
  if (unit === "kg")  return `${qty} كيلو`;
  // piece: arabic plural depends on count
  return qty === 1 ? `${qty} قطعة` : `${qty} قطع`;
}

export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday    = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const startOfThatDay  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / msPerDay);

  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays > 1 && diffDays <= 7) return `منذ ${diffDays} أيام`;
  return startOfThatDay.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test — verify GREEN**

```bash
npm test -- tests/lib/format.test.ts
```

Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/lib/format.test.ts
git commit -m "feat(format): currency, qty, relative-date helpers + tests"
```

---

## Task 2: Ledger math helpers (TDD)

**Files:**
- Create: `src/lib/ledgers.ts`, `tests/lib/ledgers.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/ledgers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calcBaseQty, calcLineSubtotal, calcVisitTotal } from "@/lib/ledgers";
import type { DraftLine } from "@/lib/ledgers";

describe("calcBaseQty", () => {
  it("returns qty when no package", () => {
    expect(calcBaseQty(7, null)).toBe(7);
  });
  it("multiplies qty × contains_qty when package", () => {
    expect(calcBaseQty(2, { contains_qty: 24 })).toBe(48);
  });
});

describe("calcLineSubtotal", () => {
  it("returns qty * unit_price for sale", () => {
    expect(calcLineSubtotal({ line_type: "sale", qty: 7, unit_price: 5 } as DraftLine)).toBe(35);
  });
  it("returns 0 for replacement_out (free)", () => {
    expect(calcLineSubtotal({ line_type: "replacement_out", qty: 3, unit_price: null } as DraftLine)).toBe(0);
  });
  it("returns 0 for return_in (no money impact)", () => {
    expect(calcLineSubtotal({ line_type: "return_in", qty: 3, unit_price: null } as DraftLine)).toBe(0);
  });
});

describe("calcVisitTotal", () => {
  it("sums sale lines only", () => {
    const lines: DraftLine[] = [
      { line_type: "sale",             qty: 7, unit_price: 5,  product_id: "p1", package_id: null, base_qty: 7 },
      { line_type: "sale",             qty: 2, unit_price: 18, product_id: "p2", package_id: null, base_qty: 2 },
      { line_type: "replacement_out",  qty: 3, unit_price: null, product_id: "p1", package_id: null, base_qty: 3 },
      { line_type: "return_in",        qty: 1, unit_price: null, product_id: "p2", package_id: null, base_qty: 1 },
    ];
    expect(calcVisitTotal(lines)).toBe(35 + 36);
  });
  it("returns 0 for empty list", () => {
    expect(calcVisitTotal([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — verify RED**

```bash
npm test -- tests/lib/ledgers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/ledgers.ts`**

```typescript
export type LineType = "sale" | "replacement_out" | "return_in";

export interface DraftLine {
  product_id: string;
  package_id: string | null;
  qty: number;
  base_qty: number;
  unit_price: number | null;
  line_type: LineType;
  note?: string;
}

export function calcBaseQty(qty: number, pkg: { contains_qty: number } | null): number {
  return pkg ? qty * pkg.contains_qty : qty;
}

export function calcLineSubtotal(line: Pick<DraftLine, "line_type" | "qty" | "unit_price">): number {
  if (line.line_type !== "sale") return 0;
  return line.qty * (line.unit_price ?? 0);
}

export function calcVisitTotal(lines: DraftLine[]): number {
  return lines.reduce((sum, l) => sum + calcLineSubtotal(l), 0);
}
```

- [ ] **Step 4: Run test — verify GREEN**

```bash
npm test -- tests/lib/ledgers.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ledgers.ts tests/lib/ledgers.test.ts
git commit -m "feat(ledgers): pure draft-visit math helpers + tests"
```

---

## Task 3: Activity log helper (with test)

**Files:**
- Create: `src/lib/activity-log.ts`, `tests/lib/activity-log.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/activity-log.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logActivity } from "@/lib/activity-log";

describe("logActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts an activity_log row with the given payload", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    await logActivity(supabase as any, {
      actor_id: "u1",
      action: "visit_created",
      entity_type: "visit",
      entity_id: "v1",
      summary_ar: "أحمد سجّل زيارة جديدة لـ سوبر ماركت الأخوة",
      payload: { lines_count: 3 },
    });

    expect(supabase.from).toHaveBeenCalledWith("activity_log");
    expect(insert).toHaveBeenCalledWith({
      actor_id: "u1",
      action: "visit_created",
      entity_type: "visit",
      entity_id: "v1",
      summary_ar: "أحمد سجّل زيارة جديدة لـ سوبر ماركت الأخوة",
      payload: { lines_count: 3 },
    });
  });

  it("does NOT throw if insert returns an error (best-effort logging)", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "RLS" } });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    // best-effort: should resolve, not throw
    await expect(
      logActivity(supabase as any, {
        actor_id: "u1",
        action: "visit_created",
        entity_type: "visit",
        entity_id: null,
        summary_ar: "x",
        payload: null,
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — verify RED**

```bash
npm test -- tests/lib/activity-log.test.ts
```

- [ ] **Step 3: Implement `src/lib/activity-log.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityAction =
  | "visit_created"
  | "visit_edited"
  | "client_added"
  | "client_approved"
  | "clients_merged"
  | "expense_added"
  | "payment_recorded";

export interface ActivityPayload {
  actor_id: string;
  action: ActivityAction | string;
  entity_type: string | null;
  entity_id: string | null;
  summary_ar: string;
  payload: Record<string, unknown> | null;
}

/**
 * Best-effort activity logger. Never throws — a failed log row must not
 * tank the user's main action (creating a visit, etc.).
 */
export async function logActivity(supabase: SupabaseClient, p: ActivityPayload): Promise<void> {
  try {
    const { error } = await supabase.from("activity_log").insert({
      actor_id:     p.actor_id,
      action:       p.action,
      entity_type:  p.entity_type,
      entity_id:    p.entity_id,
      summary_ar:   p.summary_ar,
      payload:      p.payload,
    });
    if (error) {
      console.warn("[activity_log] insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[activity_log] threw:", e);
  }
}
```

- [ ] **Step 4: Run test — verify GREEN**

```bash
npm test -- tests/lib/activity-log.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity-log.ts tests/lib/activity-log.test.ts
git commit -m "feat(activity): best-effort logger + tests"
```

---

## Task 4: Bottom nav + employee layout

**Files:**
- Create: `src/components/BottomNav.tsx`, `src/app/(employee)/layout.tsx`
- Modify: `src/app/(employee)/page.tsx` (remove old BrandHeader call now that layout owns it)

- [ ] **Step 1: Create `src/components/BottomNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, User } from "lucide-react";

const items = [
  { href: "/",          label: "الزبائن",   icon: Home },
  { href: "/my-visits", label: "زياراتي",   icon: ClipboardList },
  { href: "/profile",   label: "حسابي",    icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-40">
      <ul className="flex justify-around items-center max-w-md mx-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 px-4 py-1 text-[11px] font-cairo font-semibold ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/app/(employee)/layout.tsx`**

```tsx
import { getCurrentUserWithRole } from "@/lib/auth";
import { BrandHeader } from "@/components/BrandHeader";
import { BottomNav } from "@/components/BottomNav";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserWithRole();
  return (
    <div className="min-h-screen pb-20">
      <BrandHeader subtitle={`مرحباً ${user?.full_name ?? ""} · موظف توزيع`} />
      <main className="max-w-md mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Trim `src/app/(employee)/page.tsx`**

(Layout owns the BrandHeader now — the page should only render its own content.)

```tsx
export default function EmployeeHome() {
  return (
    <div className="p-6 text-center text-muted">
      <p className="text-sm">قائمة الزبائن قيد التحميل... (Task 5 يستبدل هذا)</p>
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

```bash
cd "F:/Projects/Cloned/08_OtherProjects/alban-al-qasr"
npm run dev
```

After ~12 sec, manually visit `http://localhost:3000` (or the port Next picks) — log in as `emp@alqasr.test`. You should see:
- Top brand header with "مرحباً موظف التوزيع · موظف توزيع"
- Bottom nav with 3 icons (Home / Clipboard / User), Home active
- Center: the placeholder text

Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomNav.tsx src/app/(employee)/layout.tsx src/app/(employee)/page.tsx
git commit -m "feat(employee): shared layout with brand header + bottom nav"
```

---

## Task 5: Real Clients list page (employee home)

**Files:**
- Create: `src/components/BalanceBadges.tsx`, `src/components/ClientCard.tsx`
- Modify: `src/app/(employee)/page.tsx`

- [ ] **Step 1: Create `src/components/BalanceBadges.tsx`**

```tsx
import { formatCurrency, formatQty, type Unit } from "@/lib/format";

export interface BalanceData {
  money_owed: number;         // > 0 = client owes us; < 0 = we credit them; 0 = settled
  replacements: Array<{ product_name_ar: string; unit: Unit; owed_base_qty: number }>;
}

export function BalanceBadges({ data }: { data: BalanceData }) {
  const owesMoney = data.money_owed > 0;
  const hasReplacements = data.replacements.length > 0;
  const settled = !owesMoney && !hasReplacements;

  return (
    <div className="flex gap-1.5 flex-wrap">
      {settled && (
        <span className="text-[10px] font-cairo font-semibold px-2 py-1 rounded-md bg-info-bg text-primary border border-border">
          ✓ مسوّى
        </span>
      )}
      {owesMoney && (
        <span className="text-[10px] font-cairo font-semibold px-2 py-1 rounded-md bg-orange-50 text-warn border border-orange-200">
          💰 {formatCurrency(data.money_owed)}
        </span>
      )}
      {data.replacements.map((r) => (
        <span
          key={r.product_name_ar}
          className="text-[10px] font-cairo font-semibold px-2 py-1 rounded-md bg-info-bg text-primary-dk border border-border"
        >
          🥛 {formatQty(r.owed_base_qty, r.unit)} {r.product_name_ar}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ClientCard.tsx`**

```tsx
import Link from "next/link";
import { BalanceBadges, type BalanceData } from "./BalanceBadges";

export interface ClientCardData {
  id: string;
  name: string;
  type: "supermarket" | "market" | "individual" | null;
  balance: BalanceData;
  is_approved: boolean;
}

export function ClientCard({ client }: { client: ClientCardData }) {
  const initial = (client.name?.[0] ?? "؟").trim();
  return (
    <Link
      href={`/client/${client.id}`}
      className="flex items-center gap-3 bg-white border border-border rounded-2xl p-3 mb-2 shadow-sm hover:bg-info-bg/40 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-info-bg text-primary-dk flex items-center justify-center font-cairo font-bold text-base shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-cairo font-semibold text-ink text-sm truncate">{client.name}</h3>
          {!client.is_approved && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200 font-cairo">
              بانتظار الموافقة
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <BalanceBadges data={client.balance} />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Implement the home page**

`src/app/(employee)/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { ClientCard, type ClientCardData } from "@/components/ClientCard";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  name: string;
  type: "supermarket" | "market" | "individual" | null;
  is_approved: boolean;
}

interface MoneyRow { client_id: string; balance: number }
interface ReplRow  { client_id: string; product_id: string; owed_base_qty: number }
interface ProductRow { id: string; name_ar: string; base_unit: "L" | "kg" | "piece" }

async function loadClientsWithBalances(): Promise<ClientCardData[]> {
  const supabase = await createClient();

  const [clientsRes, moneyRes, replRes, productsRes] = await Promise.all([
    supabase.from("clients")
      .select("id, name, type, is_approved")
      .is("merged_into_client_id", null)
      .order("name"),
    supabase.from("v_client_money_balance").select("*"),
    supabase.from("v_client_replacement_debt").select("*"),
    supabase.from("products").select("id, name_ar, base_unit"),
  ]);

  const clients = (clientsRes.data ?? []) as ClientRow[];
  const moneyMap = new Map<string, number>(
    ((moneyRes.data ?? []) as MoneyRow[]).map((r) => [r.client_id, Number(r.balance)]),
  );
  const products = new Map<string, ProductRow>(
    ((productsRes.data ?? []) as ProductRow[]).map((p) => [p.id, p]),
  );
  const replByClient = new Map<string, ReplRow[]>();
  for (const r of ((replRes.data ?? []) as ReplRow[])) {
    const list = replByClient.get(r.client_id) ?? [];
    list.push(r);
    replByClient.set(r.client_id, list);
  }

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    is_approved: c.is_approved,
    balance: {
      money_owed: moneyMap.get(c.id) ?? 0,
      replacements: (replByClient.get(c.id) ?? [])
        .map((r) => {
          const p = products.get(r.product_id);
          if (!p) return null;
          return { product_name_ar: p.name_ar, unit: p.base_unit, owed_base_qty: Number(r.owed_base_qty) };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    },
  }));
}

export default async function EmployeeHome() {
  const clients = await loadClientsWithBalances();

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الزبائن ({clients.length})</h2>
        <Link
          href="/client/new"
          className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border"
        >
          <Plus size={14} /> زبون جديد
        </Link>
      </div>
      <div className="px-3">
        {clients.length === 0 ? (
          <p className="text-center text-muted text-sm py-12">لا يوجد زبائن بعد</p>
        ) : (
          clients.map((c) => <ClientCard key={c.id} client={c} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Log in as `emp@alqasr.test`. You should see "الزبائن (2)" header + "+ زبون جديد" link + two cards (سوبر ماركت الأخوة, بقالة النور) — both with "✓ مسوّى" badge (no transactions yet). Click a card — should 404 for now (Task 6 builds /client/[id]). Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/components/BalanceBadges.tsx src/components/ClientCard.tsx src/app/(employee)/page.tsx
git commit -m "feat(clients): real clients list with two-ledger badges"
```

---

## Task 6: Client detail page

**Files:**
- Create: `src/app/(employee)/client/[id]/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { BalanceBadges, type BalanceData } from "@/components/BalanceBadges";
import { formatCurrency, formatRelativeDate, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

interface VisitRow {
  id: string;
  visited_at: string;
  visit_lines: { qty: number; unit_price: number | null; line_type: string }[];
}

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [clientRes, moneyRes, replRes, productsRes, visitsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("v_client_money_balance").select("balance").eq("client_id", id).maybeSingle(),
    supabase.from("v_client_replacement_debt").select("product_id, owed_base_qty").eq("client_id", id),
    supabase.from("products").select("id, name_ar, base_unit"),
    supabase.from("visits")
      .select("id, visited_at, visit_lines(qty, unit_price, line_type)")
      .eq("client_id", id)
      .order("visited_at", { ascending: false })
      .limit(20),
  ]);

  if (clientRes.error || !clientRes.data) return notFound();
  const client = clientRes.data;

  const productsById = new Map(
    ((productsRes.data ?? []) as { id: string; name_ar: string; base_unit: Unit }[]).map((p) => [p.id, p]),
  );

  const balance: BalanceData = {
    money_owed: Number(moneyRes.data?.balance ?? 0),
    replacements: ((replRes.data ?? []) as { product_id: string; owed_base_qty: number }[])
      .map((r) => {
        const p = productsById.get(r.product_id);
        if (!p) return null;
        return { product_name_ar: p.name_ar, unit: p.base_unit, owed_base_qty: Number(r.owed_base_qty) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };

  const visits = (visitsRes.data ?? []) as VisitRow[];

  return (
    <div className="pb-6">
      <div className="bg-gradient-to-b from-info-bg to-white p-4 border-b border-border">
        <h2 className="font-cairo font-bold text-forest text-lg">{client.name}</h2>
        <p className="text-xs text-muted mt-1">{client.address || "—"} · {client.phone || "بدون هاتف"}</p>
        <div className="mt-3"><BalanceBadges data={balance} /></div>
      </div>

      <div className="px-4 py-3">
        <Link
          href={`/visit/new?client=${client.id}`}
          className="flex items-center justify-center gap-2 w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk"
        >
          <Plus size={18} /> زيارة جديدة
        </Link>
      </div>

      <div className="px-4 mt-2">
        <h3 className="font-cairo font-semibold text-ink text-sm mb-2">آخر الزيارات ({visits.length})</h3>
        {visits.length === 0 ? (
          <p className="text-center text-muted text-xs py-6">لا توجد زيارات بعد</p>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => {
              const total = v.visit_lines
                .filter((l) => l.line_type === "sale")
                .reduce((sum, l) => sum + Number(l.qty) * Number(l.unit_price ?? 0), 0);
              return (
                <li key={v.id}>
                  <Link
                    href={`/visit/${v.id}`}
                    className="flex items-center justify-between bg-white border border-border rounded-xl p-3"
                  >
                    <div>
                      <div className="font-cairo text-xs text-ink">{formatRelativeDate(new Date(v.visited_at))}</div>
                      <div className="text-[10px] text-muted mt-0.5">{v.visit_lines.length} عنصر</div>
                    </div>
                    <div className="text-left">
                      <div className="font-cairo font-bold text-primary text-sm">{formatCurrency(total)}</div>
                      <ArrowRight size={14} className="text-muted inline-block rotate-180" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

`npm run dev`, log in as emp, tap a client card → should land on detail page with name, address, "زيارة جديدة" button, and "لا توجد زيارات بعد" placeholder. Tap "زيارة جديدة" — should 404 for now (Task 8). Stop dev.

- [ ] **Step 3: Commit**

```bash
git add src/app/(employee)/client/[id]/page.tsx
git commit -m "feat(clients): client detail with balances + recent visits"
```

---

## Task 7: Quick-add client (employee form + Server Action)

**Files:**
- Create: `src/app/(employee)/client/new/page.tsx`, `src/app/(employee)/client/new/actions.ts`

- [ ] **Step 1: Implement the Server Action**

`src/app/(employee)/client/new/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addPendingClient(formData: FormData) {
  const name  = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const type  = String(formData.get("type") ?? "market") as "supermarket" | "market" | "individual";

  if (!name) return { error: "الاسم مطلوب" };
  if (!["supermarket", "market", "individual"].includes(type)) return { error: "نوع غير صالح" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("clients")
    .insert({ name, phone, type, added_by: user.id, is_approved: false })
    .select("id, name")
    .single();

  if (error || !data) return { error: error?.message ?? "تعذّر الإضافة" };

  await logActivity(supabase, {
    actor_id: user.id,
    action: "client_added",
    entity_type: "client",
    entity_id: data.id,
    summary_ar: `أضاف زبون جديد بانتظار الموافقة: ${data.name}`,
    payload: { name: data.name, type },
  });

  revalidatePath("/");
  redirect(`/client/${data.id}`);
}
```

- [ ] **Step 2: Implement the page**

`src/app/(employee)/client/new/page.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { addPendingClient } from "./actions";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addPendingClient(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="p-4">
      <Link href="/" className="flex items-center gap-1 text-xs text-muted mb-3">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">إضافة زبون جديد</h2>

      <form action={submit} className="space-y-4 bg-white border border-border rounded-2xl p-5">
        <div>
          <label className="block text-sm text-ink mb-1 font-cairo">الاسم *</label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-ink mb-1 font-cairo">رقم الهاتف</label>
          <input
            type="tel"
            name="phone"
            dir="ltr"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-ink mb-1 font-cairo">النوع *</label>
          <select
            name="type"
            defaultValue="market"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="supermarket">سوبر ماركت</option>
            <option value="market">محل / بقالة</option>
            <option value="individual">فرد</option>
          </select>
        </div>

        <p className="text-[11px] text-muted bg-info-bg p-3 rounded-xl">
          سيظهر الزبون بانتظار موافقة مجدي. يمكنك تسجيل زيارة له مباشرة.
        </p>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3">{error}</div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60"
        >
          {pending ? "جارٍ الإضافة..." : "إضافة الزبون"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

`npm run dev`, log in as emp, tap "+ زبون جديد" on Home → form appears. Fill name "بقالة الاختبار", phone "0590000000", type "محل / بقالة", submit. Should redirect to the new client's detail page with "بانتظار الموافقة" badge. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(employee)/client/new"
git commit -m "feat(clients): employee quick-add with pending-approval flow"
```

---

## Task 8: Product+Package picker component

**Files:**
- Create: `src/components/ProductPackagePicker.tsx`

This is a controlled modal/sheet used by the New Visit page. It takes an `onPick` callback and a `lineType` so the same picker handles all three button flows (sale → must pick package or single; return → ditto; replacement → only products with replacement_debt available).

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState, useMemo } from "react";
import { calcBaseQty } from "@/lib/ledgers";
import type { LineType } from "@/lib/ledgers";
import { formatCurrency, formatQty, type Unit } from "@/lib/format";

export interface ProductForPicker {
  id: string;
  name_ar: string;
  base_unit: Unit;
  base_price: number;
  packages: Array<{ id: string; package_name: string; contains_qty: number; package_price: number }>;
}

export interface PickedLine {
  product_id: string;
  package_id: string | null;
  qty: number;
  base_qty: number;
  unit_price: number | null;     // null for non-sale lines
  line_type: LineType;
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (line: PickedLine) => void;
  lineType: LineType;
  products: ProductForPicker[];
  /** For replacement_out: limit to products with debt > 0; values are base-units owed. */
  replacementDebt?: Map<string, number>;
}

export function ProductPackagePicker({ open, onClose, onPick, lineType, products, replacementDebt }: Props) {
  const [selected, setSelected] = useState<ProductForPicker | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);

  const filteredProducts = useMemo(() => {
    if (lineType !== "replacement_out" || !replacementDebt) return products;
    return products.filter((p) => (replacementDebt.get(p.id) ?? 0) > 0);
  }, [products, lineType, replacementDebt]);

  if (!open) return null;

  function pickPackage(p: ProductForPicker, pkgId: string | null) {
    setSelected(p);
    setPackageId(pkgId);
    setQty(1);
  }

  function confirm() {
    if (!selected) return;
    const pkg = packageId ? selected.packages.find((x) => x.id === packageId) ?? null : null;
    const baseQty = calcBaseQty(qty, pkg ? { contains_qty: pkg.contains_qty } : null);
    const unitPrice =
      lineType === "sale"
        ? pkg ? pkg.package_price : selected.base_price
        : null;
    onPick({
      product_id: selected.id,
      package_id: pkg?.id ?? null,
      qty,
      base_qty: baseQty,
      unit_price: unitPrice,
      line_type: lineType,
    });
    setSelected(null);
    setPackageId(null);
    setQty(1);
    onClose();
  }

  const title =
    lineType === "sale"            ? "اختر منتج للبيع" :
    lineType === "return_in"       ? "اختر منتج تالف/مرتجع" :
                                     "اختر منتج للبدل";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo font-bold text-ink text-base">{title}</h3>
          <button onClick={onClose} className="text-muted text-xs font-cairo">إلغاء</button>
        </div>

        {!selected ? (
          <ul className="space-y-2">
            {filteredProducts.length === 0 ? (
              <li className="text-center text-muted text-xs py-8">لا توجد منتجات</li>
            ) : (
              filteredProducts.map((p) => {
                const debtUnits = replacementDebt?.get(p.id);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => pickPackage(p, null)}
                      className="w-full flex items-center justify-between bg-info-bg/40 border border-border rounded-xl p-3 hover:bg-info-bg"
                    >
                      <span className="font-cairo font-semibold text-ink text-sm">{p.name_ar}</span>
                      <span className="text-[11px] text-muted">
                        {lineType === "sale" ? formatCurrency(p.base_price) + "/" + p.base_unit : ""}
                        {lineType === "replacement_out" && debtUnits ? `متاح ${formatQty(debtUnits, p.base_unit)}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : (
          <div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted mb-3 font-cairo"
            >
              ← اختر منتج آخر
            </button>
            <h4 className="font-cairo font-bold text-forest text-sm mb-2">{selected.name_ar}</h4>
            <p className="text-xs text-muted mb-3 font-cairo">اختر العبوة:</p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 p-3 border border-border rounded-xl cursor-pointer hover:bg-info-bg/40">
                <input
                  type="radio"
                  name="pkg"
                  checked={packageId === null}
                  onChange={() => setPackageId(null)}
                />
                <span className="flex-1 font-cairo text-sm text-ink">
                  {selected.base_unit === "L" ? "لتر مفرد" : selected.base_unit === "kg" ? "كيلو مفرد" : "قطعة مفردة"}
                </span>
                {lineType === "sale" && (
                  <span className="text-xs text-primary font-cairo font-bold">
                    {formatCurrency(selected.base_price)}
                  </span>
                )}
              </label>

              {selected.packages.map((pkg) => (
                <label
                  key={pkg.id}
                  className="flex items-center gap-2 p-3 border border-border rounded-xl cursor-pointer hover:bg-info-bg/40"
                >
                  <input
                    type="radio"
                    name="pkg"
                    checked={packageId === pkg.id}
                    onChange={() => setPackageId(pkg.id)}
                  />
                  <span className="flex-1 font-cairo text-sm text-ink">
                    {pkg.package_name} ({pkg.contains_qty} {selected.base_unit})
                  </span>
                  {lineType === "sale" && (
                    <span className="text-xs text-primary font-cairo font-bold">
                      {formatCurrency(pkg.package_price)}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <label className="font-cairo text-sm text-ink">الكمية:</label>
              <input
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-ink text-center font-cairo"
              />
            </div>

            <button
              onClick={confirm}
              className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk"
            >
              إضافة إلى الزيارة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

(No standalone smoke test — the picker is used by the next task. We'll verify visually then.)

```bash
git add src/components/ProductPackagePicker.tsx
git commit -m "feat(visit): product + package picker component"
```

---

## Task 9: New Visit page (UI state + Server Action)

**Files:**
- Create: `src/app/(employee)/visit/new/page.tsx`, `src/app/(employee)/visit/new/actions.ts`, `src/components/VisitLineRow.tsx`

- [ ] **Step 1: Create `src/components/VisitLineRow.tsx`**

```tsx
import type { PickedLine } from "./ProductPackagePicker";
import { formatCurrency, formatQty, type Unit } from "@/lib/format";
import { X } from "lucide-react";

interface Props {
  line: PickedLine;
  productName: string;
  productUnit: Unit;
  packageName?: string | null;
  onRemove: () => void;
}

const TYPE_BORDER = {
  sale:             "border-r-primary",
  return_in:        "border-r-warn",
  replacement_out:  "border-r-primary-dk",
} as const;

const TYPE_BADGE = {
  sale:             { ar: "+ بيع",     cls: "text-primary" },
  return_in:        { ar: "↩ مرتجع",   cls: "text-warn" },
  replacement_out:  { ar: "🔄 بدل",   cls: "text-primary-dk" },
} as const;

export function VisitLineRow({ line, productName, productUnit, packageName, onRemove }: Props) {
  const badge = TYPE_BADGE[line.line_type];
  const subtotalText =
    line.line_type === "sale"
      ? formatCurrency(line.qty * (line.unit_price ?? 0))
      : "بدون مقابل";

  return (
    <div className={`flex items-start justify-between bg-white border border-border border-r-4 ${TYPE_BORDER[line.line_type]} rounded-xl px-3 py-2.5 mb-1.5`}>
      <div className="min-w-0">
        <div className="font-cairo font-semibold text-ink text-sm">
          <span className={`text-xs font-bold ${badge.cls} ml-1`}>{badge.ar}</span>
          {productName} — {formatQty(line.base_qty, productUnit)}
        </div>
        <div className="text-[10px] text-muted mt-0.5 font-cairo">
          {packageName ? `${line.qty} × ${packageName}` : "مفرد"}
          {line.line_type === "sale" && line.unit_price !== null
            ? ` · ${formatCurrency(line.unit_price)} لكل وحدة`
            : line.line_type === "replacement_out"
            ? " · بدل (تسوية دين سابق)"
            : ""}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 ms-2">
        <span className={`font-cairo font-bold text-sm ${line.line_type === "sale" ? "text-ink" : "text-primary-dk"}`}>
          {subtotalText}
        </span>
        <button onClick={onRemove} className="text-muted hover:text-danger">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the Server Action**

`src/app/(employee)/visit/new/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DraftLine } from "@/lib/ledgers";

export interface CreateVisitInput {
  client_id: string;
  lines: DraftLine[];
  notes?: string | null;
}

export async function createVisitWithLines(input: CreateVisitInput) {
  if (!input.client_id) return { error: "زبون غير محدد" };
  if (!input.lines.length) return { error: "أضف عنصر واحد على الأقل" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data: visit, error: visitErr } = await supabase
    .from("visits")
    .insert({
      client_id:   input.client_id,
      employee_id: user.id,
      notes:       input.notes ?? null,
    })
    .select("id, client_id")
    .single();

  if (visitErr || !visit) return { error: visitErr?.message ?? "تعذّر إنشاء الزيارة" };

  const linesPayload = input.lines.map((l) => ({
    visit_id:    visit.id,
    product_id:  l.product_id,
    package_id:  l.package_id,
    qty:         l.qty,
    base_qty:    l.base_qty,
    unit_price:  l.unit_price,
    line_type:   l.line_type,
    note:        l.note ?? null,
  }));

  const { error: linesErr } = await supabase.from("visit_lines").insert(linesPayload);
  if (linesErr) {
    // Best-effort cleanup so a partial visit doesn't linger
    await supabase.from("visits").delete().eq("id", visit.id);
    return { error: linesErr.message };
  }

  const clientRes = await supabase.from("clients").select("name").eq("id", input.client_id).maybeSingle();
  const clientName = clientRes.data?.name ?? "(زبون)";

  await logActivity(supabase, {
    actor_id:    user.id,
    action:      "visit_created",
    entity_type: "visit",
    entity_id:   visit.id,
    summary_ar:  `سجّل زيارة جديدة لـ ${clientName} (${input.lines.length} عنصر)`,
    payload:     { client_id: visit.client_id, lines_count: input.lines.length },
  });

  revalidatePath("/");
  revalidatePath(`/client/${input.client_id}`);
  redirect(`/visit/${visit.id}`);
}
```

- [ ] **Step 3: Create the New Visit page**

`src/app/(employee)/visit/new/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus, RotateCcw, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calcVisitTotal, type DraftLine } from "@/lib/ledgers";
import { formatCurrency, type Unit } from "@/lib/format";
import { ProductPackagePicker, type ProductForPicker, type PickedLine } from "@/components/ProductPackagePicker";
import { VisitLineRow } from "@/components/VisitLineRow";
import { BalanceBadges, type BalanceData } from "@/components/BalanceBadges";
import { createVisitWithLines } from "./actions";

type LineType = DraftLine["line_type"];

interface ClientRow { id: string; name: string; address: string | null }

export default function NewVisitPage() {
  const sp = useSearchParams();
  const clientId = sp.get("client") ?? "";

  const [client, setClient] = useState<ClientRow | null>(null);
  const [balance, setBalance] = useState<BalanceData>({ money_owed: 0, replacements: [] });
  const [products, setProducts] = useState<ProductForPicker[]>([]);
  const [replacementDebt, setReplacementDebt] = useState<Map<string, number>>(new Map());

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<LineType>("sale");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const supabase = createClient();
    (async () => {
      const [clientRes, moneyRes, replRes, productsRes, packagesRes] = await Promise.all([
        supabase.from("clients").select("id, name, address").eq("id", clientId).single(),
        supabase.from("v_client_money_balance").select("balance").eq("client_id", clientId).maybeSingle(),
        supabase.from("v_client_replacement_debt").select("product_id, owed_base_qty").eq("client_id", clientId),
        supabase.from("products").select("id, name_ar, base_unit, base_price").eq("is_active", true),
        supabase.from("product_packages").select("id, product_id, package_name, contains_qty, package_price").eq("is_active", true),
      ]);
      if (clientRes.data) setClient(clientRes.data);

      const productsData = (productsRes.data ?? []) as Array<{ id: string; name_ar: string; base_unit: Unit; base_price: number }>;
      const packagesData = (packagesRes.data ?? []) as Array<{ id: string; product_id: string; package_name: string; contains_qty: number; package_price: number }>;
      const productsForPicker: ProductForPicker[] = productsData.map((p) => ({
        id: p.id,
        name_ar: p.name_ar,
        base_unit: p.base_unit,
        base_price: Number(p.base_price),
        packages: packagesData
          .filter((pk) => pk.product_id === p.id)
          .map((pk) => ({
            id: pk.id,
            package_name: pk.package_name,
            contains_qty: Number(pk.contains_qty),
            package_price: Number(pk.package_price),
          })),
      }));
      setProducts(productsForPicker);

      const replMap = new Map<string, number>();
      for (const r of (replRes.data ?? []) as Array<{ product_id: string; owed_base_qty: number }>) {
        replMap.set(r.product_id, Number(r.owed_base_qty));
      }
      setReplacementDebt(replMap);

      const productById = new Map(productsData.map((p) => [p.id, p]));
      setBalance({
        money_owed: Number(moneyRes.data?.balance ?? 0),
        replacements: Array.from(replMap.entries())
          .map(([pid, owed]) => {
            const p = productById.get(pid);
            if (!p) return null;
            return { product_name_ar: p.name_ar, unit: p.base_unit, owed_base_qty: owed };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      });
    })();
  }, [clientId]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const packageMap = useMemo(() => {
    const m = new Map<string, { name: string; contains_qty: number }>();
    for (const p of products) for (const pk of p.packages) m.set(pk.id, { name: pk.package_name, contains_qty: pk.contains_qty });
    return m;
  }, [products]);

  const total = calcVisitTotal(lines);

  function openPicker(type: LineType) {
    setPickerType(type);
    setPickerOpen(true);
  }

  function onPick(line: PickedLine) {
    setLines((prev) => [...prev, line]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function confirm() {
    setError(null);
    startSubmit(async () => {
      const res = await createVisitWithLines({ client_id: clientId, lines });
      if (res?.error) setError(res.error);
    });
  }

  if (!clientId) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted text-sm mb-3 font-cairo">يجب اختيار زبون أولاً</p>
        <Link href="/" className="text-primary font-cairo text-sm">← العودة للزبائن</Link>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white p-4">
        <Link href={`/client/${clientId}`} className="flex items-center gap-1 text-xs text-white/80 mb-2">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <h2 className="font-cairo font-bold text-lg">{client?.name ?? "..."}</h2>
        <p className="text-xs opacity-80 mt-0.5">{client?.address || ""}</p>
      </div>

      <div className="bg-info-bg p-3 grid grid-cols-2 gap-2 border-b border-border">
        <div className="bg-white rounded-xl p-2.5 border border-border">
          <div className="text-[10px] text-muted font-cairo">💰 يدين لك</div>
          <div className="font-cairo font-bold text-warn text-base mt-1">{formatCurrency(balance.money_owed)}</div>
        </div>
        <div className="bg-white rounded-xl p-2.5 border border-border">
          <div className="text-[10px] text-muted font-cairo">🥛 تدين له</div>
          <div className="font-cairo font-bold text-primary-dk text-xs mt-1 leading-tight">
            {balance.replacements.length === 0 ? "—" : balance.replacements.map((r) => `${r.owed_base_qty} ${r.product_name_ar}`).join(" · ")}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => openPicker("sale")}
          className="bg-primary text-white rounded-xl p-3 font-cairo font-bold text-xs shadow-sm flex flex-col items-center gap-1"
        >
          <Plus size={20} />
          <span>بيع جديد</span>
        </button>
        <button
          onClick={() => openPicker("return_in")}
          className="bg-white text-warn border border-orange-200 rounded-xl p-3 font-cairo font-bold text-xs flex flex-col items-center gap-1"
        >
          <RotateCcw size={20} />
          <span>مرتجع تالف</span>
        </button>
        <button
          onClick={() => openPicker("replacement_out")}
          className="bg-white text-primary-dk border border-border rounded-xl p-3 font-cairo font-bold text-xs flex flex-col items-center gap-1"
        >
          <RefreshCw size={20} />
          <span>بدل</span>
        </button>
      </div>

      <div className="px-4 mt-4">
        <h3 className="font-cairo font-semibold text-muted text-xs mb-2">عناصر هذه الزيارة</h3>
        {lines.length === 0 ? (
          <p className="text-center text-muted text-xs py-6 font-cairo">اضغط أحد الأزرار أعلاه لإضافة عنصر</p>
        ) : (
          lines.map((l, idx) => {
            const p = productMap.get(l.product_id);
            const pkg = l.package_id ? packageMap.get(l.package_id) : null;
            return (
              <VisitLineRow
                key={idx}
                line={l}
                productName={p?.name_ar ?? "?"}
                productUnit={p?.base_unit ?? "piece"}
                packageName={pkg?.name ?? null}
                onRemove={() => removeLine(idx)}
              />
            );
          })
        )}
      </div>

      {lines.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-forest text-white rounded-xl p-3 flex items-center justify-between">
            <span className="font-cairo text-sm opacity-90">المطلوب تحصيله الآن</span>
            <span className="font-cairo font-extrabold text-xl">{formatCurrency(total)}</span>
          </div>
          {error && (
            <div className="mt-2 rounded-xl bg-red-50 border border-red-200 text-danger text-xs p-2.5">{error}</div>
          )}
          <button
            onClick={confirm}
            disabled={submitting}
            className="mt-2 w-full bg-primary text-white font-cairo font-bold py-3 rounded-xl shadow-sm hover:bg-primary-dk disabled:opacity-60"
          >
            {submitting ? "جارٍ التأكيد..." : "✓ تأكيد الزيارة"}
          </button>
        </div>
      )}

      <ProductPackagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPick}
        lineType={pickerType}
        products={products}
        replacementDebt={replacementDebt}
      />
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

`npm run dev`, log in as emp, tap a client → tap "زيارة جديدة" → 3 buttons appear + balances at top.
- Tap "بيع جديد" → picker opens. Pick "لبن" → choose "كرتونة (24 لتر)" → qty 1 → confirm. Line appears with subtotal 110 ₪.
- Tap "مرتجع تالف" → pick "لبن" → single لتر, qty 3 → confirm. Line appears, no money impact.
- Tap "بدل" → picker filtered to only products with debt (لبن since we just returned 3). Pick → single لتر → qty 3 → confirm.
- Total at bottom should be 110 ₪.
- Confirm → redirect to /visit/[id] (404 for now, Task 10 builds it).

After confirming, go back to client detail page — should show 1 visit in the recent list. Also home page should show updated balance badges.

Stop dev.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(employee)/visit/new" src/components/VisitLineRow.tsx
git commit -m "feat(visit): 3-button New Visit screen + atomic create action"
```

---

## Task 10: Receipt page

**Files:**
- Create: `src/app/(employee)/visit/[id]/page.tsx`, `src/components/ReceiptCard.tsx`

- [ ] **Step 1: Create `src/components/ReceiptCard.tsx`**

```tsx
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
  sale:             { title: "🛒 المبيعات",          border: "border-r-primary",     text: "text-primary" },
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
          <div className="text-ink font-semibold text-left">{formatRelativeDate(new Date(data.visited_at))} · {new Date(data.visited_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
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
```

- [ ] **Step 2: Create `src/app/(employee)/visit/[id]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { ReceiptCard } from "@/components/ReceiptCard";
import type { Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VisitReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: visit, error } = await supabase
    .from("visits")
    .select(`
      id, visited_at, client_id,
      visit_lines (
        line_type, qty, base_qty, unit_price, package_id,
        products ( name_ar, base_unit ),
        product_packages ( package_name )
      ),
      clients ( name ),
      users ( full_name )
    `)
    .eq("id", id)
    .single();

  if (error || !visit) return notFound();

  type Line = NonNullable<typeof visit.visit_lines>[number];
  const lines = (visit.visit_lines as Line[]).map((l) => ({
    line_type:        l.line_type as "sale" | "return_in" | "replacement_out",
    qty:              Number(l.qty),
    base_qty:         Number(l.base_qty),
    unit_price:       l.unit_price === null ? null : Number(l.unit_price),
    product_name_ar:  (l.products as unknown as { name_ar: string } | null)?.name_ar ?? "?",
    product_unit:    ((l.products as unknown as { base_unit: Unit } | null)?.base_unit ?? "piece") as Unit,
    package_name:     (l.product_packages as unknown as { package_name: string } | null)?.package_name ?? null,
  }));

  return (
    <div>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between max-w-md mx-auto print:hidden">
        <Link href={`/client/${visit.client_id}`} className="flex items-center gap-1 text-xs text-muted font-cairo">
          <ArrowRight size={14} className="rotate-180" /> رجوع
        </Link>
        <button
          onClick={() => { if (typeof window !== "undefined") window.print(); }}
          className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border"
          // @ts-expect-error: onClick on Server Component element — Next 15 wires this fine for window.print
          formMethod="get"
        >
          <Printer size={14} /> طباعة
        </button>
      </div>
      <ReceiptCard
        data={{
          visit_id:      visit.id,
          visited_at:    visit.visited_at,
          client_name:  (visit.clients as unknown as { name: string } | null)?.name ?? "?",
          employee_name:(visit.users as unknown as { full_name: string } | null)?.full_name ?? "?",
          lines,
        }}
      />
    </div>
  );
}
```

> The `window.print()` button on a Server Component is a known pattern — extract to a tiny Client Component if it lints/errors. For brevity, a 3-line client component `<PrintButton />` can be created if Next rejects the inline handler. The `@ts-expect-error` above signals the compromise.

If TS strictly refuses the inline `onClick`, replace the button with this fallback Client Component:

Create `src/components/PrintButton.tsx`:

```tsx
"use client";
import { Printer } from "lucide-react";
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border"
    >
      <Printer size={14} /> طباعة
    </button>
  );
}
```

And replace the button in the page with `<PrintButton />`.

- [ ] **Step 3: Smoke test**

Visit one of the visits you created in Task 9's test (or create a new one). URL `/visit/<id>` should render the receipt with brand header, client info, sections by type, and the bold "المبلغ المستحق". Click "طباعة" → browser print dialog opens.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReceiptCard.tsx src/components/PrintButton.tsx "src/app/(employee)/visit/[id]"
git commit -m "feat(visit): receipt page with print support"
```

---

## Task 11: My Visits page

**Files:**
- Create: `src/app/(employee)/my-visits/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCurrency, formatRelativeDate, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

interface RowVisit {
  id: string;
  visited_at: string;
  clients: { name: string } | null;
  visit_lines: { qty: number; unit_price: number | null; line_type: string }[];
}

export default async function MyVisits() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("visits")
    .select("id, visited_at, clients(name), visit_lines(qty, unit_price, line_type)")
    .eq("employee_id", user.id)
    .order("visited_at", { ascending: false })
    .limit(50);

  const visits = (data ?? []) as unknown as RowVisit[];

  return (
    <div className="p-4">
      <h2 className="font-cairo font-bold text-forest text-lg mb-3">زياراتي ({visits.length})</h2>
      {visits.length === 0 ? (
        <p className="text-center text-muted text-sm py-12 font-cairo">لا توجد زيارات بعد</p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => {
            const total = v.visit_lines
              .filter((l) => l.line_type === "sale")
              .reduce((s, l) => s + Number(l.qty) * Number(l.unit_price ?? 0), 0);
            return (
              <li key={v.id}>
                <Link href={`/visit/${v.id}`} className="flex items-center justify-between bg-white border border-border rounded-xl p-3">
                  <div className="min-w-0">
                    <div className="font-cairo text-sm font-semibold text-ink truncate">{v.clients?.name ?? "?"}</div>
                    <div className="text-[10px] text-muted mt-0.5 font-cairo">{formatRelativeDate(new Date(v.visited_at))}</div>
                  </div>
                  <div className="font-cairo font-bold text-primary text-sm shrink-0 ms-2">{formatCurrency(total)}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

`npm run dev` — log in as emp, tap "زياراتي" in bottom nav. Should list the visits you created earlier with totals.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(employee)/my-visits"
git commit -m "feat(employee): my-visits history list"
```

---

## Task 12: Profile page

**Files:**
- Create: `src/app/(employee)/profile/page.tsx`

- [ ] **Step 1: Implement**

```tsx
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
```

- [ ] **Step 2: Smoke test**

Tap "حسابي" in bottom nav → see info + logout button. Tap logout → back to /login.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(employee)/profile"
git commit -m "feat(employee): minimal profile page"
```

---

## Task 13: Full end-to-end manual test + push + deploy

**No new files.** This is the Phase 2 acceptance gate.

- [ ] **Step 1: Run full suite**

```bash
cd "F:/Projects/Cloned/08_OtherProjects/alban-al-qasr"
npm test
```

Expected: all tests pass (Phase 1's 12 + Phase 2's new ones — should be ~25+).

- [ ] **Step 2: Build locally**

```bash
npm run build
```

Expected: ✓ compiled successfully, all pages generated, no TS errors.

- [ ] **Step 3: Manual end-to-end on dev server**

```bash
npm run dev
```

Log in as `emp@alqasr.test` and run through:

1. ✅ Home shows "الزبائن (2)" + "+ زبون جديد" button + cards for سوبر ماركت الأخوة + بقالة النور
2. ✅ Tap a card → client detail with balances + "زيارة جديدة" + empty visits list
3. ✅ Tap "زيارة جديدة" → 3 buttons + balances tiles
4. ✅ Add a sale: لبن × 7 لتر → line appears, subtotal 35₪
5. ✅ Add a return: لبن × 3 لتر → line appears, "بدون مقابل"
6. ✅ Add another sale: لبنة × 2 كيلو → 36₪
7. ✅ Total bar shows 71₪
8. ✅ Confirm → lands on `/visit/[id]` receipt, sections rendered (sale + return), "المبلغ المستحق 71₪"
9. ✅ Click "طباعة" → browser print dialog opens
10. ✅ Back to client detail → 1 visit listed with correct total
11. ✅ Home → سوبر ماركت now shows badges: "💰 71₪" + "🥛 3 لتر لبن"
12. ✅ Visit "زيارة جديدة" again → "بدل" picker now shows لبن as available (debt = 3 ل)
13. ✅ Add replacement: لبن × 3 لتر → "بدون مقابل" line
14. ✅ Confirm → after redirect to receipt, back to home: debt badge for لبن is gone (or absent)
15. ✅ Quick-add a new client: name "محل التجربة", phone "0590000999", type "محل / بقالة" → redirects to its detail, "بانتظار الموافقة" badge visible
16. ✅ Bottom nav: tap "زياراتي" → all visits listed. Tap "حسابي" → name + email + logout. Tap logout → /login.

- [ ] **Step 4: Verify activity_log filled (admin-side spot check)**

Open Supabase dashboard → Table Editor → `activity_log`. Should see N rows: 1 per visit created, 1 per client added. `summary_ar` should be readable Arabic.

- [ ] **Step 5: Push + tag**

```bash
git push
git tag -a v0.2.0-phase2 -m "Phase 2: Core employee flow — clients list, new visit (3-button), receipt, quick-add"
git push --tags
```

- [ ] **Step 6: Verify Netlify auto-deploy**

Wait ~3 min, then visit https://alban-al-gasr.netlify.app on your phone. Log in as `emp` and run through steps 1-16 again on the live URL.

---

## Phase 2 Acceptance Checklist

Phase 2 is **done** when:

- [ ] All unit tests pass (~25 tests across format, ledgers, activity-log, plus carried Phase 1 tests)
- [ ] `npm run build` clean
- [ ] Local 16-step e2e passes
- [ ] Live Netlify 16-step e2e passes on a real phone
- [ ] `activity_log` table is populated correctly
- [ ] Tag `v0.2.0-phase2` pushed
- [ ] No `Co-Authored-By` / 🤖 footers in any commit

After acceptance, return to writing-plans for Phase 3 (admin core: products CRUD, clients CRUD + merge, expenses, production).
