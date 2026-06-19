# ألبان وأجبان القصر — Design Spec

**Date**: 2026-06-19
**Owner**: Majdi Abu Jalboush (factory owner)
**Project lead**: Mahmoud Mardawi
**Working name in code**: `alban-al-qasr`
**Brand placeholder**: replaced at deploy time via env var + `/public/logo.svg`
**Location**: Arraba, Jenin, Palestine

---

## 1. Problem

Majdi runs a small dairy factory (مصنع ألبان) producing labneh, yogurt, cheese, milk and similar fresh products. He delivers to:

- Small markets (بقالات)
- Supermarkets
- Individual customers

His core operational pain — quoted from him:

> "لديه مشكلة أن الاتفاق مع أصحاب المحلات عند ارجاع الالبان او القطع بسبب التلف يحتاج الى تبديل وتختلط عليه الامور كثيراً بين بدل تالف او بدل مرتج مع الطلبات الجديدة."

Concrete example: he delivers 10 L yogurt. The shop later flags 3 L as damaged/expired. The next delivery is 10 L — but is that "7 new + 3 replacement" (collect for 7), or "10 new + 3 replacement on top" (collect for 10, deliver 13)? Cash, stock, and replacement obligations get tangled.

He also needs a small in-app accounting module: expenses, costs, sales, waste/damaged, returns, net profit — broken down daily / weekly / monthly / yearly. Plus periodic inventory closings (جرودات).

## 2. Core Design Insight: Two Ledgers, One Visit

Every delivery visit produces **line items**, each tagged with a `line_type`:

| Line Type | Affects Money Owed | Affects Replacement Debt | Affects Stock |
|---|---|---|---|
| `sale` (بيع جديد) | + charges shop | — | − factory stock |
| `replacement_out` (بدل) | free | − shop's credit | − factory stock |
| `return_in` (مرتجع تالف) | — | + shop's credit | + waste tally |

Two independent per-client ledgers fall out of this:

1. **Money ledger** — cash owed by the shop
2. **Replacement ledger** — units of each product Majdi owes the shop (free)

Each ledger is read from a single view query. No "mixed receipts", no manual reconciliation. The receipt physically shows three sections — sale, replacement, return — color-coded.

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | Next.js 15 (App Router) | Single repo, single deploy, Node.js + JS as requested |
| Styling | Tailwind + shadcn/ui | Fast path to "fancy & beautiful"; RTL one-liner |
| Charts | Recharts | React-native, lightweight, RTL-aware |
| PDF export | pdfmake + Cairo font | Client-side, Arabic glyphs, RTL tables |
| CSV export | UTF-8 with BOM | Excel + accounting software friendly |
| Data layer | Supabase (Postgres + Auth + RLS + Storage) | Real SQL for accounting, built-in auth, free forever |
| AI | Gemini 2.5 Flash (primary) → Groq Llama 3.3 (failover) | Multimodal photo→expense, Arabic-strong, free tiers |
| Hosting | Netlify (GitHub auto-deploy) | Free, zero-config CI/CD |
| Source control | GitHub | Free private repo |

**Total monthly cost (forever, within free-tier limits): $0.**

## 4. Architecture

```
Browser (mobile-first, RTL, Arabic)
    │ HTTPS
Netlify (Next.js — static pages + server actions)
    │ Supabase JS client
Supabase
    ├── Postgres (data — the two-ledger model)
    ├── Auth (email/password + admin/employee roles)
    ├── Row-Level Security (employees scoped to own data)
    └── Storage (1 GB — product/receipt photos)
    │
    └─ outbound: Gemini API (AI assistant) — pre-aggregated JSON sent, never raw SQL
```

The LLM never touches the database directly. The Next.js server pre-aggregates the relevant period's data into a small JSON payload, sends it with the user's question, and returns a typed answer. Eliminates SQL-injection risk via LLM.

## 5. Database Schema

8 tables + 2 read-only views. Optional `period_closings` for officially-closed accounting periods.

```sql
clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('supermarket','market','individual')),
  phone TEXT,
  address TEXT,
  notes TEXT,
  added_by UUID REFERENCES users(id),                       -- who created this client (admin OR employee)
  is_approved BOOLEAN DEFAULT true,                          -- employee-added clients start as FALSE; admin flips to TRUE
  merged_into_client_id UUID REFERENCES clients(id),         -- soft-merge: visits stay queryable; this row hidden from active lists
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Visits against not-yet-approved clients are still recorded and counted —
-- approval is a hygiene step, not a gate. Money, stock, and ledgers all flow normally.

products (
  id UUID PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  base_unit TEXT CHECK (base_unit IN ('L','kg','piece')) NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,           -- price for ONE base unit (1 L, 1 kg, 1 piece)
  base_cost NUMERIC(10,2),                     -- cost for ONE base unit
  is_active BOOLEAN DEFAULT true
);

-- A product can be sold as a single unit (default) and/or as one or more packages.
-- Admin registers packages (كرتونة، علبة كبيرة، صندوق...) per product, each with its own price
-- and how many base units it contains.
product_packages (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  package_name TEXT NOT NULL,                  -- e.g., "كرتونة", "علبة كبيرة"
  contains_qty NUMERIC(10,2) NOT NULL,         -- base units per package (e.g., 24 pieces / carton)
  package_price NUMERIC(10,2) NOT NULL,        -- price for the WHOLE package
  is_active BOOLEAN DEFAULT true
);

users (
  id UUID PRIMARY KEY,             -- mirrors Supabase auth.users.id
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin','employee')) NOT NULL,
  is_active BOOLEAN DEFAULT true
);

visits (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  employee_id UUID REFERENCES users(id) NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

visit_lines (
  id UUID PRIMARY KEY,
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  package_id UUID REFERENCES product_packages(id),   -- NULL = sold as single base unit
  qty NUMERIC(10,2) NOT NULL,                        -- number of packages (or base units if package_id IS NULL)
  base_qty NUMERIC(10,2) NOT NULL,                   -- always normalized to base units (for inventory + replacement ledger)
  unit_price NUMERIC(10,2),                          -- snapshot: per-package price OR per-base-unit price; NULL for non-sale
  line_type TEXT CHECK (line_type IN ('sale','replacement_out','return_in')) NOT NULL,
  note TEXT
);
-- Invariant: base_qty = qty × (package_id IS NULL ? 1 : product_packages.contains_qty)
-- The replacement ledger ALWAYS operates on base_qty so packages don't confuse it
-- (return 1 carton of 24 → +24 base units owed → can be settled as 24 singles, 1 carton, or any mix)

payments (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT now(),
  method TEXT CHECK (method IN ('cash','transfer','other')) DEFAULT 'cash',
  recorded_by UUID REFERENCES users(id),
  note TEXT
);

expenses (
  id UUID PRIMARY KEY,
  category TEXT CHECK (category IN ('fuel','salary','rent','milk','other')) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  spent_at TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  receipt_url TEXT,                 -- Supabase Storage path if photo attached
  recorded_by UUID REFERENCES users(id)
);

production (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id) NOT NULL,
  qty_produced NUMERIC(10,2) NOT NULL,
  qty_wasted NUMERIC(10,2) DEFAULT 0,
  produced_at TIMESTAMPTZ DEFAULT now(),
  note TEXT
);

-- Activity log: every action taken by any user is logged here.
-- Drives the admin's notification bell + activity feed + audit trail.
activity_log (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES users(id) NOT NULL,
  action TEXT NOT NULL,                  -- 'visit_created' | 'visit_edited' | 'client_added' |
                                         -- 'client_approved' | 'clients_merged' | 'expense_added' | 'payment_recorded'
  entity_type TEXT,                      -- 'visit' | 'client' | 'expense' | 'payment'
  entity_id UUID,
  summary_ar TEXT,                       -- short human Arabic line: e.g., "أحمد أضاف زبون: مخبز الفجر"
  payload JSONB,                         -- structured details (before/after for edits, etc.)
  read_by_admin BOOLEAN DEFAULT false,   -- flipped true when admin views the bell or the row
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_activity_unread ON activity_log (created_at DESC) WHERE read_by_admin = false;

-- Optional: official period closings (for "closed month" lock semantics)
period_closings (
  id UUID PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  opening_qty NUMERIC(10,2),
  closing_qty NUMERIC(10,2),
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- Views

CREATE VIEW v_client_money_balance AS
  SELECT v.client_id,
         COALESCE(SUM(vl.qty * vl.unit_price) FILTER (WHERE vl.line_type='sale'), 0)
         - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.client_id = v.client_id), 0) AS balance
  FROM visits v
  JOIN visit_lines vl ON vl.visit_id = v.id
  GROUP BY v.client_id;

-- Replacement ledger uses base_qty so 1 carton of 24 vs 24 singles vs 12+12 all reconcile correctly.
-- Result is in base units (e.g., 3 L of yogurt, 24 pieces of labneh).
CREATE VIEW v_client_replacement_debt AS
  SELECT v.client_id, vl.product_id,
         SUM(CASE WHEN vl.line_type='return_in' THEN vl.base_qty
                  WHEN vl.line_type='replacement_out' THEN -vl.base_qty
                  ELSE 0 END) AS owed_base_qty
  FROM visits v JOIN visit_lines vl ON vl.visit_id = v.id
  WHERE vl.line_type IN ('return_in','replacement_out')
  GROUP BY v.client_id, vl.product_id
  HAVING SUM(CASE WHEN vl.line_type='return_in' THEN vl.base_qty
                  WHEN vl.line_type='replacement_out' THEN -vl.base_qty
                  ELSE 0 END) > 0;
```

## 6. Roles and Permissions

Enforced by Supabase Row-Level Security.

| Page / Capability | Admin (Majdi) | Employee |
|---|---|---|
| Login | yes | yes |
| Clients list (home) | full | minimal — name + current balance + replacement debt only |
| Client detail — current balance + replacement debt | yes | yes |
| Client detail — full history / lifetime revenue | yes | no |
| Create new visit (sale, return, replacement, distribution) | yes | yes |
| Edit / delete past visit | anytime | own visits only, within 24h of creation |
| See receipts | all | own only |
| Products CRUD (incl. prices, costs, packages) | yes | no (prices auto-fill in visit flow) |
| Clients CRUD (full edit + delete) | yes | no |
| **Quick-add new client** (name + phone + type) | yes | yes — flagged `is_approved=false` for admin review |
| Approve / edit / delete employee-added clients | yes | no |
| Merge duplicate clients | yes | no |
| Expenses | yes | no |
| Production & waste | yes | no |
| Dashboard, charts, net profit | yes | no |
| Reports, الجرد, Export (CSV/PDF) | yes | no |
| AI Assistant | yes | no |
| Users management | yes | no |
| Activity feed + notification bell | yes (sees everything) | no |

## 7. Pages (v1)

16 screens.

### Employee-facing (5)
1. **Login** — email + password
2. **Home / Clients** — searchable list with two-ledger badges; bottom nav: الزبائن · زياراتي · حسابي. Employees can also tap "+ زبون جديد" for a minimal quick-add form (name + phone + type); the new row is recorded with `is_approved=false` and surfaces in Majdi's bell.
3. **Client Detail** — current balance + replacement debt; recent own visits
4. **New Visit** — the 3-button screen (بيع · مرتجع · بدل) with color-coded line items
5. **Receipt** — printable + shareable (CSV/PDF), Arabic + brand header

### Admin-only (11)
6. **Dashboard** — period switcher (يومي/أسبوعي/شهري/سنوي), hero net-profit card, stat tiles, revenue line chart, expense pie, top-clients leaderboard
7. **Products (المنتجات)** — CRUD with name (AR/EN), base unit (لتر / كيلو / قطعة), base price + cost per unit, plus 0..N packages per product. Each package has: name (e.g., كرتونة), contained quantity in base units (e.g., 24), and package price. When the employee picks a product on the New Visit screen, the picker offers "single unit" plus every registered package with its price already filled in.
8. **Clients CRUD** — full client management. Includes:
    - **Pending approvals** strip at top (employee-added clients with `is_approved=false`) — quick approve / edit / delete / merge buttons.
    - **Merge duplicates** wizard — pick a primary client and one or more duplicates, preview the combined ledger (money + replacements + visits), confirm. All `visits` and `payments` re-point to the primary; duplicates get `merged_into_client_id` set (soft-merge; history preserved).
9. **Expenses** — by category, attach receipt photo (or let the AI assistant fill it from a photo).
10. **Production & Waste** — daily entry per product
11. **Reports** — drill-down by client, product, employee, date range
12. **Inventory / الجرد** — opening → production → sales → returns → waste → closing, per product, per period (weekly/monthly/yearly), with prior-period comparison
13. **Export Center** — CSV (UTF-8+BOM) and PDF (pdfmake + Cairo font) downloads with period + report-type pickers
14. **AI Assistant** — chat UI; text and image input (Gemini multimodal); pre-aggregated context, no raw DB access
15. **Users management** — add/remove employees, set role
16. **Activity & Notifications** — bell icon in top nav with unread badge. Page shows:
    - Top: **Pending approvals** (new clients added by employees, awaiting review).
    - Below: **Activity feed** — chronological log of every employee action (`visit_created`, `client_added`, `visit_edited`, etc.) with summary line in Arabic, actor name, timestamp. Filterable by employee, action type, and date.
    - Real-time push via Supabase Realtime — new entries appear without refresh.
    - Marking a row read flips `read_by_admin=true`; bell count decrements.

## 8. Visual Direction

**Palette**: C — Fresh Modern Dairy.

```
--bg          #ffffff   white
--surface     #f4f9f4   mint surface
--primary     #2d8659   fresh green (buttons, accents, sale lines)
--primary-dark#1f6943   forest dark (gradients, headers, replacement lines)
--forest      #1a3d2b   deep forest (titles, top bars)
--ink         #1a2e1a   body text
--muted       #6b7d72   secondary text
--border      #d8e7d8   hairline borders
--warn        #c96f2c   warm orange (return lines)
--danger      #c4453c   destructive actions
--info-bg     #eef6f0   info backgrounds
--gold        #d4a55a   admin "crown" badge
```

**Typography**: Cairo (UI) + Amiri (display / brand). Both Google Fonts, free, Arabic-strong.
**Direction**: RTL throughout. English numerals (Western Arabic) for amounts so accounting copy-paste works.
**Mobile-first**: 340 px design baseline; tablet/desktop expand via responsive breakpoints.

**Color semantics** (carried across forms, receipts, lines, badges):

- Sale = primary green (money in)
- Return = warm orange (debt to you)
- Replacement = forest dark (free, settles debt)

A 4-px right-border on each visit line keeps the type visually unambiguous on every receipt.

## 9. AI Assistant (اسأل بياناتك)

**Provider**: Gemini 2.5 Flash. Fallback to Groq Llama 3.3 70B if Google throttles.

**Pattern** (no SQL injection risk):

1. User types question (Arabic or English) or uploads image (e.g., fuel receipt).
2. Server resolves question scope to a period (last 30 days / this month / etc.).
3. Server pre-aggregates relevant data: sales by product, returns, expenses, top clients, etc. into a small JSON.
4. JSON + question + system prompt sent to Gemini.
5. Response shown as chat bubble; may include a small inline chart/table.
6. Image case: Gemini extracts vendor, amount, date → server inserts an `expenses` row; response confirms.

**Example questions handled**:
- "كم بعت لبن خلال آخر شهر؟"
- "أي زبون عنده أعلى ديون؟"
- "ما أكثر منتج مرتجع؟"
- "هل الربح زاد عن الشهر اللي قبله؟"
- "📷 أضف هذه الفاتورة للمصاريف" (photo of receipt)

## 10. Reports and Exports

**Formats**: CSV (UTF-8 with BOM) and PDF (pdfmake + embedded Cairo font for Arabic glyphs).

**Report types**:
- Sales (by period, by client, by product, by employee)
- Returns / damaged
- Replacements given
- Expenses (by category)
- Production & waste
- Full client ledger (visits + payments timeline)
- Periodic inventory (جرد) — opening, production, sales, returns, waste, closing

**Period selectors**: day / week / month / quarter / year / custom range.

**Dahbour compatibility**: standard clean CSV columns in v1; column mapping to be added in v1.1 once a sample Dahbour-import template is available (Ahmad will share). Out of scope to guess the format.

## 11. Out of Scope (v1)

Documented to keep scope honest:
- Variant delivery workflows (A: net swap / B: split lines / C: monthly account / D: mix by client type) — for now we model only B; the data model supports A and C if Majdi adopts them later
- Tax / VAT handling
- Multi-currency
- Multi-factory / multi-branch
- Push notifications
- Invoicing by email
- Customer-facing portal
- Voice input on AI assistant
- Reason breakdown on returns (damaged vs expired vs unsold) — single bucket in v1

## 12. Future Considerations

- Migration path to Workflow A / C if needed: existing data stays valid; new `line_type` values or aggregation rules added.
- Dahbour CSV mapping when format is shared.
- Photo of products + barcode scanning for fast visit entry.
- Driver route optimization (Google Maps free tier).

## 13. Cost Summary

| Service | Free tier ceiling | Project use estimate | Headroom |
|---|---|---|---|
| Netlify | 100 GB bandwidth/mo, unlimited builds | < 1 GB | very large |
| GitHub | Unlimited private repos | 1 repo | n/a |
| Supabase | 500 MB DB, 50K MAU, 1 GB storage, 2 GB egress | < 10 MB DB, < 50 MAU | very large |
| Gemini 2.5 Flash | (Google free tier) | hundreds of requests/day | comfortable |
| Groq (failover) | thousands of requests/day | rarely used | comfortable |

Annual cost expectation: **$0** for years. If Majdi ever scales past free tiers, paid tiers start at ~$25/mo (Supabase Pro) — still affordable.

---

**Status**: design locked, ready for implementation plan.
