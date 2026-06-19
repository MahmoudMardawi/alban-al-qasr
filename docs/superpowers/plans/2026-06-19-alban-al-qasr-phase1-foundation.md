# Alban Al-Qasr — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed Next.js app on Netlify, backed by Supabase, with Arabic RTL layout, brand placeholder, working login, and role-based routing (admin → /dashboard placeholder, employee → / home placeholder). End state: visit the live URL, log in as admin or employee, land on the right page. No business features yet.

**Architecture:** Next.js 15 App Router + Tailwind + shadcn/ui + Supabase (Postgres + Auth + RLS). All SQL lives in `supabase/migrations/`. Auth via Supabase's email/password; role stored in custom `users` table and read by Next.js middleware which redirects based on role. Brand color tokens centralized in `tailwind.config.ts`. Cairo + Amiri fonts loaded via `next/font`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind 3, shadcn/ui, Supabase JS v2, Vitest, React Testing Library, Cairo + Amiri (Google Fonts).

**Reference spec:** `docs/superpowers/specs/2026-06-19-alban-al-qasr-design.md`

---

## File Structure (Phase 1 only)

```
alban-al-qasr/
├── .env.example                       # template (committed)
├── .env.local                         # actual keys (gitignored)
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts                 # brand color tokens
├── postcss.config.mjs
├── next.config.mjs
├── components.json                    # shadcn config
├── vitest.config.ts
├── vitest.setup.ts
├── netlify.toml
├── public/
│   ├── logo.svg                       # placeholder (text-only mark)
│   └── favicon.ico
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 0001_schema.sql            # all tables + indexes
│       ├── 0002_views.sql             # money + replacement ledger views
│       ├── 0003_rls.sql               # row-level security policies
│       └── 0004_seed_dev.sql          # dev seed: admin + employee + sample data
├── src/
│   ├── middleware.ts                  # auth + role-based redirect
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # browser client
│   │   │   ├── server.ts              # server-component / route-handler client
│   │   │   └── middleware.ts          # edge middleware helper
│   │   ├── auth.ts                    # getCurrentUser + role helpers
│   │   └── types.ts                   # generated Supabase types
│   ├── app/
│   │   ├── globals.css                # tailwind + base RTL
│   │   ├── layout.tsx                 # root layout: RTL, fonts, brand
│   │   ├── login/
│   │   │   └── page.tsx               # login form
│   │   ├── (employee)/
│   │   │   └── page.tsx               # employee home placeholder
│   │   └── (admin)/
│   │       └── dashboard/
│   │           └── page.tsx           # admin dashboard placeholder
│   └── components/
│       └── BrandHeader.tsx            # brand name + logo placeholder
└── tests/
    ├── lib/
    │   └── auth.test.ts               # auth helper unit tests
    └── middleware/
        └── role-routing.test.ts       # middleware role routing tests
```

---

## Prerequisites Checklist

Before Task 1, the executor must have or do the following:

- [ ] Node.js 20+ installed (`node -v` → v20.x or later)
- [ ] npm 10+ (`npm -v`)
- [ ] Git installed (`git -v`)
- [ ] A GitHub account
- [ ] A Supabase account (free — sign up at https://supabase.com — no credit card needed)
- [ ] A Netlify account (free — sign up at https://netlify.com — no credit card needed)

---

## Task 1: Initialize Next.js project + Git repo

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `.gitignore`, `README.md`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `public/favicon.ico`

- [ ] **Step 1: Run the Next.js generator**

```bash
cd F:/Projects/Cloned/08_OtherProjects/alban-al-qasr
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias \
  --use-npm
```

When prompted "Would you like to use Turbopack? (y/N)" — answer **N** (Netlify support is more mature without it for now).

Expected: project files appear; `npm install` finishes; `package.json` shows `"next": "15.x"`.

- [ ] **Step 2: Verify dev server boots**

```bash
npm run dev
```

Open http://localhost:3000 — you should see the default Next.js welcome page. Stop the server with Ctrl+C.

- [ ] **Step 3: Replace .gitignore additions**

Append to `.gitignore`:

```
# project-specific
.env.local
.env*.local
supabase/.branches
supabase/.temp
.superpowers/
.netlify/
```

- [ ] **Step 4: Create README.md**

```markdown
# ألبان وأجبان القصر

Internal dairy management app — orders, returns, replacements, accounting.

## Stack
Next.js 15 · Tailwind · Supabase · Netlify

## Development
```bash
npm install
cp .env.example .env.local   # fill in Supabase + Gemini keys
npm run dev
```

See `docs/superpowers/specs/2026-06-19-alban-al-qasr-design.md` for design.
```

- [ ] **Step 5: Initialize git and first commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js + Tailwind project"
```

Expected: commit succeeds; `git log` shows one commit.

---

## Task 2: Install supporting dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Supabase, shadcn deps, charts, PDF, AI clients, utilities**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install recharts pdfmake
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install @google/genai groq-sdk
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @types/pdfmake
npm install -D supabase
```

- [ ] **Step 3: Verify install**

```bash
npm ls @supabase/supabase-js
```

Expected: prints the package and version (no UNMET DEPENDENCY).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install supabase, charts, pdf, ai, test deps"
```

---

## Task 3: Configure Tailwind with brand color tokens + RTL

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace `tailwind.config.ts` contents**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Fresh Modern palette (Palette C) — see design spec section 8
        bg:           "#ffffff",
        surface:      "#f4f9f4",
        primary:      "#2d8659",
        "primary-dk": "#1f6943",
        forest:       "#1a3d2b",
        ink:          "#1a2e1a",
        muted:        "#6b7d72",
        border:       "#d8e7d8",
        warn:         "#c96f2c",
        danger:       "#c4453c",
        "info-bg":    "#eef6f0",
        gold:         "#d4a55a",
      },
      fontFamily: {
        sans:    ["var(--font-cairo)", "system-ui", "sans-serif"],
        display: ["var(--font-amiri)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Replace `src/app/globals.css` contents**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html { direction: rtl; }
body {
  background: theme('colors.bg');
  color: theme('colors.ink');
  font-family: theme('fontFamily.sans');
  -webkit-font-smoothing: antialiased;
}

/* English numerals even in RTL contexts (matters for amounts/accounting) */
.lnum { font-feature-settings: "lnum"; font-variant-numeric: lining-nums; }
```

- [ ] **Step 3: Smoke-test the colors**

Replace `src/app/page.tsx` contents temporarily with:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen p-6 space-y-4">
      <h1 className="font-display text-3xl text-forest">ألبان وأجبان القصر</h1>
      <p className="text-muted">Palette + RTL smoke test.</p>
      <div className="flex gap-2">
        <div className="w-12 h-12 rounded-lg bg-primary"></div>
        <div className="w-12 h-12 rounded-lg bg-primary-dk"></div>
        <div className="w-12 h-12 rounded-lg bg-warn"></div>
        <div className="w-12 h-12 rounded-lg bg-gold"></div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run dev server and visually verify**

```bash
npm run dev
```

Open http://localhost:3000 — Arabic text reads right-to-left, four colored squares show the brand palette. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/app/page.tsx
git commit -m "feat: brand color tokens, fonts wiring, RTL base"
```

---

## Task 4: Wire Cairo + Amiri fonts via next/font

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Cairo, Amiri } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ألبان وأجبان القصر",
  description: "مصنع ألبان وأجبان القصر — إدارة الطلبات والحسابات",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${amiri.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify fonts render**

```bash
npm run dev
```

Open http://localhost:3000 — the `<h1>` should render in Amiri (decorative serif), the `<p>` in Cairo (clean sans). Stop server.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire Cairo and Amiri fonts via next/font"
```

---

## Task 5: Set up Vitest + React Testing Library

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add test scripts to `package.json`**

Open `package.json`, in `"scripts"` add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("vitest runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test**

```bash
npm test
```

Expected: `1 passed`. If it fails, check that `vitest.setup.ts` exists and `package.json` scripts were saved.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json tests/smoke.test.ts
git commit -m "chore: vitest + RTL setup"
```

---

## Task 6: Create the Supabase project and capture env vars

**Files:**
- Create: `.env.example`, `.env.local`

This task is mostly browser actions outside the codebase. The executor performs them; the only commits are the env files.

- [ ] **Step 1: Create a new Supabase project**

In a browser:
1. Go to https://supabase.com/dashboard/projects
2. Click "New project"
3. Organization: pick your personal (or create one)
4. Project name: `alban-al-qasr`
5. Database password: generate a strong one — save it to a password manager
6. Region: pick the geographically closest one (e.g., `Central EU (Frankfurt)` for Palestine/Levant)
7. Pricing plan: **Free**
8. Click "Create new project" — wait ~2 minutes for provisioning

- [ ] **Step 2: Copy the project URL and anon key**

In the Supabase dashboard for the new project:
1. Left sidebar → **Project Settings** → **API**
2. Copy "Project URL" (looks like `https://xxxxx.supabase.co`)
3. Copy "anon public" key (a long JWT)
4. Also copy "service_role" key — needed for server-only operations; treat as secret

- [ ] **Step 3: Create `.env.example` (committed)**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI (Phase 5 — leave blank for now)
GEMINI_API_KEY=
GROQ_API_KEY=

# Brand
NEXT_PUBLIC_BRAND_NAME=ألبان وأجبان القصر
NEXT_PUBLIC_BRAND_AREA=عرّابة — جنين
```

- [ ] **Step 4: Create `.env.local` (NOT committed — already gitignored)**

Copy `.env.example` to `.env.local` and fill in the three Supabase values from Step 2. Leave Gemini/Groq blank.

```bash
cp .env.example .env.local
# then edit .env.local in your editor and paste the values
```

- [ ] **Step 5: Commit the example only**

```bash
git add .env.example
git commit -m "chore: env template"
```

Verify: `git status` shows `.env.local` as untracked (correct — it must never be committed).

---

## Task 7: Set up the Supabase CLI for local migrations

**Files:**
- Create: `supabase/config.toml` (generated by CLI)

- [ ] **Step 1: Verify the Supabase CLI was installed in Task 2**

```bash
npx supabase --version
```

Expected: prints a version number (e.g., `1.x.x`).

- [ ] **Step 2: Initialize Supabase in the project**

```bash
npx supabase init
```

Answer:
- "Generate VS Code workspace settings?" → N
- "Generate IntelliJ settings?" → N

Expected: creates `supabase/` folder with `config.toml`.

- [ ] **Step 3: Link to the remote project**

Find your project ref in the Supabase dashboard URL (looks like `xxxxx` in `https://supabase.com/dashboard/project/xxxxx`).

```bash
npx supabase link --project-ref <your-project-ref>
```

When prompted for the database password, paste the one you generated in Task 6 step 1.

Expected: "Finished supabase link." message.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "chore: initialize supabase project + link"
```

---

## Task 8: Write the initial schema migration (all tables)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

- [ ] **Step 1: Create the migration file**

Write `supabase/migrations/0001_schema.sql` with the full schema from the design spec (Section 5). Use the exact contents below:

```sql
-- ===== 0001_schema.sql =====
-- All tables for Alban Al-Qasr. UUIDs everywhere. Timestamps in TIMESTAMPTZ.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS (mirrors auth.users.id; populated via trigger in 0003_rls.sql)
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL CHECK (role IN ('admin','employee')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CLIENTS
CREATE TABLE clients (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  type                     TEXT CHECK (type IN ('supermarket','market','individual')),
  phone                    TEXT,
  address                  TEXT,
  notes                    TEXT,
  added_by                 UUID REFERENCES users(id),
  is_approved              BOOLEAN NOT NULL DEFAULT true,
  merged_into_client_id    UUID REFERENCES clients(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_name           ON clients (name);
CREATE INDEX idx_clients_pending        ON clients (created_at DESC) WHERE is_approved = false;
CREATE INDEX idx_clients_not_merged     ON clients (id) WHERE merged_into_client_id IS NULL;

-- PRODUCTS
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT,
  base_unit   TEXT NOT NULL CHECK (base_unit IN ('L','kg','piece')),
  base_price  NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  base_cost   NUMERIC(10,2) CHECK (base_cost IS NULL OR base_cost >= 0),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCT PACKAGES (kartonas etc.)
CREATE TABLE product_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  package_name    TEXT NOT NULL,
  contains_qty    NUMERIC(10,2) NOT NULL CHECK (contains_qty > 0),
  package_price   NUMERIC(10,2) NOT NULL CHECK (package_price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_packages_product ON product_packages (product_id);

-- VISITS
CREATE TABLE visits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id),
  employee_id  UUID NOT NULL REFERENCES users(id),
  visited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visits_client    ON visits (client_id, visited_at DESC);
CREATE INDEX idx_visits_employee  ON visits (employee_id, visited_at DESC);

-- VISIT LINES (the heart of the two-ledger model)
CREATE TABLE visit_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  package_id  UUID REFERENCES product_packages(id),
  qty         NUMERIC(10,2) NOT NULL CHECK (qty > 0),
  base_qty    NUMERIC(10,2) NOT NULL CHECK (base_qty > 0),
  unit_price  NUMERIC(10,2),
  line_type   TEXT NOT NULL CHECK (line_type IN ('sale','replacement_out','return_in')),
  note        TEXT
);
CREATE INDEX idx_lines_visit          ON visit_lines (visit_id);
CREATE INDEX idx_lines_type_product   ON visit_lines (line_type, product_id);

-- PAYMENTS
CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  method       TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','transfer','other')),
  recorded_by  UUID REFERENCES users(id),
  note         TEXT
);
CREATE INDEX idx_payments_client ON payments (client_id, paid_at DESC);

-- EXPENSES
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL CHECK (category IN ('fuel','salary','rent','milk','other')),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  spent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  note         TEXT,
  receipt_url  TEXT,
  recorded_by  UUID REFERENCES users(id)
);
CREATE INDEX idx_expenses_period ON expenses (spent_at DESC);

-- PRODUCTION + WASTE
CREATE TABLE production (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id),
  qty_produced  NUMERIC(10,2) NOT NULL CHECK (qty_produced >= 0),
  qty_wasted    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (qty_wasted >= 0),
  produced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note          TEXT,
  recorded_by   UUID REFERENCES users(id)
);
CREATE INDEX idx_production_period ON production (produced_at DESC);

-- ACTIVITY LOG (feeds Majdi's notification bell)
CREATE TABLE activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL REFERENCES users(id),
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  summary_ar      TEXT,
  payload         JSONB,
  read_by_admin   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_unread ON activity_log (created_at DESC) WHERE read_by_admin = false;
CREATE INDEX idx_activity_actor  ON activity_log (actor_id, created_at DESC);

-- PERIOD CLOSINGS (optional — used when admin "closes" a period)
CREATE TABLE period_closings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  product_id    UUID NOT NULL REFERENCES products(id),
  opening_qty   NUMERIC(10,2),
  closing_qty   NUMERIC(10,2),
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id)
);
CREATE INDEX idx_closings_period ON period_closings (period_start, period_end);
```

- [ ] **Step 2: Apply the migration to the remote Supabase project**

```bash
npx supabase db push
```

Expected output: `Applying migration 0001_schema.sql ... Finished supabase db push.`

- [ ] **Step 3: Verify in the Supabase dashboard**

Browser → Supabase dashboard → Table Editor — you should see all 10 tables listed: `users`, `clients`, `products`, `product_packages`, `visits`, `visit_lines`, `payments`, `expenses`, `production`, `activity_log`, `period_closings`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat(db): initial schema — 11 tables, two-ledger model"
```

---

## Task 9: Write the views + the trigger that mirrors auth.users → public.users

**Files:**
- Create: `supabase/migrations/0002_views_and_user_sync.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ===== 0002_views_and_user_sync.sql =====

-- Money ledger: per client, total sales minus total payments.
CREATE VIEW v_client_money_balance AS
  SELECT v.client_id,
         COALESCE(SUM(vl.qty * vl.unit_price) FILTER (WHERE vl.line_type = 'sale'), 0)
         - COALESCE(
             (SELECT SUM(amount) FROM payments p WHERE p.client_id = v.client_id),
             0
           ) AS balance
  FROM visits v
  JOIN visit_lines vl ON vl.visit_id = v.id
  GROUP BY v.client_id;

-- Replacement ledger: per (client, product), units the factory owes the shop.
-- Always in base units so cartons and singles reconcile cleanly.
CREATE VIEW v_client_replacement_debt AS
  SELECT v.client_id,
         vl.product_id,
         SUM(CASE WHEN vl.line_type = 'return_in'        THEN  vl.base_qty
                  WHEN vl.line_type = 'replacement_out' THEN -vl.base_qty
                  ELSE 0 END) AS owed_base_qty
  FROM visits v
  JOIN visit_lines vl ON vl.visit_id = v.id
  WHERE vl.line_type IN ('return_in','replacement_out')
  GROUP BY v.client_id, vl.product_id
  HAVING SUM(CASE WHEN vl.line_type = 'return_in'        THEN  vl.base_qty
                  WHEN vl.line_type = 'replacement_out' THEN -vl.base_qty
                  ELSE 0 END) > 0;

-- Trigger: when a new auth.users row is created, mirror it into public.users.
-- Default role = 'employee'; admin role must be set manually (or via seed).
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: `Applying migration 0002_views_and_user_sync.sql ... Finished`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_views_and_user_sync.sql
git commit -m "feat(db): money + replacement views, auth.users sync trigger"
```

---

## Task 10: Write Row-Level Security policies

**Files:**
- Create: `supabase/migrations/0003_rls.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ===== 0003_rls.sql =====
-- Enable RLS on every public table and define the role-aware policies.

-- Helper: returns current authed user's role (or NULL if not logged in)
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT auth_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION is_employee() RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT auth_role() = 'employee';
$$;

-- ===== USERS =====
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_read   ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_admin_all   ON users FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- ===== CLIENTS =====
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_read_all    ON clients FOR SELECT USING (is_admin() OR is_employee());
CREATE POLICY clients_emp_insert  ON clients FOR INSERT WITH CHECK (
  is_employee() AND is_approved = false AND added_by = auth.uid()
);
CREATE POLICY clients_admin_write ON clients FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===== PRODUCTS + PACKAGES =====
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_read       ON products FOR SELECT USING (is_admin() OR is_employee());
CREATE POLICY products_admin      ON products FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE product_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY packages_read       ON product_packages FOR SELECT USING (is_admin() OR is_employee());
CREATE POLICY packages_admin      ON product_packages FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===== VISITS =====
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY visits_emp_read_own ON visits FOR SELECT USING (
  is_admin() OR (is_employee() AND employee_id = auth.uid())
);
CREATE POLICY visits_emp_insert   ON visits FOR INSERT WITH CHECK (
  is_employee() AND employee_id = auth.uid()
);
CREATE POLICY visits_emp_update_own ON visits FOR UPDATE USING (
  (is_employee() AND employee_id = auth.uid() AND created_at > now() - interval '24 hours')
  OR is_admin()
) WITH CHECK (
  (is_employee() AND employee_id = auth.uid())
  OR is_admin()
);
CREATE POLICY visits_admin_delete ON visits FOR DELETE USING (is_admin());

-- ===== VISIT LINES (inherit visit's permissions via subquery) =====
ALTER TABLE visit_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY lines_read ON visit_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_lines.visit_id
          AND (is_admin() OR v.employee_id = auth.uid()))
);
CREATE POLICY lines_write ON visit_lines FOR ALL USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_lines.visit_id
          AND (is_admin() OR (v.employee_id = auth.uid()
               AND v.created_at > now() - interval '24 hours')))
) WITH CHECK (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_lines.visit_id
          AND (is_admin() OR v.employee_id = auth.uid()))
);

-- ===== PAYMENTS, EXPENSES, PRODUCTION (admin-only writes; employees may need read for receipts later) =====
ALTER TABLE payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE production   ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_admin   ON payments   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY expenses_admin   ON expenses   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY production_admin ON production FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===== ACTIVITY LOG =====
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_admin_read   ON activity_log FOR SELECT USING (is_admin());
CREATE POLICY activity_emp_insert   ON activity_log FOR INSERT WITH CHECK (
  (is_admin() OR is_employee()) AND actor_id = auth.uid()
);
CREATE POLICY activity_admin_update ON activity_log FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- ===== PERIOD CLOSINGS =====
ALTER TABLE period_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY closings_admin ON period_closings FOR ALL USING (is_admin()) WITH CHECK (is_admin());
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify RLS is on**

Browser → Supabase dashboard → Authentication → Policies — every table from the spec should show policies (not just "RLS enabled").

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_rls.sql
git commit -m "feat(db): RLS policies for all tables, role-aware"
```

---

## Task 11: Seed dev data — admin Majdi + employee + sample products/clients

**Files:**
- Create: `supabase/migrations/0004_seed_dev.sql`

This seed is safe to re-run in production *before* real data exists (it only inserts if rows don't already exist). For production launch it can be replaced or extended.

- [ ] **Step 1: Create the seed users in Supabase Auth (browser action)**

In Supabase dashboard → Authentication → Users → "Add user":

1. Add user 1:
   - Email: `majdi@alqasr.test`
   - Password: choose a strong one — save it
   - Auto Confirm User: ON
   - Click "Create user"
2. Add user 2:
   - Email: `ahmad@alqasr.test`
   - Password: choose a strong one — save it
   - Auto Confirm User: ON
   - Click "Create user"

The trigger from Task 9 will auto-insert both into `public.users` with role `'employee'`.

- [ ] **Step 2: Create the seed migration to set roles + sample data**

```sql
-- ===== 0004_seed_dev.sql =====
-- Idempotent: safe to re-run.

-- Promote majdi to admin
UPDATE users
   SET role = 'admin', full_name = 'مجدي أبو جلبوش'
 WHERE email = 'majdi@alqasr.test';

UPDATE users
   SET full_name = 'أحمد الموظف'
 WHERE email = 'ahmad@alqasr.test';

-- Sample products (skip if already inserted)
INSERT INTO products (name_ar, name_en, base_unit, base_price, base_cost)
SELECT 'لبن',     'Yogurt',     'L',     5.00, 2.50
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_ar = 'لبن');

INSERT INTO products (name_ar, name_en, base_unit, base_price, base_cost)
SELECT 'لبنة',    'Labneh',     'kg',   18.00, 9.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_ar = 'لبنة');

INSERT INTO products (name_ar, name_en, base_unit, base_price, base_cost)
SELECT 'جبنة بيضاء','White Cheese','kg',   25.00, 13.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_ar = 'جبنة بيضاء');

-- Sample package: carton of 24 L yogurt @ 110 ILS (bulk discount)
INSERT INTO product_packages (product_id, package_name, contains_qty, package_price)
SELECT p.id, 'كرتونة (24 لتر)', 24, 110
FROM products p
WHERE p.name_ar = 'لبن'
  AND NOT EXISTS (
    SELECT 1 FROM product_packages pp
    WHERE pp.product_id = p.id AND pp.package_name = 'كرتونة (24 لتر)'
  );

-- Sample clients (admin-added so is_approved=true)
INSERT INTO clients (name, type, phone, added_by, is_approved)
SELECT 'سوبر ماركت الأخوة', 'supermarket', '0599000001',
       (SELECT id FROM users WHERE email = 'majdi@alqasr.test'), true
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'سوبر ماركت الأخوة');

INSERT INTO clients (name, type, phone, added_by, is_approved)
SELECT 'بقالة النور', 'market', '0599000002',
       (SELECT id FROM users WHERE email = 'majdi@alqasr.test'), true
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'بقالة النور');
```

- [ ] **Step 3: Apply the migration**

```bash
npx supabase db push
```

- [ ] **Step 4: Verify in the dashboard**

Browser → Supabase → Table Editor:
- `users` → 2 rows; `majdi@alqasr.test` has role `admin`
- `products` → 3 rows
- `product_packages` → 1 row (yogurt carton)
- `clients` → 2 rows, both `is_approved = true`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_seed_dev.sql
git commit -m "feat(db): seed dev data — admin majdi, sample products + clients"
```

---

## Task 12: Generate TypeScript types from the live Supabase schema

**Files:**
- Create: `src/lib/types.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a `types:gen` npm script**

In `package.json` `"scripts"` block, add:

```json
"types:gen": "supabase gen types typescript --linked --schema public > src/lib/types.ts"
```

- [ ] **Step 2: Generate types**

```bash
npm run types:gen
```

Expected: `src/lib/types.ts` is created and contains `export type Database = { public: { Tables: { ... } } }` with all 11 tables.

- [ ] **Step 3: Commit**

```bash
git add package.json src/lib/types.ts
git commit -m "feat(types): generated supabase types"
```

---

## Task 13: Build Supabase client helpers (browser + server + middleware)

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create the browser client**

`src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create the server client**

`src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies; ignore here, middleware handles refresh
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Create the middleware client helper**

`src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  return { response: supabaseResponse, user, supabase };
}
```

- [ ] **Step 4: Add the path alias to `tsconfig.json`**

In `tsconfig.json`, in `"compilerOptions"`, add (or ensure):

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase tsconfig.json
git commit -m "feat(supabase): client/server/middleware helpers"
```

---

## Task 14: Build auth helpers with TDD

**Files:**
- Create: `src/lib/auth.ts`
- Create: `tests/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getCurrentUserWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function mockSupabase(authUserId: string | null, profile: { role: string; full_name: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUserId ? { id: authUserId, email: "x@y.z" } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profile, error: null }),
    }),
  };
}

describe("getCurrentUserWithRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no auth user", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase(null, null));
    expect(await getCurrentUserWithRole()).toBeNull();
  });

  it("returns user with role 'admin' for admin profile", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase("u1", { role: "admin", full_name: "Majdi" }),
    );
    const u = await getCurrentUserWithRole();
    expect(u).toEqual({ id: "u1", email: "x@y.z", role: "admin", full_name: "Majdi" });
  });

  it("returns user with role 'employee' for employee profile", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase("u2", { role: "employee", full_name: "Ahmad" }),
    );
    const u = await getCurrentUserWithRole();
    expect(u?.role).toBe("employee");
  });

  it("returns null when auth user exists but no profile row", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase("u3", null));
    expect(await getCurrentUserWithRole()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/lib/auth.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/auth'`.

- [ ] **Step 3: Implement `src/lib/auth.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "employee";

export interface CurrentUser {
  id: string;
  email: string;
  role: AppRole;
  full_name: string;
}

export async function getCurrentUserWithRole(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role as AppRole,
    full_name: profile.full_name,
  };
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
npm test -- tests/lib/auth.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/lib/auth.test.ts
git commit -m "feat(auth): getCurrentUserWithRole helper + tests"
```

---

## Task 15: Build the auth middleware with role-based routing

**Files:**
- Create: `src/middleware.ts`
- Create: `tests/middleware/role-routing.test.ts`

The middleware is the gatekeeper: unauth → `/login`; admin trying employee routes → `/dashboard`; employee trying admin routes → `/`.

- [ ] **Step 1: Write the failing test for the pure routing function**

`tests/middleware/role-routing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { decideRedirect } from "@/middleware-logic";

describe("decideRedirect", () => {
  it("unauth on protected route → /login", () => {
    expect(decideRedirect({ pathname: "/dashboard", role: null })).toBe("/login");
    expect(decideRedirect({ pathname: "/", role: null })).toBe("/login");
  });

  it("unauth on /login → stays", () => {
    expect(decideRedirect({ pathname: "/login", role: null })).toBeNull();
  });

  it("admin landing on /login → /dashboard", () => {
    expect(decideRedirect({ pathname: "/login", role: "admin" })).toBe("/dashboard");
  });

  it("employee landing on /login → /", () => {
    expect(decideRedirect({ pathname: "/login", role: "employee" })).toBe("/");
  });

  it("admin on admin route → stays", () => {
    expect(decideRedirect({ pathname: "/dashboard", role: "admin" })).toBeNull();
  });

  it("employee on /dashboard → /", () => {
    expect(decideRedirect({ pathname: "/dashboard", role: "employee" })).toBe("/");
  });

  it("admin on / → /dashboard (admin's home is dashboard)", () => {
    expect(decideRedirect({ pathname: "/", role: "admin" })).toBe("/dashboard");
  });

  it("employee on employee route → stays", () => {
    expect(decideRedirect({ pathname: "/", role: "employee" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/middleware/role-routing.test.ts
```

Expected: FAIL — `Cannot find module '@/middleware-logic'`.

- [ ] **Step 3: Implement `src/middleware-logic.ts`** (pure function, testable without Next.js context)

```typescript
import type { AppRole } from "@/lib/auth";

const ADMIN_PREFIXES = ["/dashboard", "/products", "/clients", "/expenses", "/production", "/reports", "/inventory", "/export", "/ai", "/users", "/activity"];
const EMPLOYEE_PREFIXES = ["/", "/client", "/visit", "/my-visits", "/profile"];

function isAdminRoute(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
function isEmployeeRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return EMPLOYEE_PREFIXES.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
}

export function decideRedirect(args: { pathname: string; role: AppRole | null }): string | null {
  const { pathname, role } = args;

  if (pathname === "/login") {
    if (role === "admin")    return "/dashboard";
    if (role === "employee") return "/";
    return null;
  }

  if (role === null) return "/login";

  if (role === "admin") {
    if (pathname === "/") return "/dashboard";
    return null;
  }

  if (role === "employee") {
    if (isAdminRoute(pathname)) return "/";
    return null;
  }

  return null;
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
npm test -- tests/middleware/role-routing.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Wire the pure function into `src/middleware.ts`**

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { decideRedirect } from "@/middleware-logic";
import type { AppRole } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  let role: AppRole | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    role = (profile?.role as AppRole) ?? null;
  }

  const target = decideRedirect({ pathname, role });
  if (target && target !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|fonts/|api/health).*)"],
};
```

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/middleware-logic.ts tests/middleware/role-routing.test.ts
git commit -m "feat(auth): middleware with role-based routing + pure logic tests"
```

---

## Task 16: Build the login page

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`

- [ ] **Step 1: Create the server action**

`src/app/login/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function loginAction(formData: FormData) {
  const email    = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "البريد وكلمة المرور مطلوبان" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "بريد أو كلمة مرور غير صحيحة" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
```

- [ ] **Step 2: Create the login page UI**

`src/app/login/page.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-info-bg">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-border p-8 shadow-sm">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl text-forest leading-tight">
            ألبان وأجبان القصر
          </h1>
          <p className="text-muted text-xs mt-1">عرّابة — جنين</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-ink mb-1">كلمة المرور</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-primary text-white font-semibold py-3 shadow-sm hover:bg-primary-dk transition-colors disabled:opacity-60"
          >
            {isPending ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Manual test in the dev server**

```bash
npm run dev
```

Browser → http://localhost:3000/login. You should see the login card in palette C, Arabic right-to-left, brand at top. Try logging in with `majdi@alqasr.test` + the password you set in Task 11. You should be redirected to `/` (middleware then sends admin to `/dashboard` — which doesn't exist yet, so 404). That 404 confirms middleware did its job. Try `ahmad@alqasr.test` and you should land at `/` (also 404 until the next task).

- [ ] **Step 4: Commit**

```bash
git add src/app/login
git commit -m "feat(auth): login page + server action"
```

---

## Task 17: Build the two placeholder home pages (admin dashboard + employee home)

**Files:**
- Create: `src/app/(admin)/dashboard/page.tsx`
- Create: `src/app/(employee)/page.tsx`
- Delete: `src/app/page.tsx` (the smoke-test page from Task 3) — replaced by the (employee) group
- Create: `src/components/BrandHeader.tsx`
- Create: `src/app/logout/route.ts` (logout handler used by both placeholders)

- [ ] **Step 1: Create the BrandHeader component**

`src/components/BrandHeader.tsx`:

```tsx
export function BrandHeader({ subtitle }: { subtitle?: string }) {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";
  const area = process.env.NEXT_PUBLIC_BRAND_AREA ?? "عرّابة — جنين";
  return (
    <header className="bg-white border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-forest leading-tight">{name}</h1>
          <p className="text-[11px] text-muted mt-0.5">{subtitle ?? area}</p>
        </div>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-xs text-muted hover:text-ink underline"
          >
            خروج
          </button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Delete the smoke-test root page**

```bash
git rm src/app/page.tsx
```

- [ ] **Step 3: Create the employee home placeholder**

`src/app/(employee)/page.tsx`:

```tsx
import { getCurrentUserWithRole } from "@/lib/auth";
import { BrandHeader } from "@/components/BrandHeader";

export default async function EmployeeHome() {
  const user = await getCurrentUserWithRole();
  return (
    <div className="min-h-screen">
      <BrandHeader subtitle={`مرحباً ${user?.full_name ?? ""} · موظف توزيع`} />
      <main className="p-6 text-center text-muted">
        <p className="text-sm">قائمة الزبائن ستظهر هنا (المرحلة 2)</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create the admin dashboard placeholder**

`src/app/(admin)/dashboard/page.tsx`:

```tsx
import { getCurrentUserWithRole } from "@/lib/auth";
import { BrandHeader } from "@/components/BrandHeader";

export default async function AdminDashboard() {
  const user = await getCurrentUserWithRole();
  return (
    <div className="min-h-screen">
      <BrandHeader subtitle={`مرحباً ${user?.full_name ?? ""} · المدير`} />
      <main className="p-6 text-center text-muted">
        <p className="text-sm">لوحة التحكم ستظهر هنا (المرحلة 4)</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create the logout route handler**

`src/app/logout/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 6: Manual end-to-end test**

```bash
npm run dev
```

Test sequence:
1. http://localhost:3000 → redirects to `/login` (no session)
2. Log in as `majdi@alqasr.test` → lands on `/dashboard` with "مرحباً مجدي... المدير"
3. Try visiting http://localhost:3000/ — middleware redirects you back to `/dashboard`
4. Click "خروج" → back to `/login`
5. Log in as `ahmad@alqasr.test` → lands on `/` with "مرحباً أحمد... موظف توزيع"
6. Try visiting http://localhost:3000/dashboard — middleware redirects back to `/`
7. Click "خروج" → back to `/login`

All seven steps must pass before committing.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components
git commit -m "feat(app): placeholder employee home + admin dashboard + logout"
```

---

## Task 18: Push to GitHub and deploy to Netlify

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Create GitHub repo (browser)**

In browser:
1. Go to https://github.com/new
2. Repository name: `alban-al-qasr`
3. Visibility: Private
4. Do NOT initialize with README, .gitignore, or license (project already has them)
5. Create repository

- [ ] **Step 2: Push the local repo**

```bash
git remote add origin https://github.com/<your-username>/alban-al-qasr.git
git branch -M main
git push -u origin main
```

Expected: all commits pushed.

- [ ] **Step 3: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- [ ] **Step 4: Commit the Netlify config**

```bash
git add netlify.toml
git commit -m "chore: netlify config"
git push
```

- [ ] **Step 5: Connect Netlify to the repo (browser)**

1. https://app.netlify.com/start → "Import from Git" → GitHub
2. Authorize Netlify if asked
3. Pick the `alban-al-qasr` repo
4. Build settings will be auto-detected from `netlify.toml` — accept them
5. Click "Show advanced" → "New variable" — add **all** env vars from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_BRAND_NAME`
   - `NEXT_PUBLIC_BRAND_AREA`
   - (leave Gemini/Groq blank — Phase 5)
6. Click "Deploy"
7. Wait ~3 minutes for the first build

- [ ] **Step 6: Test the deployed app**

Netlify gives you a URL like `https://alban-al-qasr-xyz.netlify.app`. Open it in your phone's browser:
1. Should redirect to `/login`
2. Log in as `majdi@alqasr.test` → land on `/dashboard`
3. Log out → log in as `ahmad@alqasr.test` → land on `/`

All three must pass.

- [ ] **Step 7: Tag the release**

```bash
git tag v0.1.0-phase1
git push --tags
```

---

## Phase 1 Acceptance Checklist

Phase 1 is **done** when all of these are true:

- [ ] Local: `npm test` reports all green
- [ ] Local: `npm run dev` boots without errors
- [ ] Local: end-to-end login/redirect flow works for both roles
- [ ] Live Netlify URL: same end-to-end flow works on a real phone, in Arabic RTL
- [ ] Brand name "ألبان وأجبان القصر" reads correctly in both Cairo (UI) and Amiri (display)
- [ ] Palette C colors render correctly (sage green primary, mint surface, forest forest)
- [ ] `git log --oneline` shows ~18 small commits
- [ ] Tag `v0.1.0-phase1` is pushed to GitHub

After acceptance, return to NEXUS / writing-plans to draft Phase 2 (clients list + new visit + the 3-button magic).
