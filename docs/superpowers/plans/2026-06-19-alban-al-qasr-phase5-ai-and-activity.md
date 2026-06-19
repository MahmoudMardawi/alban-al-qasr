# Alban Al-Qasr — Phase 5: AI Assistant + Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the final two admin features — (1) **AI Assistant ("اسأل بياناتك")** powered by Gemini 2.5 Flash with Groq as failover. Majdi asks Arabic questions about his data and gets answers; he photographs a fuel receipt and an expense row gets created automatically. (2) **Activity feed + notification bell** showing every employee action (visit_created, client_added, etc.) with pending-approvals strip on top, realtime updates via Supabase Realtime, mark-as-read flow. End state: Majdi opens his phone, the bell shows "3" unread, taps it, sees employees just added 2 clients + recorded 1 visit, approves one, then asks the AI "كم بعت لبن اليوم؟" and gets a number — all in Arabic.

**Architecture:** AI server routes in `src/app/api/ai/` use Gemini SDK; pre-aggregated context (top-line numbers, top clients/products, recent activity) is sent as JSON with the user's question so the LLM never touches Supabase directly — eliminates SQL-injection risk. Multimodal photo input goes through the same route with image bytes. Groq SDK fires automatically on Gemini quota/error. Activity bell uses Supabase Realtime subscription on `activity_log` INSERT events; count updates without page refresh. Activity page paginates server-side. All admin-only via existing RLS + layout role check.

**Tech Stack:** Same as Phase 4. Newly used: `@google/genai` (Gemini), `groq-sdk`, Supabase Realtime (built into `@supabase/supabase-js`). No new npm installs.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-06-19-alban-al-qasr-design.md` sections 9 (AI) + 7 (Activity)
- Phase 4 plan: `docs/superpowers/plans/2026-06-19-alban-al-qasr-phase4-intelligence.md`

---

## File Structure (Phase 5 only)

```
supabase/migrations/
└── 0006_realtime_activity.sql              # NEW — enable realtime publication on activity_log

.env.example                                # MODIFY — keep GEMINI_API_KEY/GROQ_API_KEY placeholders (already there)

src/
├── lib/
│   ├── ai-context.ts                       # NEW — pure: shapeContextForAI (TDD)
│   ├── ai/
│   │   ├── context-builder.ts              # NEW — server: build payload from Supabase
│   │   ├── prompt.ts                       # NEW — system prompt + types
│   │   ├── gemini.ts                       # NEW — server: askGemini, photoToExpense
│   │   └── groq.ts                         # NEW — server: askGroq (text-only fallback)
│   └── activity-data.ts                    # NEW — server: getActivityFeed, getUnreadCount, markAllRead
├── app/
│   ├── api/
│   │   └── ai/
│   │       └── route.ts                    # NEW — POST handler: { question, imageBase64? } → { answer }
│   └── (admin)/
│       ├── activity/
│       │   ├── page.tsx                    # NEW — feed + pending approvals
│       │   └── actions.ts                  # NEW — markAllRead
│       └── ai/page.tsx                     # NEW — chat UI
└── components/
    ├── NotificationBell.tsx                # NEW — bell with unread count + realtime
    ├── ActivityFeedItem.tsx                # NEW — one row in the feed
    └── ChatBubble.tsx                      # NEW — AI / user chat bubble

src/components/AdminMoreSheet.tsx           # MODIFY — un-disable AI + Activity
src/components/BrandHeader.tsx              # MODIFY — accept optional `rightSlot` for the bell
src/app/(admin)/layout.tsx                  # MODIFY — pass <NotificationBell /> to BrandHeader
```

---

## Prerequisites

Before Task 1:
- [ ] Phase 4 tagged `v0.4.0-phase4` locally
- [ ] Tests pass (71+)
- [ ] User: a free Gemini API key from https://aistudio.google.com/apikey
- [ ] User (optional): a free Groq API key from https://console.groq.com/keys
- [ ] User: paste both into `.env.local` (`GEMINI_API_KEY=`, `GROQ_API_KEY=`)

App will work without keys — AI page shows a "configure API key" placeholder. Keys can be added later without code changes.

---

## Task 1: Realtime migration for activity_log

**Files:**
- Create: `supabase/migrations/0006_realtime_activity.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ===== 0006_realtime_activity.sql =====
-- Enable Supabase Realtime broadcast on activity_log INSERTs.
-- The bell component subscribes to this channel to update unread count live.
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
```

- [ ] **Step 2: Apply**

```bash
cd "F:/Projects/Cloned/08_OtherProjects/alban-al-qasr"
npx supabase db push
```

- [ ] **Step 3: Verify**

Supabase dashboard → Database → Replication → activity_log should now be in the `supabase_realtime` publication.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_realtime_activity.sql
git commit -m "feat(db): enable realtime on activity_log for live notifications"
```

---

## Task 2: AI context shaping (TDD)

**Files:**
- Create: `src/lib/ai-context.ts`, `tests/lib/ai-context.test.ts`

Pure helper that takes raw rows and returns a compact JSON context for the LLM (keeps payloads under ~5K tokens).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { shapeContextForAI, type RawAiData } from "@/lib/ai-context";

describe("shapeContextForAI", () => {
  const raw: RawAiData = {
    periodLabel: "آخر 30 يوم",
    sales: 1235,
    expenses: 720,
    netProfit: 515,
    salesByProduct: [{ name: "لبن", units: 247, revenue: 1235 }, { name: "لبنة", units: 50, revenue: 900 }],
    topClients:     [{ name: "سوبر ماركت الأخوة", revenue: 800 }, { name: "محلات أبو خالد", revenue: 600 }],
    returns:        [{ product: "لبن", units: 3 }],
    expensesByCategory: [{ category: "fuel", amount: 200 }, { category: "salary", amount: 520 }],
  };

  it("emits a compact JSON-friendly object", () => {
    const out = shapeContextForAI(raw);
    expect(out.period).toBe("آخر 30 يوم");
    expect(out.totals.sales).toBe(1235);
    expect(out.totals.net_profit).toBe(515);
    expect(out.top_products[0].name).toBe("لبن");
  });

  it("truncates lists to top 5 for token economy", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, units: i, revenue: i * 10 }));
    const out = shapeContextForAI({ ...raw, salesByProduct: many });
    expect(out.top_products).toHaveLength(5);
  });

  it("handles empty arrays", () => {
    const out = shapeContextForAI({ ...raw, returns: [], topClients: [] });
    expect(out.returns).toEqual([]);
    expect(out.top_clients).toEqual([]);
  });
});
```

- [ ] **Step 2: RED**

```bash
npm test -- tests/lib/ai-context.test.ts
```

- [ ] **Step 3: Implement `src/lib/ai-context.ts`**

```typescript
export interface RawAiData {
  periodLabel: string;
  sales: number;
  expenses: number;
  netProfit: number;
  salesByProduct: Array<{ name: string; units: number; revenue: number }>;
  topClients:     Array<{ name: string; revenue: number }>;
  returns:        Array<{ product: string; units: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
}

export interface AiContext {
  period: string;
  totals: { sales: number; expenses: number; net_profit: number };
  top_products: Array<{ name: string; units: number; revenue: number }>;
  top_clients:  Array<{ name: string; revenue: number }>;
  returns:      Array<{ product: string; units: number }>;
  expenses_by_category: Array<{ category: string; amount: number }>;
}

export function shapeContextForAI(raw: RawAiData): AiContext {
  return {
    period:      raw.periodLabel,
    totals:      { sales: raw.sales, expenses: raw.expenses, net_profit: raw.netProfit },
    top_products: raw.salesByProduct.slice(0, 5),
    top_clients:  raw.topClients.slice(0, 5),
    returns:      raw.returns,
    expenses_by_category: raw.expensesByCategory,
  };
}
```

- [ ] **Step 4: GREEN**

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-context.ts tests/lib/ai-context.test.ts
git commit -m "feat(ai): context shaper for LLM payloads (TDD)"
```

---

## Task 3: Server context builder

**Files:**
- Create: `src/lib/ai/context-builder.ts`

- [ ] **Step 1: Implement**

```typescript
import { createClient } from "@/lib/supabase/server";
import { periodStartEnd } from "@/lib/periods";
import { sumBy, topN } from "@/lib/aggregations";
import { shapeContextForAI, type AiContext } from "@/lib/ai-context";

export async function buildAiContext(): Promise<AiContext> {
  const supabase = await createClient();
  const { start, end } = periodStartEnd("monthly");

  const [visitsRes, expensesRes, prodRes, clientsRes] = await Promise.all([
    supabase.from("visits")
      .select("client_id, clients(name), visit_lines(line_type, qty, unit_price, product_id, products(name_ar))")
      .gte("visited_at", start.toISOString()).lt("visited_at", end.toISOString()),
    supabase.from("expenses").select("category, amount")
      .gte("spent_at", start.toISOString()).lt("spent_at", end.toISOString()),
    supabase.from("production").select("qty_wasted, products(base_cost)")
      .gte("produced_at", start.toISOString()).lt("produced_at", end.toISOString()),
    supabase.from("clients").select("id, name").is("merged_into_client_id", null),
  ]);

  type V = { client_id: string; clients: { name: string } | null;
             visit_lines: Array<{ line_type: string; qty: number; unit_price: number | null; product_id: string; products: { name_ar: string } | null }> };
  const visits = ((visitsRes.data ?? []) as unknown as V[]);

  const saleLines = visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "sale"));
  const sales     = sumBy(saleLines, (l) => Number(l.qty) * Number(l.unit_price ?? 0));

  const expRows  = (expensesRes.data ?? []) as Array<{ category: string; amount: number }>;
  const expenses = sumBy(expRows, (e) => Number(e.amount));

  type ProdRow = { qty_wasted: number; products: { base_cost: number | null } | null };
  const wasteCost = sumBy((prodRes.data ?? []) as unknown as ProdRow[], (p) => Number(p.qty_wasted) * Number(p.products?.base_cost ?? 0));
  const netProfit = sales - (expenses + wasteCost);

  // Products
  const productMap = new Map<string, { name: string; units: number; revenue: number }>();
  for (const l of saleLines) {
    const cur = productMap.get(l.product_id) ?? { name: l.products?.name_ar ?? "?", units: 0, revenue: 0 };
    cur.units   += Number(l.qty);
    cur.revenue += Number(l.qty) * Number(l.unit_price ?? 0);
    productMap.set(l.product_id, cur);
  }
  const salesByProduct = topN(Array.from(productMap.values()), (p) => p.revenue, 12);

  // Clients
  const clientMap = new Map<string, { name: string; revenue: number }>();
  const clientNameLookup = new Map<string, string>(((clientsRes.data ?? []) as Array<{id:string;name:string}>).map((c) => [c.id, c.name]));
  for (const v of visits) {
    const lines = v.visit_lines.filter((l) => l.line_type === "sale");
    const total = sumBy(lines, (l) => Number(l.qty) * Number(l.unit_price ?? 0));
    const name = v.clients?.name ?? clientNameLookup.get(v.client_id) ?? "?";
    const cur = clientMap.get(v.client_id) ?? { name, revenue: 0 };
    cur.revenue += total;
    clientMap.set(v.client_id, cur);
  }
  const topClients = topN(Array.from(clientMap.values()), (c) => c.revenue, 12);

  // Returns
  const returnMap = new Map<string, number>();
  for (const l of visits.flatMap((v) => v.visit_lines.filter((l) => l.line_type === "return_in"))) {
    const name = l.products?.name_ar ?? "?";
    returnMap.set(name, (returnMap.get(name) ?? 0) + Number(l.qty));
  }
  const returns = Array.from(returnMap.entries()).map(([product, units]) => ({ product, units }));

  // Expenses by category
  const expCats = new Map<string, number>();
  for (const e of expRows) expCats.set(e.category, (expCats.get(e.category) ?? 0) + Number(e.amount));
  const expensesByCategory = Array.from(expCats.entries()).map(([category, amount]) => ({ category, amount }));

  return shapeContextForAI({
    periodLabel: "آخر شهر (الشهر الحالي)",
    sales, expenses, netProfit,
    salesByProduct, topClients, returns, expensesByCategory,
  });
}
```

- [ ] **Step 2: TS check + commit**

```bash
npx tsc --noEmit
git add src/lib/ai/context-builder.ts
git commit -m "feat(ai): server-side context builder pulling current-month aggregates"
```

---

## Task 4: System prompt + Gemini client

**Files:**
- Create: `src/lib/ai/prompt.ts`, `src/lib/ai/gemini.ts`

- [ ] **Step 1: Create `src/lib/ai/prompt.ts`**

```typescript
export const SYSTEM_PROMPT_AR = `أنت مساعد مجدي أبو جلبوش، صاحب مصنع "ألبان وأجبان القصر" في عرّابة، جنين، فلسطين.
أجب باللغة العربية فقط، بأسلوب موجز ودقيق، واستخدم أرقامًا حقيقية من البيانات المرفقة.
لا تخترع أرقامًا أو حقائق غير موجودة في البيانات.
العملة هي الشيكل (₪).
عند الإجابة عن أسئلة عددية، اذكر الرقم بوضوح ثم سياقًا قصيرًا (مقارنة بالشهر السابق إن أمكن).
إذا لم تكن البيانات تكفي للإجابة، قل ذلك صراحةً واقترح البيانات الإضافية المطلوبة.`;

export const PHOTO_EXPENSE_PROMPT_AR = `هذه صورة فاتورة. استخرج المعلومات التالية بصيغة JSON بدون أي شرح إضافي:
{
  "amount": <رقم بالشيكل>,
  "category": "fuel" | "salary" | "rent" | "milk" | "other",
  "vendor": <اسم البائع/المحطة كنص قصير>,
  "note": <ملخص قصير لما اشتُري بالعربية>
}
إذا كانت العملة غير الشيكل، حوّل بسعر تقريبي ($ = 3.7 ₪).
إذا لم تستطع استخراج المبلغ، أعد {"error": "غير قادر على القراءة"}.`;

export interface AskRequest {
  question: string;
  context: unknown;
}

export interface AskResponse {
  answer: string;
  provider: "gemini" | "groq";
}

export interface PhotoExpenseResult {
  amount?: number;
  category?: "fuel" | "salary" | "rent" | "milk" | "other";
  vendor?: string;
  note?: string;
  error?: string;
}
```

- [ ] **Step 2: Create `src/lib/ai/gemini.ts`**

```typescript
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_AR, PHOTO_EXPENSE_PROMPT_AR, type AskRequest, type PhotoExpenseResult } from "./prompt";

const MODEL = "gemini-2.5-flash";

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey: key });
}

export async function askGemini(req: AskRequest): Promise<string> {
  const ai = client();
  const userPayload = `سؤال المستخدم: ${req.question}\n\nالبيانات الحالية:\n${JSON.stringify(req.context, null, 2)}`;

  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: userPayload }] }],
    config: { systemInstruction: SYSTEM_PROMPT_AR, temperature: 0.2 },
  });

  return resp.text ?? "";
}

export async function photoToExpense(imageBase64: string, mimeType: string = "image/jpeg"): Promise<PhotoExpenseResult> {
  const ai = client();
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: [{
      role: "user",
      parts: [
        { text: PHOTO_EXPENSE_PROMPT_AR },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
    }],
    config: { temperature: 0.0, responseMimeType: "application/json" },
  });

  const text = resp.text ?? "{}";
  try {
    return JSON.parse(text) as PhotoExpenseResult;
  } catch {
    return { error: "تعذّر قراءة الإجابة" };
  }
}
```

- [ ] **Step 3: TS check + commit**

```bash
npx tsc --noEmit
git add src/lib/ai/prompt.ts src/lib/ai/gemini.ts
git commit -m "feat(ai): Gemini client — askGemini + photoToExpense + Arabic system prompts"
```

---

## Task 5: Groq fallback

**Files:**
- Create: `src/lib/ai/groq.ts`

- [ ] **Step 1: Implement**

```typescript
import Groq from "groq-sdk";
import { SYSTEM_PROMPT_AR, type AskRequest } from "./prompt";

const MODEL = "llama-3.3-70b-versatile";

function client() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: key });
}

export async function askGroq(req: AskRequest): Promise<string> {
  const groq = client();
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT_AR },
      { role: "user",   content: `سؤال المستخدم: ${req.question}\n\nالبيانات الحالية:\n${JSON.stringify(req.context, null, 2)}` },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}
```

- [ ] **Step 2: TS check + commit**

```bash
npx tsc --noEmit
git add src/lib/ai/groq.ts
git commit -m "feat(ai): Groq Llama-3.3 fallback (text-only)"
```

---

## Task 6: AI API route

**Files:**
- Create: `src/app/api/ai/route.ts`

POST endpoint receives `{ question, imageBase64?, mimeType? }`. If imageBase64 → call `photoToExpense` and create expense row. Else → build context + call Gemini, fall back to Groq on error. Admin-only via session check.

- [ ] **Step 1: Implement**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { buildAiContext } from "@/lib/ai/context-builder";
import { askGemini, photoToExpense } from "@/lib/ai/gemini";
import { askGroq } from "@/lib/ai/groq";

export async function POST(req: NextRequest) {
  // Admin check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("role, full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { question?: string; imageBase64?: string; mimeType?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid body" }, { status: 400 }); }

  // --- Image flow: photo → expense
  if (body.imageBase64) {
    try {
      const extracted = await photoToExpense(body.imageBase64, body.mimeType ?? "image/jpeg");
      if (extracted.error || !extracted.amount || !extracted.category) {
        return NextResponse.json({ answer: `لم أستطع استخراج المبلغ من الصورة. ${extracted.error ?? ""}`.trim(), provider: "gemini" });
      }
      const { data: exp, error: insErr } = await supabase.from("expenses").insert({
        category: extracted.category, amount: extracted.amount,
        spent_at: new Date().toISOString(), note: extracted.note ?? null,
        receipt_url: null, recorded_by: user.id,
      }).select("id").single();
      if (insErr) return NextResponse.json({ answer: `الاستخراج نجح لكن الحفظ فشل: ${insErr.message}` });

      await logActivity(supabase, {
        actor_id: user.id, action: "expense_added", entity_type: "expense", entity_id: exp.id,
        summary_ar: `أضاف ${profile.full_name ?? "المدير"} مصروفًا عبر صورة فاتورة: ${extracted.amount} ₪ (${extracted.category})`,
        payload: { via: "ai_photo", amount: extracted.amount, category: extracted.category, vendor: extracted.vendor ?? null },
      });

      return NextResponse.json({
        answer: `✓ تم. أضفت ${extracted.amount} ₪ تحت ${extracted.category}${extracted.vendor ? ` (${extracted.vendor})` : ""}.`,
        provider: "gemini",
      });
    } catch (e) {
      return NextResponse.json({ answer: `حدث خطأ: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
  }

  // --- Text flow: question → answer
  if (!body.question?.trim()) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const context = await buildAiContext();

  try {
    const answer = await askGemini({ question: body.question, context });
    return NextResponse.json({ answer, provider: "gemini" });
  } catch (geminiErr) {
    console.warn("[ai] Gemini failed, falling back to Groq:", geminiErr);
    try {
      const answer = await askGroq({ question: body.question, context });
      return NextResponse.json({ answer, provider: "groq" });
    } catch (groqErr) {
      const detail = groqErr instanceof Error ? groqErr.message : String(groqErr);
      return NextResponse.json({
        answer: `كلا الموفّرَين غير متاحَين الآن. تحقّق من مفاتيح API. (${detail})`,
      }, { status: 503 });
    }
  }
}
```

- [ ] **Step 2: TS check + commit**

```bash
npx tsc --noEmit
git add src/app/api/ai/route.ts
git commit -m "feat(ai): POST /api/ai — text Q&A + photo→expense, Gemini primary + Groq fallback"
```

---

## Task 7: AI chat page

**Files:**
- Create: `src/components/ChatBubble.tsx`, `src/app/(admin)/ai/page.tsx`

- [ ] **Step 1: Create `src/components/ChatBubble.tsx`**

```tsx
interface Props {
  role: "user" | "assistant";
  text: string;
  provider?: "gemini" | "groq";
  thumbnailUrl?: string;
}

export function ChatBubble({ role, text, provider, thumbnailUrl }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-2`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2.5 font-cairo text-sm ${
        isUser
          ? "bg-primary text-white rounded-br-md"
          : "bg-white border border-border text-ink rounded-bl-md"
      }`}>
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="rounded-lg mb-1.5 max-h-24 object-cover" />
        )}
        <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
        {!isUser && provider && (
          <div className="text-[9px] mt-1 text-muted font-cairo">via {provider}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(admin)/ai/page.tsx`**

```tsx
"use client";

import { useState, useRef } from "react";
import { Camera, Send, RotateCcw, Sparkles } from "lucide-react";
import { ChatBubble } from "@/components/ChatBubble";

interface ChatMsg { id: string; role: "user" | "assistant"; text: string; provider?: "gemini" | "groq"; thumbnailUrl?: string }

const SUGGESTIONS = [
  "كم بعت لبن هذا الشهر؟",
  "أي زبون عنده أعلى ديون؟",
  "ما أكثر منتج مرتجع؟",
  "قارن أرباح هذا الشهر بالشهر السابق",
];

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(textOverride?: string) {
    const question = (textOverride ?? input).trim();
    if (!question || busy) return;
    setInput("");
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", text: question };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await r.json();
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: data.answer ?? data.error ?? "—", provider: data.provider }]);
    } catch (e) {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: `خطأ: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function sendImage(file: File) {
    if (busy) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;          // "data:image/jpeg;base64,XXXX"
      const [meta, base64] = result.split(",");
      const mimeType = meta.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
      const thumb = URL.createObjectURL(file);

      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: "📷 صورة فاتورة", thumbnailUrl: thumb }]);
      setBusy(true);
      try {
        const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: base64, mimeType }) });
        const data = await r.json();
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: data.answer ?? "—", provider: data.provider }]);
      } catch (e) {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: `خطأ: ${e instanceof Error ? e.message : String(e)}` }]);
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function reset() { setMessages([]); }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="bg-gradient-to-br from-forest to-primary-dk text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-gold" />
          <div>
            <div className="font-cairo font-bold text-base">اسأل بياناتك</div>
            <div className="text-[10px] opacity-80 font-cairo">مدعوم بـ Gemini · مجاني</div>
          </div>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-xs bg-white/15 px-2.5 py-1 rounded-lg font-cairo">
          <RotateCcw size={12} /> محادثة جديدة
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 bg-surface">
        {messages.length === 0 && (
          <div className="text-center text-muted text-sm mt-8 font-cairo">
            اسأل عن مبيعاتك، أرباحك، أو ارفع صورة فاتورة لتسجيلها كمصروف.
          </div>
        )}
        {messages.map((m) => <ChatBubble key={m.id} role={m.role} text={m.text} provider={m.provider} thumbnailUrl={m.thumbnailUrl} />)}
        {busy && <div className="text-center text-muted text-xs font-cairo">جارٍ التفكير...</div>}
      </div>

      <div className="bg-white border-t border-border">
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}
              className="whitespace-nowrap text-[11px] font-cairo bg-info-bg text-primary-dk border border-border rounded-full px-3 py-1.5 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 p-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); if (fileRef.current) fileRef.current.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary-dk disabled:opacity-50">
            <Camera size={16} />
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="اكتب سؤالك..." disabled={busy}
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm font-cairo focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={() => send()} disabled={busy || !input.trim()}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50 shadow-sm">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TS check + commit**

```bash
npx tsc --noEmit
git add src/components/ChatBubble.tsx "src/app/(admin)/ai"
git commit -m "feat(ai): chat UI with suggestion chips + camera capture for receipt photos"
```

---

## Task 8: Activity data layer

**Files:**
- Create: `src/lib/activity-data.ts`

- [ ] **Step 1: Implement**

```typescript
import { createClient } from "@/lib/supabase/server";

export interface ActivityRow {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary_ar: string | null;
  read_by_admin: boolean;
  created_at: string;
}

export interface ActivityFilters {
  actorId?: string | null;
  action?: string | null;
  unreadOnly?: boolean;
}

export async function getActivityFeed(filters: ActivityFilters = {}, limit = 100): Promise<ActivityRow[]> {
  const supabase = await createClient();
  let q = supabase.from("activity_log")
    .select("id, actor_id, action, entity_type, entity_id, summary_ar, read_by_admin, created_at, users(full_name)")
    .order("created_at", { ascending: false }).limit(limit);

  if (filters.actorId)    q = q.eq("actor_id", filters.actorId);
  if (filters.action)     q = q.eq("action", filters.action);
  if (filters.unreadOnly) q = q.eq("read_by_admin", false);

  const { data } = await q;
  type Row = { id: string; actor_id: string; action: string; entity_type: string | null; entity_id: string | null; summary_ar: string | null; read_by_admin: boolean; created_at: string; users: { full_name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, actor_id: r.actor_id, actor_name: r.users?.full_name ?? "?", action: r.action,
    entity_type: r.entity_type, entity_id: r.entity_id, summary_ar: r.summary_ar,
    read_by_admin: r.read_by_admin, created_at: r.created_at,
  }));
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("activity_log")
    .select("id", { count: "exact", head: true }).eq("read_by_admin", false);
  return count ?? 0;
}
```

- [ ] **Step 2: TS check + commit**

```bash
npx tsc --noEmit
git add src/lib/activity-data.ts
git commit -m "feat(activity): server-side activity feed reader + unread count"
```

---

## Task 9: Activity page + markAllRead action

**Files:**
- Create: `src/components/ActivityFeedItem.tsx`, `src/app/(admin)/activity/page.tsx`, `src/app/(admin)/activity/actions.ts`

- [ ] **Step 1: Create `src/components/ActivityFeedItem.tsx`**

```tsx
import { formatRelativeDate } from "@/lib/format";

interface Props {
  actor: string;
  action: string;
  summary: string | null;
  createdAt: string;
  unread: boolean;
}

const ACTION_LABEL: Record<string, { ar: string; emoji: string }> = {
  visit_created:      { ar: "زيارة جديدة",       emoji: "🛒" },
  visit_edited:       { ar: "تعديل زيارة",       emoji: "✏️" },
  client_added:       { ar: "زبون جديد",         emoji: "👤" },
  client_approved:    { ar: "موافقة على زبون",   emoji: "✓" },
  clients_merged:     { ar: "دمج زبائن",         emoji: "🔀" },
  expense_added:      { ar: "مصروف جديد",        emoji: "💸" },
  product_added:      { ar: "منتج جديد",         emoji: "📦" },
  production_recorded:{ ar: "إنتاج جديد",        emoji: "🏭" },
  payment_recorded:   { ar: "دفعة مستلمة",       emoji: "💰" },
};

export function ActivityFeedItem({ actor, action, summary, createdAt, unread }: Props) {
  const label = ACTION_LABEL[action] ?? { ar: action, emoji: "•" };
  return (
    <li className={`flex items-start gap-2 p-3 rounded-xl ${unread ? "bg-yellow-50/40 border border-yellow-200" : "bg-white border border-border"}`}>
      <div className="text-base shrink-0">{label.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="font-cairo text-sm text-ink">
          <strong>{actor}</strong> <span className="text-muted">·</span> <span className="text-primary-dk">{label.ar}</span>
        </div>
        {summary && <div className="text-[12px] text-muted font-cairo mt-0.5">{summary}</div>}
        <div className="text-[10px] text-muted font-cairo mt-1">{formatRelativeDate(new Date(createdAt))}</div>
      </div>
      {unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
    </li>
  );
}
```

- [ ] **Step 2: Create `src/app/(admin)/activity/actions.ts`**

```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAllRead(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("activity_log").update({ read_by_admin: true }).eq("read_by_admin", false);
  if (error) return { error: error.message };
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  return {};
}
```

- [ ] **Step 3: Create `src/app/(admin)/activity/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getActivityFeed } from "@/lib/activity-data";
import { ActivityFeedItem } from "@/components/ActivityFeedItem";
import { ClientApprovalCard } from "@/components/ClientApprovalCard";
import { MarkAllReadButton } from "@/components/MarkAllReadButton";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ actor?: string; action?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [feed, employeesRes, pendingRes] = await Promise.all([
    getActivityFeed({ actorId: sp.actor || null, action: sp.action || null }),
    supabase.from("users").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("clients").select("id, name, type, phone, added_by, users(full_name)").eq("is_approved", false).is("merged_into_client_id", null),
  ]);

  type P = { id: string; name: string; type: string | null; phone: string | null; added_by: string | null; users: { full_name: string } | null };
  const pending = (pendingRes.data ?? []) as unknown as P[];

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-cairo font-bold text-ink text-base flex items-center gap-1.5"><Bell size={16} /> الإشعارات</h2>
        <MarkAllReadButton />
      </div>

      {pending.length > 0 && (
        <div className="px-3 mb-4">
          <h3 className="text-[11px] font-cairo font-bold text-muted uppercase mb-2">بانتظار الموافقة ({pending.length})</h3>
          {pending.map((c) => (
            <ClientApprovalCard key={c.id} id={c.id} name={c.name} type={c.type} phone={c.phone} added_by_name={c.users?.full_name ?? null} />
          ))}
        </div>
      )}

      <form method="get" className="px-4 py-2 grid grid-cols-2 gap-2">
        <select name="actor" defaultValue={sp.actor ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
          <option value="">كل الفاعلين</option>
          {(employeesRes.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select name="action" defaultValue={sp.action ?? ""} className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-cairo">
          <option value="">كل الإجراءات</option>
          <option value="visit_created">زيارة جديدة</option>
          <option value="client_added">زبون جديد</option>
          <option value="client_approved">موافقة على زبون</option>
          <option value="clients_merged">دمج زبائن</option>
          <option value="expense_added">مصروف جديد</option>
          <option value="product_added">منتج جديد</option>
          <option value="production_recorded">إنتاج جديد</option>
        </select>
        <button type="submit" className="col-span-2 bg-primary text-white text-xs font-cairo font-semibold py-1.5 rounded-lg">تطبيق</button>
      </form>

      <h3 className="text-[11px] font-cairo font-bold text-muted uppercase px-4 mt-2 mb-2">سجل النشاط ({feed.length})</h3>
      {feed.length === 0 ? (
        <EmptyState icon={Bell} title="لا يوجد نشاط بعد" />
      ) : (
        <ul className="px-3 space-y-1.5">
          {feed.map((a) => (
            <ActivityFeedItem
              key={a.id} actor={a.actor_name} action={a.action} summary={a.summary_ar}
              createdAt={a.created_at} unread={!a.read_by_admin}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/MarkAllReadButton.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllRead } from "@/app/(admin)/activity/actions";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  function go() { startTransition(async () => { await markAllRead(); }); }
  return (
    <button onClick={go} disabled={pending}
      className="flex items-center gap-1 text-xs font-cairo font-semibold text-primary bg-info-bg px-3 py-1.5 rounded-full border border-border disabled:opacity-50">
      <CheckCheck size={14} /> {pending ? "جارٍ..." : "وضع الكل كمقروء"}
    </button>
  );
}
```

- [ ] **Step 5: TS check + commit**

```bash
npx tsc --noEmit
git add "src/app/(admin)/activity" src/components/ActivityFeedItem.tsx src/components/MarkAllReadButton.tsx
git commit -m "feat(activity): feed page with pending approvals + action filters + mark-read"
```

---

## Task 10: Notification bell with realtime

**Files:**
- Create: `src/components/NotificationBell.tsx`
- Modify: `src/components/BrandHeader.tsx`, `src/app/(admin)/layout.tsx`

- [ ] **Step 1: Create `src/components/NotificationBell.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props { initialCount: number }

export function NotificationBell({ initialCount }: Props) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("activity_log_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, () => {
        setCount((c) => c + 1);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "activity_log" }, async () => {
        // On update (e.g., mark-as-read), refetch the exact count
        const { count: c } = await supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("read_by_admin", false);
        setCount(c ?? 0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Link href="/activity" aria-label="الإشعارات" className="relative inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-info-bg">
      <Bell size={18} className="text-forest" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-warn text-white text-[10px] font-cairo font-bold rounded-full flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Modify `src/components/BrandHeader.tsx`** — accept optional rightSlot

Replace contents of `src/components/BrandHeader.tsx` with:

```tsx
import type { ReactNode } from "react";

export function BrandHeader({ subtitle, rightSlot }: { subtitle?: string; rightSlot?: ReactNode }) {
  const name = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ألبان وأجبان القصر";
  const area = process.env.NEXT_PUBLIC_BRAND_AREA ?? "عرّابة — جنين";
  return (
    <header className="bg-white border-b border-border px-4 py-3 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-lg text-forest leading-tight truncate">{name}</h1>
            <p className="text-[11px] text-muted mt-0.5 truncate">{subtitle ?? area}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
          <form action="/logout" method="post">
            <button type="submit" className="text-xs text-muted hover:text-ink underline">خروج</button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Modify `src/app/(admin)/layout.tsx`** — pass the bell

```tsx
import { getCurrentUserWithRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { AdminBottomNav } from "@/components/AdminBottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { getUnreadCount } from "@/lib/activity-data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserWithRole();
  if (!user || user.role !== "admin") redirect("/");

  const unread = await getUnreadCount();

  return (
    <div className="min-h-screen pb-20">
      <BrandHeader subtitle={`مرحباً ${user.full_name} · المدير`} rightSlot={<NotificationBell initialCount={unread} />} />
      <main className="max-w-md mx-auto">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
```

- [ ] **Step 4: TS check + commit**

```bash
npx tsc --noEmit
git add src/components/NotificationBell.tsx src/components/BrandHeader.tsx "src/app/(admin)/layout.tsx"
git commit -m "feat(activity): notification bell with Supabase Realtime + admin layout slot"
```

---

## Task 11: Un-disable AI + Activity in More-sheet

**Files:**
- Modify: `src/components/AdminMoreSheet.tsx`

- [ ] **Step 1: Drop `disabled: true` + "(قريباً)" from AI and Activity entries**

In `src/components/AdminMoreSheet.tsx` change the last two ITEMS entries:

```typescript
  { href: "/ai",         label: "اسأل بياناتك", icon: Sparkles },
  { href: "/activity",   label: "الإشعارات",    icon: Bell },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AdminMoreSheet.tsx
git commit -m "feat(admin): un-disable AI assistant + Activity in More sheet"
```

---

## Task 12: Full E2E + tag v0.5.0-phase5

- [ ] **Step 1: Make sure `.env.local` has your AI keys**

```
GEMINI_API_KEY=AIzaSy...        # from https://aistudio.google.com/apikey
GROQ_API_KEY=gsk_...             # from https://console.groq.com/keys
```

Restart `npm run dev` after editing `.env.local`.

- [ ] **Step 2: Tests + build**

```bash
npm test
npm run build
```

Both must pass. ~75+ tests.

- [ ] **Step 3: Manual E2E (local)**

Log in as Majdi:

1. ✅ Bell icon visible in admin header. If you created any activity in earlier phases, bell shows count.
2. ✅ Tap bell → /activity opens. Pending approvals strip (any unapproved clients) + activity feed with action filter + actor filter. Unread items have yellow tint + dot.
3. ✅ Tap "وضع الكل كمقروء" → bell count drops to 0, list still shows but no tint.
4. ✅ Have an employee (in another browser/incognito as `emp@alqasr.test`) create a visit. Within ~2 seconds, bell count on Majdi's screen increments automatically (no refresh) — that's Realtime working.
5. ✅ "المزيد" → "اسأل بياناتك". Type "كم بعت لبن هذا الشهر؟" → AI responds in Arabic with a real number.
6. ✅ Tap a suggestion chip → sends immediately.
7. ✅ Tap camera icon → pick any receipt-looking image from your phone → AI extracts amount + category, creates expense, replies "✓ تم. أضفت ___ ₪..." → check /expenses to confirm row was inserted.
8. ✅ If Gemini key is missing/wrong → response says "تحقق من مفاتيح API". If only Groq is missing, Gemini still works.

- [ ] **Step 4: Tag (local only — hold push)**

```bash
git tag -a v0.5.0-phase5 -m "Phase 5: AI assistant (Gemini + Groq fallback) + activity feed + notification bell with Supabase Realtime"
```

---

## Phase 5 Acceptance Checklist

- [ ] Tests pass (existing + new AI context test)
- [ ] `npm run build` clean
- [ ] Bell renders + updates live when an employee acts
- [ ] AI text question returns a sensible Arabic answer
- [ ] AI photo upload creates an expense row + logs activity
- [ ] Tag `v0.5.0-phase5` created locally
- [ ] No `Co-Authored-By` / 🤖 in commits

**This is the final phase. After acceptance + push + Netlify deploy, the app ships as `v1.0.0` for Majdi to start real-world use.**
