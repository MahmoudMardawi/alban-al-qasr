# Alban Al-Qasr — Phase 3: Admin World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Majdi's operational toolset: full Products CRUD with packages, full Clients management with approve/merge, Expenses (with receipt photo upload via Supabase Storage), Production & Waste recording, and basic Users management. End state: Majdi logs in, navigates between 5 admin sections via bottom nav + "More" menu, manages every operational entity for the dairy. Activity log fills with `client_approved`, `clients_merged`, `expense_added`, etc. — ready for Phase 5's bell.

**Architecture:** All admin routes under `src/app/(admin)/`. Admin layout wraps with brand header + admin-specific bottom nav (Dashboard / Clients / Products / More). Server Components fetch data; mutations via Server Actions returning `{ id?: string, error?: string }` (no `redirect()` throw — pattern proven in Phase 2). The **merge** operation is atomic via a Postgres function `fn_merge_clients(primary_id, duplicate_ids[])`. Receipt photo uploads go to a new Supabase Storage bucket `receipts` with admin-only RLS. Pure logic (validation, etc.) lives in `src/lib/admin-validation.ts` with TDD coverage.

**Tech Stack:** Same as Phase 2. New: Supabase Storage (upload via `supabase.storage.from(...).upload(...)`). No new npm installs.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-06-19-alban-al-qasr-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-06-19-alban-al-qasr-phase1-foundation.md`
- Phase 2 plan: `docs/superpowers/plans/2026-06-19-alban-al-qasr-phase2-employee-flow.md`

---

## File Structure (Phase 3 only — new + modified)

```
supabase/migrations/
└── 0005_admin_helpers.sql                   # NEW — fn_merge_clients RPC + storage bucket + RLS

src/
├── lib/
│   └── admin-validation.ts                  # NEW — validateProductInput, validateExpenseInput, etc. (TDD)
├── app/
│   ├── (admin)/
│   │   ├── layout.tsx                       # NEW — admin shell with brand header + AdminBottomNav
│   │   ├── dashboard/page.tsx               # MODIFY — keep placeholder, Phase 4 replaces
│   │   │
│   │   ├── products/page.tsx                # NEW — list
│   │   ├── products/new/page.tsx            # NEW — create form
│   │   ├── products/[id]/page.tsx           # NEW — edit form
│   │   ├── products/actions.ts              # NEW — createProduct, updateProduct, deleteProduct,
│   │   │                                    #          addPackage, updatePackage, deletePackage
│   │   │
│   │   ├── clients/page.tsx                 # NEW — admin list with pending strip + table
│   │   ├── clients/[id]/page.tsx            # NEW — admin edit (not the employee read-only one)
│   │   ├── clients/new/page.tsx             # NEW — admin full-form add (is_approved=true by default)
│   │   ├── clients/merge/page.tsx           # NEW — merge wizard UI
│   │   ├── clients/actions.ts               # NEW — approveClient, updateClient, deleteClient, mergeClients
│   │   │
│   │   ├── expenses/page.tsx                # NEW — list
│   │   ├── expenses/new/page.tsx            # NEW — form with optional photo upload
│   │   ├── expenses/actions.ts              # NEW — uploadReceiptPhoto, createExpense, deleteExpense
│   │   │
│   │   ├── production/page.tsx              # NEW — list
│   │   ├── production/new/page.tsx          # NEW — daily entry per product
│   │   ├── production/actions.ts            # NEW — createProductionEntry
│   │   │
│   │   ├── users/page.tsx                   # NEW — list employees
│   │   ├── users/new/page.tsx               # NEW — invite by email (Supabase auth invite)
│   │   └── users/actions.ts                 # NEW — inviteUser, toggleUserActive
│
└── components/
    ├── AdminBottomNav.tsx                   # NEW — Dashboard / Clients / Products / More
    ├── AdminMoreSheet.tsx                   # NEW — bottom sheet listing Expenses / Production / Users / AI / Reports / etc.
    ├── ProductForm.tsx                      # NEW — reusable form (create + edit), inline packages
    ├── PackageInputRow.tsx                  # NEW — one editable package row
    ├── ConfirmDialog.tsx                    # NEW — destructive-action confirm overlay
    ├── ClientApprovalCard.tsx               # NEW — pending client row with approve/edit/delete/merge
    ├── MergeWizard.tsx                      # NEW — pick primary + duplicates + ledger preview
    ├── ReceiptPhotoInput.tsx                # NEW — Supabase Storage upload wrapper
    └── EmptyState.tsx                       # NEW — reusable "no data" component (used in 5 admin lists)

tests/
└── lib/
    └── admin-validation.test.ts             # NEW
```

---

## Prerequisites Check

Before Task 1:
- [ ] Phase 2 tagged `v0.2.1-phase2` (verified by `git tag`)
- [ ] Local dev works on http://localhost:3001 (or whatever port)
- [ ] Supabase project has the Phase 2 schema + RLS applied
- [ ] You're logged in to Supabase CLI (`npx supabase link` already done)

---

## Task 1: Migration — merge RPC + storage bucket + RLS

**Files:**
- Create: `supabase/migrations/0005_admin_helpers.sql`

This task adds three things atomically: (1) a Postgres function that performs client merges in one transaction, (2) a `receipts` Storage bucket for expense photos, (3) RLS policies on the new bucket.

- [ ] **Step 1: Create the migration file**

```sql
-- ===== 0005_admin_helpers.sql =====

-- ----- Atomic client merge -----
-- Moves all visits + payments from `duplicate_ids` to `primary_id`,
-- then soft-merges the duplicates (sets merged_into_client_id).
-- Returns the count of duplicates merged.
-- All-or-nothing: Postgres function runs in an implicit transaction.
CREATE OR REPLACE FUNCTION fn_merge_clients(primary_id UUID, duplicate_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER  -- runs as caller; RLS still applies; admin-only via policy below
AS $$
DECLARE
  moved_count INTEGER := 0;
BEGIN
  IF primary_id IS NULL OR array_length(duplicate_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'primary_id and at least one duplicate_id required';
  END IF;

  IF primary_id = ANY(duplicate_ids) THEN
    RAISE EXCEPTION 'primary cannot be in duplicates list';
  END IF;

  UPDATE visits   SET client_id = primary_id WHERE client_id = ANY(duplicate_ids);
  UPDATE payments SET client_id = primary_id WHERE client_id = ANY(duplicate_ids);
  UPDATE clients
     SET merged_into_client_id = primary_id
   WHERE id = ANY(duplicate_ids)
     AND merged_into_client_id IS NULL;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

-- Restrict execution to admins
REVOKE EXECUTE ON FUNCTION fn_merge_clients FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_merge_clients TO authenticated;
-- (The function checks no role internally; RLS on the underlying tables enforces admin-only,
--  since only admin can UPDATE visits/payments/clients per existing 0003_rls policies.)

-- ----- Storage bucket: receipts -----
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (admin-only)
DROP POLICY IF EXISTS receipts_admin_select ON storage.objects;
CREATE POLICY receipts_admin_select ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts' AND is_admin());

DROP POLICY IF EXISTS receipts_admin_insert ON storage.objects;
CREATE POLICY receipts_admin_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts' AND is_admin());

DROP POLICY IF EXISTS receipts_admin_delete ON storage.objects;
CREATE POLICY receipts_admin_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'receipts' AND is_admin());
```

- [ ] **Step 2: Apply the migration**

```bash
cd "F:/Projects/Cloned/08_OtherProjects/alban-al-qasr"
npx supabase db push
```

Expected: `Applying migration 0005_admin_helpers.sql ... Finished supabase db push.`

- [ ] **Step 3: Verify in dashboard**

- Database → Functions → confirm `fn_merge_clients` exists
- Storage → confirm `receipts` bucket appears (private)
- Authentication → Policies → storage.objects → 3 receipts_admin_* policies

- [ ] **Step 4: Regenerate TS types** (the RPC adds a type)

```bash
npm run types:gen
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_admin_helpers.sql src/lib/types.ts
git commit -m "feat(db): client-merge RPC + receipts storage bucket + RLS"
```

---

## Task 2: Admin validation helpers (TDD)

**Files:**
- Create: `src/lib/admin-validation.ts`, `tests/lib/admin-validation.test.ts`

Pure functions — validate product, package, expense, production inputs. Returns `{ ok: true } | { ok: false, error: string }`.

- [ ] **Step 1: Write tests**

`tests/lib/admin-validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  validateProductInput,
  validatePackageInput,
  validateExpenseInput,
  validateProductionInput,
} from "@/lib/admin-validation";

describe("validateProductInput", () => {
  const ok = { name_ar: "لبن", base_unit: "L", base_price: 5, base_cost: 2 };
  it("accepts valid", () => expect(validateProductInput(ok)).toEqual({ ok: true }));
  it("rejects empty name", () =>
    expect(validateProductInput({ ...ok, name_ar: "" })).toMatchObject({ ok: false }));
  it("rejects unknown unit", () =>
    expect(validateProductInput({ ...ok, base_unit: "box" })).toMatchObject({ ok: false }));
  it("rejects negative price", () =>
    expect(validateProductInput({ ...ok, base_price: -1 })).toMatchObject({ ok: false }));
  it("allows null cost", () =>
    expect(validateProductInput({ ...ok, base_cost: null })).toEqual({ ok: true }));
});

describe("validatePackageInput", () => {
  const ok = { package_name: "كرتونة", contains_qty: 24, package_price: 110 };
  it("accepts valid", () => expect(validatePackageInput(ok)).toEqual({ ok: true }));
  it("rejects empty name", () =>
    expect(validatePackageInput({ ...ok, package_name: "" })).toMatchObject({ ok: false }));
  it("rejects zero contains_qty", () =>
    expect(validatePackageInput({ ...ok, contains_qty: 0 })).toMatchObject({ ok: false }));
  it("rejects negative price", () =>
    expect(validatePackageInput({ ...ok, package_price: -5 })).toMatchObject({ ok: false }));
});

describe("validateExpenseInput", () => {
  const ok = { category: "fuel", amount: 100 };
  it("accepts valid", () => expect(validateExpenseInput(ok)).toEqual({ ok: true }));
  it("rejects unknown category", () =>
    expect(validateExpenseInput({ ...ok, category: "bribe" })).toMatchObject({ ok: false }));
  it("rejects zero amount", () =>
    expect(validateExpenseInput({ ...ok, amount: 0 })).toMatchObject({ ok: false }));
});

describe("validateProductionInput", () => {
  const ok = { product_id: "u1", qty_produced: 50, qty_wasted: 2 };
  it("accepts valid", () => expect(validateProductionInput(ok)).toEqual({ ok: true }));
  it("accepts zero waste", () =>
    expect(validateProductionInput({ ...ok, qty_wasted: 0 })).toEqual({ ok: true }));
  it("rejects negative produced", () =>
    expect(validateProductionInput({ ...ok, qty_produced: -1 })).toMatchObject({ ok: false }));
  it("rejects waste exceeding production", () =>
    expect(validateProductionInput({ ...ok, qty_wasted: 100 })).toMatchObject({ ok: false }));
});
```

- [ ] **Step 2: Run — expect RED**

```bash
npm test -- tests/lib/admin-validation.test.ts
```

- [ ] **Step 3: Implement `src/lib/admin-validation.ts`**

```typescript
type Result = { ok: true } | { ok: false; error: string };

export interface ProductInput {
  name_ar: string;
  base_unit: string;
  base_price: number;
  base_cost: number | null;
}

export function validateProductInput(p: ProductInput): Result {
  if (!p.name_ar?.trim()) return { ok: false, error: "اسم المنتج مطلوب" };
  if (!["L", "kg", "piece"].includes(p.base_unit))
    return { ok: false, error: "وحدة غير صالحة" };
  if (typeof p.base_price !== "number" || p.base_price < 0)
    return { ok: false, error: "السعر يجب أن يكون رقمًا غير سالب" };
  if (p.base_cost !== null && (typeof p.base_cost !== "number" || p.base_cost < 0))
    return { ok: false, error: "التكلفة يجب أن تكون رقمًا غير سالب" };
  return { ok: true };
}

export interface PackageInput {
  package_name: string;
  contains_qty: number;
  package_price: number;
}

export function validatePackageInput(p: PackageInput): Result {
  if (!p.package_name?.trim()) return { ok: false, error: "اسم العبوة مطلوب" };
  if (typeof p.contains_qty !== "number" || p.contains_qty <= 0)
    return { ok: false, error: "كمية العبوة يجب أن تكون أكبر من صفر" };
  if (typeof p.package_price !== "number" || p.package_price < 0)
    return { ok: false, error: "سعر العبوة يجب أن يكون رقمًا غير سالب" };
  return { ok: true };
}

export interface ExpenseInput {
  category: string;
  amount: number;
}

export function validateExpenseInput(e: ExpenseInput): Result {
  if (!["fuel", "salary", "rent", "milk", "other"].includes(e.category))
    return { ok: false, error: "تصنيف غير صالح" };
  if (typeof e.amount !== "number" || e.amount <= 0)
    return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
  return { ok: true };
}

export interface ProductionInput {
  product_id: string;
  qty_produced: number;
  qty_wasted: number;
}

export function validateProductionInput(p: ProductionInput): Result {
  if (!p.product_id) return { ok: false, error: "المنتج مطلوب" };
  if (typeof p.qty_produced !== "number" || p.qty_produced < 0)
    return { ok: false, error: "الكمية المنتجة يجب أن تكون رقمًا غير سالب" };
  if (typeof p.qty_wasted !== "number" || p.qty_wasted < 0)
    return { ok: false, error: "الفاقد يجب أن يكون رقمًا غير سالب" };
  if (p.qty_wasted > p.qty_produced)
    return { ok: false, error: "الفاقد لا يمكن أن يتجاوز الكمية المنتجة" };
  return { ok: true };
}
```

- [ ] **Step 4: Run — expect GREEN**

```bash
npm test -- tests/lib/admin-validation.test.ts
```

Expected: all 17 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-validation.ts tests/lib/admin-validation.test.ts
git commit -m "feat(admin): input validation helpers + tests"
```

---

## Task 3: Admin shell — layout + bottom nav + more sheet + EmptyState

**Files:**
- Create: `src/components/AdminBottomNav.tsx`, `src/components/AdminMoreSheet.tsx`, `src/components/EmptyState.tsx`
- Create: `src/app/(admin)/layout.tsx`

- [ ] **Step 1: Create `src/components/AdminBottomNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Users, Package, Menu } from "lucide-react";
import { AdminMoreSheet } from "./AdminMoreSheet";

const PRIMARY = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutGrid },
  { href: "/clients",   label: "الزبائن",   icon: Users },
  { href: "/products",  label: "المنتجات",  icon: Package },
] as const;

export function AdminBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = ["/expenses", "/production", "/users", "/reports", "/inventory", "/export", "/ai", "/activity"]
    .some((p) => pathname.startsWith(p));

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-40 print:hidden">
        <ul className="flex justify-around items-center max-w-md mx-auto">
          {PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link href={href} className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-cairo font-semibold ${active ? "text-primary" : "text-muted"}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-cairo font-semibold ${moreActive ? "text-primary" : "text-muted"}`}
            >
              <Menu size={20} strokeWidth={moreActive ? 2.5 : 2} />
              <span>المزيد</span>
            </button>
          </li>
        </ul>
      </nav>
      <AdminMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Create `src/components/AdminMoreSheet.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Receipt, Factory, UserCog, BarChart3, ClipboardList, Download, Sparkles, Bell, LogOut } from "lucide-react";

interface Props { open: boolean; onClose: () => void }

const ITEMS = [
  { href: "/expenses",   label: "المصاريف",  icon: Receipt },
  { href: "/production", label: "الإنتاج والفاقد", icon: Factory },
  { href: "/users",      label: "الموظفين",  icon: UserCog },
  { href: "/reports",    label: "التقارير (قريباً)",  icon: BarChart3, disabled: true },
  { href: "/inventory",  label: "الجرد (قريباً)",     icon: ClipboardList, disabled: true },
  { href: "/export",     label: "تصدير (قريباً)",    icon: Download, disabled: true },
  { href: "/ai",         label: "اسأل بياناتك (قريباً)", icon: Sparkles, disabled: true },
  { href: "/activity",   label: "الإشعارات (قريباً)",  icon: Bell, disabled: true },
] as const;

export function AdminMoreSheet({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo font-bold text-ink text-base">المزيد</h3>
          <button onClick={onClose} className="text-muted text-xs font-cairo">إغلاق</button>
        </div>
        <ul className="grid grid-cols-2 gap-2 mb-4">
          {ITEMS.map(({ href, label, icon: Icon, disabled }) => disabled ? (
            <li key={href}>
              <div className="flex flex-col items-center gap-1.5 bg-info-bg/40 border border-border rounded-xl p-4 text-muted opacity-60 cursor-not-allowed">
                <Icon size={22} />
                <span className="font-cairo text-xs">{label}</span>
              </div>
            </li>
          ) : (
            <li key={href}>
              <Link href={href} onClick={onClose} className="flex flex-col items-center gap-1.5 bg-info-bg/40 border border-border rounded-xl p-4 text-primary-dk hover:bg-info-bg">
                <Icon size={22} />
                <span className="font-cairo text-xs font-semibold">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <form action="/logout" method="post">
          <button type="submit" className="w-full rounded-xl bg-red-50 text-danger border border-red-200 font-cairo font-bold py-3 flex items-center justify-center gap-2">
            <LogOut size={18} /> خروج
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/EmptyState.tsx`**

```tsx
import Link from "next/link";
import { type LucideIcon, Plus } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
}

export function EmptyState({ icon: Icon, title, subtitle, ctaHref, ctaLabel }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-16 h-16 rounded-full bg-info-bg flex items-center justify-center mb-3">
        <Icon size={28} className="text-primary-dk" />
      </div>
      <h3 className="font-cairo font-semibold text-ink text-base">{title}</h3>
      {subtitle && <p className="text-muted text-xs mt-1 font-cairo">{subtitle}</p>}
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="mt-4 inline-flex items-center gap-1.5 bg-primary text-white font-cairo font-semibold text-sm px-4 py-2 rounded-xl">
          <Plus size={16} /> {ctaLabel}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/(admin)/layout.tsx`**

```tsx
import { getCurrentUserWithRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { AdminBottomNav } from "@/components/AdminBottomNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserWithRole();
  if (!user || user.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen pb-20">
      <BrandHeader subtitle={`مرحباً ${user.full_name} · المدير`} />
      <main className="max-w-md mx-auto">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
```

- [ ] **Step 5: Smoke test**

```bash
npm run dev
```

Log in as `majdi@alqasr.test`. Should land on `/dashboard` with admin layout: brand header showing "مرحباً مجدي... المدير" + bottom nav with 4 items (Dashboard active, Clients, Products, More). Tap "More" → bottom sheet with 8 items (4 enabled, 4 disabled "(قريباً)") + logout. Stop dev.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminBottomNav.tsx src/components/AdminMoreSheet.tsx src/components/EmptyState.tsx "src/app/(admin)/layout.tsx"
git commit -m "feat(admin): shell layout with bottom nav + more sheet + empty state"
```

---

## Task 4: Products module — list + form + actions

**Files:**
- Create: `src/components/ProductForm.tsx`, `src/components/PackageInputRow.tsx`
- Create: `src/app/(admin)/products/page.tsx`, `src/app/(admin)/products/new/page.tsx`, `src/app/(admin)/products/[id]/page.tsx`, `src/app/(admin)/products/actions.ts`

- [ ] **Step 1: Create `src/app/(admin)/products/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { validateProductInput, validatePackageInput, type ProductInput, type PackageInput } from "@/lib/admin-validation";
import { revalidatePath } from "next/cache";

export interface ProductWithPackages {
  product: ProductInput & { is_active?: boolean };
  packages: Array<PackageInput & { is_active?: boolean }>;
}

export async function createProduct(input: ProductWithPackages): Promise<{ id?: string; error?: string }> {
  const pv = validateProductInput(input.product);
  if (!pv.ok) return { error: pv.error };
  for (const pkg of input.packages) {
    const v = validatePackageInput(pkg);
    if (!v.ok) return { error: `عبوة "${pkg.package_name}": ${v.error}` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .insert({
      name_ar:    input.product.name_ar.trim(),
      base_unit:  input.product.base_unit as "L" | "kg" | "piece",
      base_price: input.product.base_price,
      base_cost:  input.product.base_cost,
    })
    .select("id, name_ar")
    .single();

  if (prodErr || !product) return { error: prodErr?.message ?? "تعذّر إنشاء المنتج" };

  if (input.packages.length > 0) {
    const { error: pkgErr } = await supabase.from("product_packages").insert(
      input.packages.map((pkg) => ({
        product_id:   product.id,
        package_name: pkg.package_name.trim(),
        contains_qty: pkg.contains_qty,
        package_price: pkg.package_price,
      })),
    );
    if (pkgErr) {
      await supabase.from("products").delete().eq("id", product.id);
      return { error: pkgErr.message };
    }
  }

  await logActivity(supabase, {
    actor_id: user.id, action: "product_added",
    entity_type: "product", entity_id: product.id,
    summary_ar: `أضاف منتج جديد: ${product.name_ar}`,
    payload: { packages_count: input.packages.length },
  });

  revalidatePath("/products");
  return { id: product.id };
}

export async function updateProduct(productId: string, input: ProductWithPackages): Promise<{ error?: string }> {
  const pv = validateProductInput(input.product);
  if (!pv.ok) return { error: pv.error };
  for (const pkg of input.packages) {
    const v = validatePackageInput(pkg);
    if (!v.ok) return { error: `عبوة "${pkg.package_name}": ${v.error}` };
  }

  const supabase = await createClient();

  const { error: prodErr } = await supabase
    .from("products")
    .update({
      name_ar:    input.product.name_ar.trim(),
      base_unit:  input.product.base_unit as "L" | "kg" | "piece",
      base_price: input.product.base_price,
      base_cost:  input.product.base_cost,
      is_active:  input.product.is_active ?? true,
    })
    .eq("id", productId);

  if (prodErr) return { error: prodErr.message };

  // Strategy for packages: delete-then-reinsert is simple but loses package_id stability
  // (visit_lines reference package_id). Instead we soft-deactivate removed packages
  // and upsert the rest.
  // For Phase 3 simplicity: only add/edit packages here; deletion uses deletePackage().
  // The form passes only currently-shown packages (existing edited + brand-new with no id).
  // Items already in DB but not in the form list are NOT touched.
  // To delete a package, the user clicks its delete button -> calls deletePackage().

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return {};
}

export async function deleteProduct(productId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  // Check usage — soft-disable if used in visit_lines, hard-delete otherwise
  const { count } = await supabase
    .from("visit_lines")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", productId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return { error: error.message };
  }

  revalidatePath("/products");
  return {};
}

export async function addPackage(productId: string, pkg: PackageInput): Promise<{ id?: string; error?: string }> {
  const v = validatePackageInput(pkg);
  if (!v.ok) return { error: v.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_packages")
    .insert({
      product_id:    productId,
      package_name:  pkg.package_name.trim(),
      contains_qty:  pkg.contains_qty,
      package_price: pkg.package_price,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "تعذّر الإضافة" };
  revalidatePath(`/products/${productId}`);
  return { id: data.id };
}

export async function updatePackage(packageId: string, pkg: PackageInput): Promise<{ error?: string }> {
  const v = validatePackageInput(pkg);
  if (!v.ok) return { error: v.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_packages")
    .update({
      package_name:  pkg.package_name.trim(),
      contains_qty:  pkg.contains_qty,
      package_price: pkg.package_price,
    })
    .eq("id", packageId);
  if (error) return { error: error.message };
  return {};
}

export async function deletePackage(packageId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Soft-disable if referenced; hard-delete otherwise
  const { count } = await supabase
    .from("visit_lines")
    .select("id", { count: "exact", head: true })
    .eq("package_id", packageId);
  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("product_packages").update({ is_active: false }).eq("id", packageId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("product_packages").delete().eq("id", packageId);
    if (error) return { error: error.message };
  }
  return {};
}
```

- [ ] **Step 2: Create `src/components/PackageInputRow.tsx`**

```tsx
"use client";

import { X } from "lucide-react";

export interface PackageDraft {
  id?: string;            // present if existing in DB
  package_name: string;
  contains_qty: string;   // string for empty-clearable inputs (parsed at submit)
  package_price: string;
}

interface Props {
  pkg: PackageDraft;
  onChange: (p: PackageDraft) => void;
  onRemove: () => void;
}

export function PackageInputRow({ pkg, onChange, onRemove }: Props) {
  return (
    <div className="bg-info-bg/40 border border-border rounded-xl p-3 grid grid-cols-12 gap-2 items-center">
      <input
        type="text"
        placeholder="اسم العبوة (مثل: كرتونة)"
        value={pkg.package_name}
        onChange={(e) => onChange({ ...pkg, package_name: e.target.value })}
        className="col-span-5 rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-cairo focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="number"
        inputMode="decimal" step="any" min="0"
        placeholder="يحتوي"
        value={pkg.contains_qty}
        onChange={(e) => onChange({ ...pkg, contains_qty: e.target.value })}
        className="col-span-3 rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-cairo text-center focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="number"
        inputMode="decimal" step="any" min="0"
        placeholder="السعر"
        value={pkg.package_price}
        onChange={(e) => onChange({ ...pkg, package_price: e.target.value })}
        className="col-span-3 rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-cairo text-center focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="حذف العبوة"
        className="col-span-1 text-muted hover:text-danger flex justify-center"
      >
        <X size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/ProductForm.tsx`** (shared by /new and /[id])

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PackageInputRow, type PackageDraft } from "./PackageInputRow";
import { createProduct, updateProduct, addPackage, updatePackage, deletePackage } from "@/app/(admin)/products/actions";
import type { Unit } from "@/lib/format";

export interface ProductFormInitial {
  id?: string;
  name_ar: string;
  base_unit: Unit;
  base_price: string;
  base_cost: string;
  is_active: boolean;
  packages: PackageDraft[];
}

export function ProductForm({ initial }: { initial: ProductFormInitial }) {
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [name_ar, setNameAr]     = useState(initial.name_ar);
  const [base_unit, setUnit]     = useState<Unit>(initial.base_unit);
  const [base_price, setPrice]   = useState(initial.base_price);
  const [base_cost, setCost]     = useState(initial.base_cost);
  const [is_active, setActive]   = useState(initial.is_active);
  const [packages, setPackages]  = useState<PackageDraft[]>(initial.packages);
  const [error, setError]        = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addRow() {
    setPackages([...packages, { package_name: "", contains_qty: "", package_price: "" }]);
  }

  function updateRow(idx: number, p: PackageDraft) {
    setPackages(packages.map((x, i) => i === idx ? p : x));
  }

  function removeRow(idx: number) {
    const p = packages[idx];
    if (p.id) {
      // existing — call delete action
      startTransition(async () => {
        const res = await deletePackage(p.id!);
        if (res.error) { setError(res.error); return; }
        setPackages(packages.filter((_, i) => i !== idx));
      });
    } else {
      setPackages(packages.filter((_, i) => i !== idx));
    }
  }

  function submit() {
    setError(null);
    const priceNum = Number(base_price);
    const costNum  = base_cost.trim() === "" ? null : Number(base_cost);

    const productPayload = {
      name_ar, base_unit, base_price: priceNum, base_cost: costNum, is_active,
    };

    const newPackagePayloads = packages.filter((p) => !p.id).map((p) => ({
      package_name:  p.package_name,
      contains_qty:  Number(p.contains_qty),
      package_price: Number(p.package_price),
    }));
    const existingPackagePayloads = packages.filter((p) => p.id).map((p) => ({
      id: p.id!,
      package_name:  p.package_name,
      contains_qty:  Number(p.contains_qty),
      package_price: Number(p.package_price),
    }));

    startTransition(async () => {
      try {
        if (editing) {
          const res = await updateProduct(initial.id!, { product: productPayload, packages: newPackagePayloads });
          if (res.error) { setError(res.error); return; }
          // Upsert each existing package via updatePackage
          for (const pkg of existingPackagePayloads) {
            const upd = await updatePackage(pkg.id, {
              package_name: pkg.package_name, contains_qty: pkg.contains_qty, package_price: pkg.package_price,
            });
            if (upd.error) { setError(upd.error); return; }
          }
          // Add brand-new ones
          for (const pkg of newPackagePayloads) {
            const ins = await addPackage(initial.id!, pkg);
            if (ins.error) { setError(ins.error); return; }
          }
        } else {
          const res = await createProduct({ product: productPayload, packages: newPackagePayloads });
          if (res.error) { setError(res.error); return; }
          if (!res.id)    { setError("استجابة غير متوقعة"); return; }
        }
        router.push("/products");
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      }
    });
  }

  return (
    <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">اسم المنتج *</label>
        <input value={name_ar} onChange={(e) => setNameAr(e.target.value)} required
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="block text-xs font-cairo text-ink mb-1">الوحدة *</label>
          <select value={base_unit} onChange={(e) => setUnit(e.target.value as Unit)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="L">لتر</option>
            <option value="kg">كيلو</option>
            <option value="piece">قطعة</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-cairo text-ink mb-1">السعر *</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={base_price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-xs font-cairo text-ink mb-1">التكلفة</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={base_cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm font-cairo text-ink">
          <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
          فعّال (يظهر للموظفين عند إنشاء زيارة)
        </label>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-cairo font-semibold text-ink text-sm">العبوات</h4>
          <button type="button" onClick={addRow} className="text-primary text-xs font-cairo font-semibold flex items-center gap-1">
            <Plus size={14} /> إضافة عبوة
          </button>
        </div>
        {packages.length === 0 && (
          <p className="text-muted text-xs font-cairo">لا توجد عبوات. سيُباع المنتج بالوحدة المفردة فقط.</p>
        )}
        <div className="space-y-2">
          {packages.map((pkg, idx) => (
            <PackageInputRow key={pkg.id ?? `new-${idx}`} pkg={pkg}
              onChange={(p) => updateRow(idx, p)} onRemove={() => removeRow(idx)} />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>
      )}

      <button onClick={submit} disabled={pending}
        className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
        {pending ? "جارٍ الحفظ..." : (editing ? "حفظ التغييرات" : "إضافة المنتج")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/(admin)/products/new/page.tsx`**

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductForm } from "@/components/ProductForm";

export default function NewProduct() {
  return (
    <div className="p-4">
      <Link href="/products" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">منتج جديد</h2>
      <ProductForm initial={{
        name_ar: "", base_unit: "L", base_price: "", base_cost: "", is_active: true, packages: [],
      }} />
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/(admin)/products/[id]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductForm } from "@/components/ProductForm";
import type { Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [productRes, packagesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("product_packages").select("*").eq("product_id", id).eq("is_active", true).order("created_at"),
  ]);

  if (productRes.error || !productRes.data) return notFound();
  const p = productRes.data;

  return (
    <div className="p-4">
      <Link href="/products" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">تعديل المنتج: {p.name_ar}</h2>
      <ProductForm initial={{
        id: p.id,
        name_ar: p.name_ar,
        base_unit: p.base_unit as Unit,
        base_price: String(p.base_price),
        base_cost: p.base_cost === null ? "" : String(p.base_cost),
        is_active: p.is_active,
        packages: (packagesRes.data ?? []).map((pkg) => ({
          id: pkg.id,
          package_name: pkg.package_name,
          contains_qty: String(pkg.contains_qty),
          package_price: String(pkg.package_price),
        })),
      }} />
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/(admin)/products/page.tsx`** (list)

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Package, Edit3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatQty, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ProductRow {
  id: string; name_ar: string; base_unit: Unit; base_price: number; is_active: boolean;
  product_packages: { id: string; package_name: string; contains_qty: number; package_price: number; is_active: boolean }[];
}

export default async function ProductsList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name_ar, base_unit, base_price, is_active, product_packages(id, package_name, contains_qty, package_price, is_active)")
    .order("name_ar");
  const products = (data ?? []) as unknown as ProductRow[];

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">المنتجات ({products.length})</h2>
        <Link href="/products/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> منتج جديد
        </Link>
      </div>

      {products.length === 0 ? (
        <EmptyState icon={Package} title="لا توجد منتجات بعد" subtitle="ابدأ بإضافة لبن، لبنة، جبنة..." ctaHref="/products/new" ctaLabel="إضافة أول منتج" />
      ) : (
        <ul className="px-3 space-y-2">
          {products.map((p) => {
            const activePackages = p.product_packages.filter((pk) => pk.is_active);
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="block bg-white border border-border rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-cairo font-semibold text-ink text-sm">
                      {p.name_ar}
                      {!p.is_active && <span className="text-[9px] mr-2 text-muted font-cairo">(معطّل)</span>}
                    </h3>
                    <span className="text-primary text-xs font-cairo font-bold">
                      {formatCurrency(p.base_price)} / {p.base_unit === "L" ? "لتر" : p.base_unit === "kg" ? "كيلو" : "قطعة"}
                    </span>
                  </div>
                  {activePackages.length > 0 && (
                    <p className="text-[10px] text-muted font-cairo">
                      {activePackages.length} عبوة: {activePackages.map((pk) => `${pk.package_name} ${formatCurrency(pk.package_price)}`).join(" · ")}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-primary mt-1.5 font-cairo">
                    <Edit3 size={11} /> تعديل
                  </div>
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

- [ ] **Step 7: Smoke test**

`npm run dev` → log in as Majdi → tap "المنتجات" in bottom nav → see 3 seeded products. Tap لبن → see edit form with 1 package (كرتونة 24 لتر). Add a new package "علبة كبيرة" / 5 / 24, save. Reload list → 2 packages shown. Click "منتج جديد" → fill name "زبادي" / kg / 8 / 4 / add 1 package "علبة" / 0.5 / 5 → save. List shows 4 products. Stop dev.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(admin)/products" src/components/ProductForm.tsx src/components/PackageInputRow.tsx
git commit -m "feat(admin): products CRUD with inline packages"
```

---

## Task 5: Clients admin module — list with pending + edit + delete

**Files:**
- Create: `src/components/ClientApprovalCard.tsx`, `src/components/ConfirmDialog.tsx`
- Create: `src/app/(admin)/clients/page.tsx`, `src/app/(admin)/clients/[id]/page.tsx`, `src/app/(admin)/clients/new/page.tsx`, `src/app/(admin)/clients/actions.ts`

- [ ] **Step 1: Create `src/components/ConfirmDialog.tsx`**

```tsx
"use client";

interface Props {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel = "تأكيد", destructive, onConfirm, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-cairo font-bold text-ink text-base">{title}</h3>
        {body && <p className="font-cairo text-sm text-muted mt-2">{body}</p>}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onClose}
            className="rounded-xl border border-border bg-white text-ink font-cairo font-semibold py-2.5">
            إلغاء
          </button>
          <button onClick={() => { onConfirm(); onClose(); }}
            className={`rounded-xl font-cairo font-bold py-2.5 ${destructive ? "bg-danger text-white" : "bg-primary text-white"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(admin)/clients/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

export async function approveClient(clientId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase
    .from("clients").update({ is_approved: true })
    .eq("id", clientId).select("name").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الموافقة" };

  await logActivity(supabase, {
    actor_id: user.id, action: "client_approved",
    entity_type: "client", entity_id: clientId,
    summary_ar: `وافق على الزبون: ${data.name}`, payload: null,
  });
  revalidatePath("/clients");
  return {};
}

export interface ClientEditInput {
  name: string; type: "supermarket" | "market" | "individual";
  phone: string | null; address: string | null; notes: string | null;
}

export async function createClientFull(input: ClientEditInput & { is_approved?: boolean }): Promise<{ id?: string; error?: string }> {
  if (!input.name.trim()) return { error: "الاسم مطلوب" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.from("clients")
    .insert({ ...input, name: input.name.trim(), added_by: user.id, is_approved: input.is_approved ?? true })
    .select("id, name").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الإضافة" };

  revalidatePath("/clients");
  return { id: data.id };
}

export async function updateClient(clientId: string, input: ClientEditInput): Promise<{ error?: string }> {
  if (!input.name.trim()) return { error: "الاسم مطلوب" };
  const supabase = await createClient();
  const { error } = await supabase.from("clients")
    .update({ ...input, name: input.name.trim() }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return {};
}

export async function deleteClient(clientId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { count } = await supabase.from("visits")
    .select("id", { count: "exact", head: true }).eq("client_id", clientId);
  if ((count ?? 0) > 0) {
    return { error: "لا يمكن حذف زبون لديه زيارات سابقة. عطّله أو ادمجه بزبون آخر بدلاً من ذلك." };
  }
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath("/clients");
  return {};
}

export async function mergeClients(primaryId: string, duplicateIds: string[]): Promise<{ moved?: number; error?: string }> {
  if (!primaryId || duplicateIds.length === 0) return { error: "اختر زبون رئيسي وزبون مكرر واحد على الأقل" };
  if (duplicateIds.includes(primaryId)) return { error: "الزبون الرئيسي لا يمكن أن يكون من المكررات" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.rpc("fn_merge_clients", {
    primary_id: primaryId, duplicate_ids: duplicateIds,
  });
  if (error) return { error: error.message };

  const primary = await supabase.from("clients").select("name").eq("id", primaryId).maybeSingle();
  const dupNames = await supabase.from("clients").select("name").in("id", duplicateIds);
  await logActivity(supabase, {
    actor_id: user.id, action: "clients_merged",
    entity_type: "client", entity_id: primaryId,
    summary_ar: `دمج ${duplicateIds.length} زبون مكرر إلى ${primary.data?.name ?? "(زبون)"}: ${(dupNames.data ?? []).map((x) => x.name).join(" · ")}`,
    payload: { primary_id: primaryId, duplicate_ids: duplicateIds, moved_count: data },
  });

  revalidatePath("/clients");
  return { moved: data ?? 0 };
}
```

- [ ] **Step 3: Create `src/components/ClientApprovalCard.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Edit3, Trash2 } from "lucide-react";
import { approveClient, deleteClient } from "@/app/(admin)/clients/actions";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  id: string;
  name: string;
  type: string | null;
  phone: string | null;
  added_by_name: string | null;
}

export function ClientApprovalCard({ id, name, type, phone, added_by_name }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveClient(id);
      if (res.error) setError(res.error);
    });
  }

  function del() {
    setError(null);
    startTransition(async () => {
      const res = await deleteClient(id);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="bg-yellow-50/50 border border-yellow-200 rounded-xl p-3 mb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-cairo font-semibold text-ink text-sm truncate">{name}</h4>
          <p className="text-[10px] text-muted font-cairo mt-0.5">
            {type ?? "—"} · {phone ?? "بدون هاتف"} · أضافه: {added_by_name ?? "?"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2.5">
        <button onClick={approve} disabled={pending}
          className="flex-1 flex items-center justify-center gap-1 bg-primary text-white text-xs font-cairo font-semibold py-1.5 rounded-lg disabled:opacity-60">
          <Check size={12} /> موافقة
        </button>
        <Link href={`/clients/${id}`}
          className="flex items-center justify-center gap-1 bg-white border border-border text-ink text-xs font-cairo font-semibold py-1.5 px-3 rounded-lg">
          <Edit3 size={12} /> تعديل
        </Link>
        <button onClick={() => setConfirmDelete(true)} disabled={pending}
          className="flex items-center justify-center gap-1 bg-white border border-red-200 text-danger text-xs font-cairo font-semibold py-1.5 px-3 rounded-lg disabled:opacity-60">
          <Trash2 size={12} /> حذف
        </button>
      </div>
      {error && <p className="text-danger text-[11px] mt-1.5 font-cairo">{error}</p>}
      <ConfirmDialog
        open={confirmDelete}
        title={`حذف ${name}؟`}
        body="هذا الإجراء نهائي. إذا كان للزبون زيارات سابقة لن يُحذف."
        destructive confirmLabel="حذف"
        onConfirm={del} onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/(admin)/clients/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Users, GitMerge } from "lucide-react";
import { ClientApprovalCard } from "@/components/ClientApprovalCard";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

interface ClientRow {
  id: string; name: string; type: string | null; phone: string | null; address: string | null;
  is_approved: boolean; added_by: string | null; merged_into_client_id: string | null;
  users: { full_name: string } | null;
}

export default async function AdminClientsList() {
  const supabase = await createClient();
  const { data } = await supabase.from("clients")
    .select("id, name, type, phone, address, is_approved, added_by, merged_into_client_id, users(full_name)")
    .is("merged_into_client_id", null).order("created_at", { ascending: false });
  const all = ((data ?? []) as unknown as ClientRow[]);
  const pending  = all.filter((c) => !c.is_approved);
  const approved = all.filter((c) =>  c.is_approved);

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الزبائن ({all.length})</h2>
        <div className="flex gap-1.5">
          <Link href="/clients/merge" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary-dk bg-info-bg px-3 py-1.5 rounded-full border border-border">
            <GitMerge size={14} /> دمج
          </Link>
          <Link href="/clients/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
            <Plus size={14} /> زبون جديد
          </Link>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="px-3 mb-4">
          <h3 className="text-[11px] font-cairo font-bold text-muted uppercase mb-2">بانتظار الموافقة ({pending.length})</h3>
          {pending.map((c) => (
            <ClientApprovalCard key={c.id} id={c.id} name={c.name} type={c.type} phone={c.phone}
              added_by_name={c.users?.full_name ?? null} />
          ))}
        </div>
      )}

      {approved.length === 0 && pending.length === 0 ? (
        <EmptyState icon={Users} title="لا يوجد زبائن بعد" ctaHref="/clients/new" ctaLabel="إضافة أول زبون" />
      ) : approved.length > 0 && (
        <ul className="px-3 space-y-2">
          {approved.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="block bg-white border border-border rounded-2xl p-3">
                <h3 className="font-cairo font-semibold text-ink text-sm">{c.name}</h3>
                <p className="text-[10px] text-muted font-cairo mt-0.5">
                  {c.type ?? "—"} · {c.phone ?? "بدون هاتف"} · {c.address ?? "بدون عنوان"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/(admin)/clients/[id]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClientEditForm } from "@/components/ClientEditForm";

export const dynamic = "force-dynamic";

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error || !data) return notFound();
  return (
    <div className="p-4">
      <Link href="/clients" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">تعديل الزبون: {data.name}</h2>
      <ClientEditForm initial={{
        id: data.id, name: data.name, type: data.type ?? "market",
        phone: data.phone ?? "", address: data.address ?? "", notes: data.notes ?? "",
      }} />
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/ClientEditForm.tsx`** (also used by /new)

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientFull, updateClient } from "@/app/(admin)/clients/actions";

export interface ClientFormInitial {
  id?: string;
  name: string; type: "supermarket" | "market" | "individual";
  phone: string; address: string; notes: string;
}

export function ClientEditForm({ initial }: { initial: ClientFormInitial }) {
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [name, setName]       = useState(initial.name);
  const [type, setType]       = useState(initial.type);
  const [phone, setPhone]     = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes]     = useState(initial.notes);
  const [error, setError]     = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = {
        name, type, phone: phone.trim() || null, address: address.trim() || null, notes: notes.trim() || null,
      };
      const res = editing
        ? await updateClient(initial.id!, payload)
        : await createClientFull(payload);
      if (res.error) setError(res.error);
      else router.push("/clients");
    });
  }

  return (
    <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">الاسم *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">النوع *</label>
        <select value={type} onChange={(e) => setType(e.target.value as ClientFormInitial["type"])}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="supermarket">سوبر ماركت</option>
          <option value="market">محل / بقالة</option>
          <option value="individual">فرد</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">رقم الهاتف</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">العنوان</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-cairo text-ink mb-1">ملاحظات</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}
      <button onClick={submit} disabled={pending}
        className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
        {pending ? "جارٍ الحفظ..." : (editing ? "حفظ التغييرات" : "إضافة الزبون")}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/app/(admin)/clients/new/page.tsx`**

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClientEditForm } from "@/components/ClientEditForm";

export default function NewClient() {
  return (
    <div className="p-4">
      <Link href="/clients" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">زبون جديد</h2>
      <ClientEditForm initial={{ name: "", type: "market", phone: "", address: "", notes: "" }} />
    </div>
  );
}
```

- [ ] **Step 8: Smoke test**

Log in as Majdi → tap "الزبائن" → see admin list. Pending approvals shown (if any). Tap "زبون جديد" → fill, save. Tap a row → edit form opens. Stop dev.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(admin)/clients" src/components/ClientApprovalCard.tsx src/components/ClientEditForm.tsx src/components/ConfirmDialog.tsx
git commit -m "feat(admin): clients list with pending approvals + edit + delete"
```

---

## Task 6: Merge wizard

**Files:**
- Create: `src/app/(admin)/clients/merge/page.tsx`, `src/components/MergeWizard.tsx`

- [ ] **Step 1: Create `src/components/MergeWizard.tsx`**

```tsx
"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mergeClients } from "@/app/(admin)/clients/actions";
import { formatCurrency, formatQty, type Unit } from "@/lib/format";
import { GitMerge } from "lucide-react";

interface ClientRow { id: string; name: string; phone: string | null; type: string | null }
interface MoneyRow  { client_id: string; balance: number }
interface ReplRow   { client_id: string; product_id: string; owed_base_qty: number }
interface ProductRow { id: string; name_ar: string; base_unit: Unit }

export function MergeWizard() {
  const router = useRouter();
  const [clients, setClients]       = useState<ClientRow[]>([]);
  const [moneyMap, setMoneyMap]     = useState<Map<string, number>>(new Map());
  const [replByClient, setReplByClient] = useState<Map<string, ReplRow[]>>(new Map());
  const [products, setProducts]     = useState<Map<string, ProductRow>>(new Map());
  const [visitCount, setVisitCount] = useState<Map<string, number>>(new Map());

  const [primary, setPrimary]       = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [pending, startTransition]  = useTransition();
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [cRes, mRes, rRes, pRes, vRes] = await Promise.all([
        supabase.from("clients").select("id, name, phone, type").is("merged_into_client_id", null).order("name"),
        supabase.from("v_client_money_balance").select("*"),
        supabase.from("v_client_replacement_debt").select("*"),
        supabase.from("products").select("id, name_ar, base_unit"),
        supabase.from("visits").select("client_id"),
      ]);
      setClients((cRes.data ?? []) as ClientRow[]);
      setMoneyMap(new Map(((mRes.data ?? []) as MoneyRow[]).map((x) => [x.client_id, Number(x.balance)])));
      const r = new Map<string, ReplRow[]>();
      for (const row of (rRes.data ?? []) as ReplRow[]) {
        const arr = r.get(row.client_id) ?? []; arr.push(row); r.set(row.client_id, arr);
      }
      setReplByClient(r);
      setProducts(new Map(((pRes.data ?? []) as ProductRow[]).map((x) => [x.id, x])));
      const v = new Map<string, number>();
      for (const row of (vRes.data ?? []) as { client_id: string }[]) {
        v.set(row.client_id, (v.get(row.client_id) ?? 0) + 1);
      }
      setVisitCount(v);
    })();
  }, []);

  function toggleDuplicate(id: string) {
    const n = new Set(duplicates);
    if (n.has(id)) n.delete(id); else n.add(id);
    setDuplicates(n);
  }

  const preview = useMemo(() => {
    if (!primary) return null;
    const all = [primary, ...Array.from(duplicates)];
    const money = all.reduce((s, id) => s + (moneyMap.get(id) ?? 0), 0);
    const visits = all.reduce((s, id) => s + (visitCount.get(id) ?? 0), 0);
    const replAgg = new Map<string, number>();
    for (const id of all) {
      for (const r of (replByClient.get(id) ?? [])) {
        replAgg.set(r.product_id, (replAgg.get(r.product_id) ?? 0) + Number(r.owed_base_qty));
      }
    }
    return { money, visits, replacements: replAgg };
  }, [primary, duplicates, moneyMap, replByClient, visitCount]);

  function confirm() {
    if (!primary || duplicates.size === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await mergeClients(primary, Array.from(duplicates));
      if (res.error) setError(res.error);
      else router.push(`/clients/${primary}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-info-bg/40 border border-border rounded-xl p-3 font-cairo text-xs text-muted">
        اختر الزبون الرئيسي ثم اختر زبون مكرر واحد على الأقل. سيتم نقل كل الزيارات والمدفوعات للزبون الرئيسي، والزبائن المكررين سيختفون من القائمة (مع حفظ تاريخهم).
      </div>

      <div className="bg-white border border-border rounded-2xl p-4">
        <h4 className="font-cairo font-semibold text-ink text-sm mb-3">1. اختر الزبون الرئيسي:</h4>
        <select value={primary ?? ""} onChange={(e) => { setPrimary(e.target.value || null); setDuplicates(new Set()); }}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-cairo">
          <option value="">— اختر —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>)}
        </select>
      </div>

      {primary && (
        <div className="bg-white border border-border rounded-2xl p-4">
          <h4 className="font-cairo font-semibold text-ink text-sm mb-3">2. اختر الزبائن المكررين:</h4>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {clients.filter((c) => c.id !== primary).map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 p-2.5 border border-border rounded-lg cursor-pointer hover:bg-info-bg/40">
                  <input type="checkbox" checked={duplicates.has(c.id)} onChange={() => toggleDuplicate(c.id)} />
                  <span className="flex-1 font-cairo text-sm text-ink">
                    {c.name}{c.phone ? ` (${c.phone})` : ""} · {visitCount.get(c.id) ?? 0} زيارة
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && duplicates.size > 0 && (
        <div className="bg-forest text-white rounded-2xl p-4">
          <h4 className="font-cairo font-bold text-base mb-2 flex items-center gap-2">
            <GitMerge size={18} /> معاينة الدمج
          </h4>
          <ul className="space-y-1 text-sm font-cairo">
            <li>إجمالي الزيارات بعد الدمج: <strong>{preview.visits}</strong></li>
            <li>إجمالي الديون: <strong>{formatCurrency(preview.money)}</strong></li>
            <li>
              إجمالي البدائل المستحقة:
              {preview.replacements.size === 0 ? " لا يوجد" : (
                <ul className="mt-1 mr-3 text-xs">
                  {Array.from(preview.replacements.entries()).map(([pid, qty]) => {
                    const p = products.get(pid);
                    return <li key={pid}>· {p?.name_ar ?? "?"}: {formatQty(qty, p?.base_unit ?? "piece")}</li>;
                  })}
                </ul>
              )}
            </li>
          </ul>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}

      <button onClick={confirm} disabled={!primary || duplicates.size === 0 || pending}
        className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
        {pending ? "جارٍ الدمج..." : `دمج ${duplicates.size} زبون`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(admin)/clients/merge/page.tsx`**

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MergeWizard } from "@/components/MergeWizard";

export default function MergePage() {
  return (
    <div className="p-4">
      <Link href="/clients" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">دمج زبائن مكررين</h2>
      <MergeWizard />
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Create 2 dummy duplicate clients ("محل التجربة 1" / "محل التجربة 2") via the quick-add as employee or admin → then back as admin → /clients/merge → pick #1 as primary, check #2, see preview → confirm merge. Both should reduce to 1 in the clients list. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/clients/merge" src/components/MergeWizard.tsx
git commit -m "feat(admin): client merge wizard via fn_merge_clients RPC"
```

---

## Task 7: Expenses module (with photo upload)

**Files:**
- Create: `src/components/ReceiptPhotoInput.tsx`
- Create: `src/app/(admin)/expenses/page.tsx`, `src/app/(admin)/expenses/new/page.tsx`, `src/app/(admin)/expenses/actions.ts`

- [ ] **Step 1: Create `src/app/(admin)/expenses/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { validateExpenseInput } from "@/lib/admin-validation";
import { revalidatePath } from "next/cache";

export interface NewExpenseInput {
  category: "fuel" | "salary" | "rent" | "milk" | "other";
  amount: number;
  spent_at: string;          // ISO
  note: string | null;
  receipt_url: string | null;
}

export async function createExpense(input: NewExpenseInput): Promise<{ id?: string; error?: string }> {
  const v = validateExpenseInput({ category: input.category, amount: input.amount });
  if (!v.ok) return { error: v.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.from("expenses").insert({
    ...input, recorded_by: user.id,
  }).select("id").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الحفظ" };

  await logActivity(supabase, {
    actor_id: user.id, action: "expense_added",
    entity_type: "expense", entity_id: data.id,
    summary_ar: `سجّل مصروف ${input.category}: ${input.amount} ₪`,
    payload: { category: input.category, amount: input.amount },
  });

  revalidatePath("/expenses");
  return { id: data.id };
}

export async function deleteExpense(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return {};
}
```

- [ ] **Step 2: Create `src/components/ReceiptPhotoInput.tsx`**

```tsx
"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, X } from "lucide-react";

interface Props {
  onUploaded: (publicUrl: string | null) => void;
}

export function ReceiptPhotoInput({ onUploaded }: Props) {
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("الملف كبير جداً (الحد 5MB)"); return; }
    setError(null);
    setUploading(true);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (upErr) { setError(upErr.message); setUploading(false); return; }

    const { data: signed, error: signErr } = await supabase.storage.from("receipts")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);   // 10-year signed url is fine; bucket is private
    if (signErr || !signed) { setError(signErr?.message ?? "تعذّر إنشاء رابط"); setUploading(false); return; }

    setPreviewUrl(signed.signedUrl);
    onUploaded(signed.signedUrl);
    setUploading(false);
  }

  function clear() {
    setPreviewUrl(null);
    onUploaded(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="hidden"
      />
      {!previewUrl ? (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 text-muted font-cairo text-sm hover:bg-info-bg/40 disabled:opacity-60">
          <Camera size={20} /> {uploading ? "جارٍ الرفع..." : "إرفاق صورة الفاتورة"}
        </button>
      ) : (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="صورة الفاتورة" className="w-full h-48 object-cover rounded-xl border border-border" />
          <button type="button" onClick={clear}
            className="absolute top-2 left-2 bg-black/60 text-white rounded-full p-1.5">
            <X size={14} />
          </button>
        </div>
      )}
      {error && <p className="text-danger text-[11px] mt-2 font-cairo">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(admin)/expenses/new/page.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReceiptPhotoInput } from "@/components/ReceiptPhotoInput";
import { createExpense } from "./actions";

type Category = "fuel" | "salary" | "rent" | "milk" | "other";

const LABELS: Record<Category, string> = {
  fuel: "وقود", salary: "رواتب", rent: "إيجار", milk: "حليب خام", other: "أخرى",
};

export default function NewExpense() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("fuel");
  const [amount, setAmount]     = useState("");
  const [spentAt, setSpentAt]   = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote]         = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createExpense({
        category, amount: Number(amount),
        spent_at: new Date(spentAt + "T12:00:00").toISOString(),
        note: note.trim() || null,
        receipt_url: receiptUrl,
      });
      if (res.error) setError(res.error);
      else router.push("/expenses");
    });
  }

  return (
    <div className="p-4">
      <Link href="/expenses" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">مصروف جديد</h2>
      <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">التصنيف *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary">
            {(Object.keys(LABELS) as Category[]).map((c) => <option key={c} value={c}>{LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">المبلغ (₪) *</label>
          <input type="number" inputMode="decimal" step="any" min="0" value={amount}
            onChange={(e) => setAmount(e.target.value)} required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink text-center font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">التاريخ</label>
          <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} dir="ltr"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <ReceiptPhotoInput onUploaded={setReceiptUrl} />
        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}
        <button onClick={submit} disabled={pending || !amount}
          className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
          {pending ? "جارٍ الحفظ..." : "حفظ المصروف"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/(admin)/expenses/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { fuel: "وقود", salary: "رواتب", rent: "إيجار", milk: "حليب خام", other: "أخرى" };

export default async function ExpensesList() {
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("*").order("spent_at", { ascending: false }).limit(100);
  const expenses = data ?? [];
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">المصاريف ({expenses.length})</h2>
        <Link href="/expenses/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> مصروف جديد
        </Link>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="لا توجد مصاريف بعد" ctaHref="/expenses/new" ctaLabel="إضافة أول مصروف" />
      ) : (
        <>
          <div className="mx-3 mb-3 bg-forest text-white rounded-xl p-3 text-center">
            <div className="text-[11px] opacity-80 font-cairo">المجموع المعروض</div>
            <div className="font-cairo font-extrabold text-xl mt-1">{formatCurrency(total)}</div>
          </div>
          <ul className="px-3 space-y-2">
            {expenses.map((e) => (
              <li key={e.id} className="bg-white border border-border rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-cairo font-semibold text-ink text-sm">{LABELS[e.category] ?? e.category}</div>
                  <div className="text-[10px] text-muted font-cairo mt-0.5">
                    {formatDateShort(new Date(e.spent_at))}{e.note ? ` · ${e.note}` : ""}{e.receipt_url ? " · 📷" : ""}
                  </div>
                </div>
                <div className="font-cairo font-bold text-warn text-sm">{formatCurrency(Number(e.amount))}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Smoke test**

Log in as Majdi → "المزيد" → "المصاريف" → "مصروف جديد" → fill (e.g., fuel / 50 / today / "محطة عرّابة" / optionally a photo from your camera roll) → save. List shows 1 entry with total 50 ₪.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/expenses" src/components/ReceiptPhotoInput.tsx
git commit -m "feat(admin): expenses module + receipt photo upload (Supabase Storage)"
```

---

## Task 8: Production module

**Files:**
- Create: `src/app/(admin)/production/page.tsx`, `src/app/(admin)/production/new/page.tsx`, `src/app/(admin)/production/actions.ts`

- [ ] **Step 1: Create `src/app/(admin)/production/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { validateProductionInput } from "@/lib/admin-validation";
import { revalidatePath } from "next/cache";

export interface NewProductionInput {
  product_id: string;
  qty_produced: number;
  qty_wasted: number;
  produced_at: string;
  note: string | null;
}

export async function createProductionEntry(input: NewProductionInput): Promise<{ id?: string; error?: string }> {
  const v = validateProductionInput({ product_id: input.product_id, qty_produced: input.qty_produced, qty_wasted: input.qty_wasted });
  if (!v.ok) return { error: v.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data, error } = await supabase.from("production").insert({
    ...input, recorded_by: user.id,
  }).select("id").single();
  if (error || !data) return { error: error?.message ?? "تعذّر الحفظ" };

  const pName = (await supabase.from("products").select("name_ar").eq("id", input.product_id).maybeSingle()).data?.name_ar ?? "?";
  await logActivity(supabase, {
    actor_id: user.id, action: "production_recorded",
    entity_type: "production", entity_id: data.id,
    summary_ar: `سجّل إنتاج ${pName}: ${input.qty_produced}، فاقد ${input.qty_wasted}`,
    payload: { product_id: input.product_id, qty_produced: input.qty_produced, qty_wasted: input.qty_wasted },
  });

  revalidatePath("/production");
  return { id: data.id };
}
```

- [ ] **Step 2: Create `src/app/(admin)/production/new/page.tsx`**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProductionEntry } from "./actions";

interface Product { id: string; name_ar: string; base_unit: "L" | "kg" | "piece" }

export default function NewProduction() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [produced, setProduced] = useState("");
  const [wasted, setWasted]     = useState("0");
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote]         = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.from("products").select("id, name_ar, base_unit").eq("is_active", true).order("name_ar")
      .then(({ data }) => {
        const list = (data ?? []) as Product[];
        setProducts(list);
        if (list.length > 0) setProductId(list[0].id);
      });
  }, []);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createProductionEntry({
        product_id: productId,
        qty_produced: Number(produced),
        qty_wasted: Number(wasted),
        produced_at: new Date(date + "T12:00:00").toISOString(),
        note: note.trim() || null,
      });
      if (res.error) setError(res.error);
      else router.push("/production");
    });
  }

  return (
    <div className="p-4">
      <Link href="/production" className="flex items-center gap-1 text-xs text-muted mb-3 font-cairo">
        <ArrowRight size={14} className="rotate-180" /> رجوع
      </Link>
      <h2 className="font-cairo font-bold text-forest text-lg mb-4">تسجيل إنتاج</h2>
      <div className="space-y-4 bg-white border border-border rounded-2xl p-5">
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">المنتج *</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo">
            {products.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-cairo text-ink mb-1">الكمية المنتجة *</label>
            <input type="number" inputMode="decimal" step="any" min="0" value={produced}
              onChange={(e) => setProduced(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo" />
          </div>
          <div>
            <label className="block text-sm font-cairo text-ink mb-1">الفاقد</label>
            <input type="number" inputMode="decimal" step="any" min="0" value={wasted}
              onChange={(e) => setWasted(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-ink text-center font-cairo" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink font-cairo" />
        </div>
        <div>
          <label className="block text-sm font-cairo text-ink mb-1">ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink" />
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3 font-cairo">{error}</div>}
        <button onClick={submit} disabled={pending || !produced || !productId}
          className="w-full rounded-xl bg-primary text-white font-cairo font-bold py-3 shadow-sm hover:bg-primary-dk disabled:opacity-60">
          {pending ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(admin)/production/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Factory } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatDateShort, formatQty, type Unit } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Row {
  id: string; qty_produced: number; qty_wasted: number; produced_at: string; note: string | null;
  products: { name_ar: string; base_unit: Unit } | null;
}

export default async function ProductionList() {
  const supabase = await createClient();
  const { data } = await supabase.from("production")
    .select("id, qty_produced, qty_wasted, produced_at, note, products(name_ar, base_unit)")
    .order("produced_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الإنتاج والفاقد ({rows.length})</h2>
        <Link href="/production/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> تسجيل جديد
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Factory} title="لا توجد سجلات إنتاج" ctaHref="/production/new" ctaLabel="تسجيل أول إنتاج" />
      ) : (
        <ul className="px-3 space-y-2">
          {rows.map((r) => {
            const unit = r.products?.base_unit ?? "piece";
            return (
              <li key={r.id} className="bg-white border border-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="font-cairo font-semibold text-ink text-sm">{r.products?.name_ar ?? "?"}</div>
                  <div className="text-[10px] text-muted font-cairo">{formatDateShort(new Date(r.produced_at))}</div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs font-cairo">
                  <span className="text-primary">منتج: <strong>{formatQty(Number(r.qty_produced), unit)}</strong></span>
                  {Number(r.qty_wasted) > 0 && (
                    <span className="text-warn">فاقد: <strong>{formatQty(Number(r.qty_wasted), unit)}</strong></span>
                  )}
                </div>
                {r.note && <p className="text-[10px] text-muted mt-1 font-cairo">{r.note}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

"المزيد" → "الإنتاج والفاقد" → "تسجيل جديد" → لبن / produced 50 / wasted 2 → save. List shows entry. Stop dev.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/production"
git commit -m "feat(admin): production & waste daily entry + list"
```

---

## Task 9: Users management

**Files:**
- Create: `src/app/(admin)/users/page.tsx`, `src/app/(admin)/users/new/page.tsx`, `src/app/(admin)/users/actions.ts`

Note: Supabase admin user creation requires the **service-role key** (not the anon key the user session uses). This task uses `process.env.SUPABASE_SERVICE_ROLE_KEY` server-side via a separate admin client.

- [ ] **Step 1: Create `src/lib/supabase/admin.ts`**

```typescript
import { createClient as createSupaClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Service-role client — bypasses RLS. ONLY use from Server Actions/Routes after
 * verifying the caller is admin. NEVER expose to client components.
 */
export function createAdminClient() {
  return createSupaClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

- [ ] **Step 2: Create `src/app/(admin)/users/actions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface InviteUserInput {
  email: string;
  full_name: string;
  password: string;
  role: "admin" | "employee";
}

export async function inviteUser(input: InviteUserInput): Promise<{ id?: string; error?: string }> {
  if (!input.email || !input.password) return { error: "البريد وكلمة المرور مطلوبان" };
  if (input.password.length < 8) return { error: "كلمة المرور لا تقل عن 8 أحرف" };

  // Verify caller is admin (defense in depth)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };
  const { data: callerProfile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") return { error: "ممنوع. للمدراء فقط" };

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, role: input.role },
  });
  if (createErr || !created.user) return { error: createErr?.message ?? "تعذّر الإنشاء" };

  // The DB trigger from migration 0002 mirrors auth.users → public.users with role from metadata.
  // For safety, also UPDATE in case the trigger ran with a default.
  await admin.from("users").update({
    full_name: input.full_name, role: input.role,
  }).eq("id", created.user.id);

  revalidatePath("/users");
  return { id: created.user.id };
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ is_active: isActive }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/users");
  return {};
}
```

- [ ] **Step 3: Create `src/app/(admin)/users/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { UserRow } from "@/components/UserRow";

export const dynamic = "force-dynamic";

export default async function UsersList() {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").order("created_at");
  const users = data ?? [];
  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base">الموظفون ({users.length})</h2>
        <Link href="/users/new" className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border">
          <Plus size={14} /> دعوة موظف
        </Link>
      </div>
      {users.length === 0 ? (
        <EmptyState icon={UserCog} title="لا يوجد موظفون" />
      ) : (
        <ul className="px-3 space-y-2">
          {users.map((u) => <li key={u.id}><UserRow user={u} /></li>)}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/UserRow.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toggleUserActive } from "@/app/(admin)/users/actions";

interface User { id: string; email: string; full_name: string; role: string; is_active: boolean }

export function UserRow({ user }: { user: User }) {
  const [active, setActive] = useState(user.is_active);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await toggleUserActive(user.id, !active);
      if (!res.error) setActive(!active);
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="font-cairo font-semibold text-ink text-sm">{user.full_name || user.email}</div>
        <div className="text-[10px] text-muted font-cairo mt-0.5" dir="ltr">{user.email}</div>
        <div className="text-[10px] text-primary-dk font-cairo mt-0.5">{user.role === "admin" ? "مدير" : "موظف توزيع"}</div>
      </div>
      <button onClick={toggle} disabled={pending}
        className={`text-xs font-cairo font-semibold px-3 py-1.5 rounded-full border ${
          active ? "bg-info-bg text-primary border-border" : "bg-red-50 text-danger border-red-200"
        }`}>
        {active ? "فعّال" : "موقوف"}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/(admin)/users/new/page.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { inviteUser } from "./actions";

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
```

- [ ] **Step 6: Smoke test**

"المزيد" → "الموظفين" → list shows Majdi + Emp. "دعوة موظف" → create a test user → success → appears in list. Toggle active. Stop dev.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(admin)/users" src/lib/supabase/admin.ts src/components/UserRow.tsx
git commit -m "feat(admin): users management — invite + activate/deactivate"
```

---

## Task 10: Full E2E + tag v0.3.0-phase3

- [ ] **Step 1: Run tests + build**

```bash
cd "F:/Projects/Cloned/08_OtherProjects/alban-al-qasr"
npm test
npm run build
```

Both must pass.

- [ ] **Step 2: Manual E2E on local dev**

Log in as `majdi@alqasr.test` (admin) and verify:

1. ✅ Admin layout: brand header + bottom nav (Dashboard/Clients/Products/More)
2. ✅ Tap "More" → sheet with Expenses/Production/Users/disabled-Phase4/5 items + logout
3. ✅ Products: list shows seeded 3 + edit form works (add/remove package, change price)
4. ✅ Products: "منتج جديد" → create with 1 package → appears in list
5. ✅ Clients: list shows seeded 2 + any pending from earlier as approval cards. "موافقة" promotes. "زبون جديد" creates approved-by-default
6. ✅ Clients merge: from 2+ test duplicates, pick primary + check duplicates → preview shows aggregated balance → confirm → list reduces
7. ✅ Expenses: add fuel/50/today + (optional) photo from camera roll → list shows it with 📷 marker → total updates
8. ✅ Production: add لبن 50 produced 2 wasted → list shows it
9. ✅ Users: list shows 2+, invite new → appears, toggle active
10. ✅ Log out → log back in as `emp@alqasr.test` → still routed to `/` (employee home), can NOT visit /products / /expenses / etc.

- [ ] **Step 3: Verify activity_log**

Supabase dashboard → Table Editor → `activity_log` → recent rows include: `product_added`, `client_approved`, `clients_merged`, `expense_added`, `production_recorded`. summary_ar readable.

- [ ] **Step 4: Tag**

```bash
git tag -a v0.3.0-phase3 -m "Phase 3: Admin world — products, clients (approve+merge), expenses+photos, production, users"
```

(Hold the push for the user's go-ahead, per project agreement during Phase 2.)

---

## Phase 3 Acceptance Checklist

Phase 3 done when:

- [ ] All unit tests pass (Phase 1+2's 36 + Phase 3's ~17 admin-validation = ~53+)
- [ ] `npm run build` clean
- [ ] Local 10-step E2E passes
- [ ] activity_log fills with admin actions (verified in Supabase)
- [ ] Tag `v0.3.0-phase3` created locally
- [ ] No `Co-Authored-By` / 🤖 footers
- [ ] When user says "push" → batch push of all Phase 3 commits + tag → manual Netlify deploy when desired

After acceptance, plan Phase 4 (Dashboard charts, Reports, Inventory جرد, Export Center CSV/PDF).
