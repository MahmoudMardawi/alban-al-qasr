# Alban Al-Qasr — Project Summary (v1.0)

**Owner**: Majdi Abu Jalboush · مصنع ألبان وأجبان القصر · Arraba, Jenin, Palestine
**Project lead**: Mahmoud Mardawi
**Built**: 2026-06-19 (single session, 5 phases)
**Status**: feature-complete, all 5 phases shipped, awaiting Netlify deploy
**Live URL** (after deploy): https://alban-al-gasr.netlify.app
**Repo**: https://github.com/MahmoudMardawi/alban-al-qasr
**Monthly cost**: **$0** (all infra on free tiers, indefinitely)

---

## What it solves

Majdi runs a small dairy factory (لبن، لبنة، جبنة...). His core operational pain — quoted from him:

> "تختلط عليه الامور كثيراً بين بدل تالف او بدل مرتج مع الطلبات الجديدة"

The app solves this with a **two-ledger model**: every visit line is tagged as `sale` / `replacement_out` / `return_in`, money and replacement obligations tracked on independent ledgers per client. Plus full accounting (sales / expenses / waste / net profit), inventory snapshots, and an AI assistant that answers Arabic questions about the data.

---

## Tech stack (everything on free tier)

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | **Next.js 15** (App Router, TypeScript) | Single repo, single deploy |
| Styling | **Tailwind 3** + **shadcn/ui patterns** + Cairo/Amiri fonts | Fast, Arabic-friendly, RTL native |
| Charts | **Recharts** | React-native, lightweight |
| PDF export | **pdfmake** + Cairo variable font | Client-side, Arabic glyphs |
| CSV export | UTF-8 with BOM | Excel + Dahbour-friendly |
| Data | **Supabase** (Postgres + Auth + Storage + Realtime + RLS) | One vendor, $0 forever |
| AI | **Gemini 2.5 Flash** (primary) → **Groq Llama 3.3 70B** (fallback) | Both free, both Arabic-strong |
| Hosting | **Netlify** (GitHub auto-deploy) | Free, zero-config CI/CD |
| Source control | **GitHub** | Free private repo |

---

## What's built — 5 phases

### Phase 1 — Foundation (`v0.1.0-phase1`)
- Next.js + Tailwind + Cairo/Amiri RTL shell
- Supabase: **11 tables**, 2 views, 1 trigger, 13+ RLS policies
- Email/password auth with role-based middleware (`admin` / `employee`)
- Auto-deploy from GitHub to Netlify

### Phase 2 — Employee Flow (`v0.2.1-phase2`)
- Clients list with live two-ledger badges (💰 يدين لك / 🥛 تدين له)
- Client detail with recent visits
- **The 3-button New Visit** (بيع / مرتجع / بدل) — the core feature that solves Majdi's pain
- Product+Package picker (single unit OR carton, replacement-aware)
- Atomic visit creation (visit + N lines + activity log in one transaction)
- Printable receipt with brand header
- Quick-add new client (pending approval)
- My Visits + Profile

### Phase 3 — Admin World (`v0.3.0-phase3`)
- Products CRUD with inline packages
- Clients full management + **merge wizard** (atomic via Postgres RPC)
- Approve/edit/delete pending clients
- Expenses with receipt photo upload (Supabase Storage)
- Production & waste daily entry
- Users management (invite + activate/deactivate)
- Admin shell with bottom nav + "More" sheet

### Phase 4 — Intelligence (`v0.4.0-phase4`)
- **Dashboard** — period switcher (يومي/أسبوعي/شهري/سنوي) + hero net profit + 4 stat tiles + revenue chart + expense pie + top-5 leaderboards
- **Reports** — drill-down with date range + client/product/employee filters
- **Inventory (الجرد)** — per-product per-period: opening → produced → sold → replaced → wasted → returned → closing with prior-period comparison
- **Export Center** — CSV (UTF-8 BOM for Excel) + PDF (Cairo Arabic) for sales/expenses/production

### Phase 5 — AI + Activity (`v0.5.0-phase5`)
- **AI Assistant (اسأل بياناتك)** — Arabic chat with Gemini, suggestion chips, **photo→expense auto-extraction**
- **Activity feed** — chronological log of every employee action with filters
- **Notification bell** — live count via Supabase Realtime (admin sees employee activity without refresh)
- Mark-all-read flow

---

## Brand assets (IRIS kit)

Located at `public/brand/`:
- `mark.svg` — favicon + everywhere the icon appears
- `logo-horizontal.svg`, `logo-stacked.svg`, `logo-mono-dark.svg`, `logo-mono-light.svg`
- `avatar-circle.svg` — WhatsApp/social profile pic for Majdi (1024×1024)
- `stamp.svg` — official ختم for printed contracts (Phase 4+ usage)

Designed by IRIS (workspace assistant). Palette: cream + sage green + forest dark (Fresh Modern). Crown + mihrab arch + milk drop concept matching "القصر" name.

---

## Numbers

- **6 git tags** across 5 phases
- **70+ commits**, all conventional-commit style, zero AI tags
- **74 unit tests** passing
- **20+ routes** in production build, no errors
- **6 SQL migrations** applied to live Supabase
- **0 third-party paid services**

---

## Operations

### Login credentials (dev — change for production)
- Admin: `majdi@alqasr.test`
- Employee: `emp@alqasr.test`
- Passwords in KeePass

### Env vars (Netlify dashboard)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable)
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `NEXT_PUBLIC_BRAND_NAME` = `ألبان وأجبان القصر`
- `NEXT_PUBLIC_BRAND_AREA` = `عرّابة — جنين`
- `GEMINI_API_KEY` (for AI assistant)
- `GROQ_API_KEY` (optional fallback)

### Netlify deploy gate
Currently **locked** (auto-build stopped per Mahmoud's request to conserve build minutes). Manual trigger via Netlify dashboard → Deploys → "Trigger deploy" → "Deploy site". OR re-enable continuous deployment in site settings.

---

## What's NOT in v1 (intentional)

- Multi-tenancy / multi-factory
- Tax / VAT handling
- Multi-currency
- Email invoicing
- Mobile app (PWA-grade only; not native iOS/Android)
- Voice input on AI
- Push notifications (notification bell is in-app only)
- Reason breakdown on returns (damaged vs expired vs unsold — single bucket in v1)

All deferred per spec scope cutoff. Data model supports adding any of these later.

---

## Risks / known gotchas

1. **Cairo variable font in pdfmake**: bold doesn't visually differ (same file in all weight slots) — Arabic shapes correctly but bold is visually identical to regular in PDFs. Fix: download static Cairo-Bold.ttf separately when Google adds it back to the repo's static/ subdir.
2. **Netlify secrets scanning**: NEXT_PUBLIC_* vars trigger it. Already handled via `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml`.
3. **Browser print headers**: `6/19/26` and URL at top/bottom of printed receipts are browser-injected — user must uncheck "Headers and footers" in print dialog. Documented in training PDF.
4. **Supabase free tier limits**: 500 MB DB, 1 GB Storage, 50K MAU. At Majdi's scale, this lasts years.

---

## Next steps for production

1. Trigger one Netlify deploy to push v0.5.0 live
2. Add real Majdi user (replace `majdi@alqasr.test`)
3. Real employees (replace `emp@alqasr.test`)
4. Seed real products + Majdi's actual client list
5. (Optional) Buy a custom domain → point at Netlify
6. (Optional) Add Majdi's WhatsApp Business profile photo using `avatar-circle.svg`
7. Set up monthly backup reminder (Supabase free tier has automated daily backups for 7 days)

---

## Files of note

- `docs/superpowers/specs/2026-06-19-alban-al-qasr-design.md` — design spec
- `docs/superpowers/plans/` — 5 phase plans (P1-P5)
- `docs/training-majdi.html` — printable training guide (Arabic, for Majdi to share with his employee)
- `docs/project-summary.md` — this file
- `supabase/migrations/` — 6 SQL migrations
- `README.md` — quick-start
