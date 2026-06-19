import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { buildAiContext } from "@/lib/ai/context-builder";
import { askGemini, photoToExpense } from "@/lib/ai/gemini";
import { askGroq } from "@/lib/ai/groq";

export async function POST(req: NextRequest) {
  // Admin check (defense in depth — middleware already redirects non-admins from /ai)
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
        return NextResponse.json({
          answer: `لم أستطع استخراج المبلغ من الصورة. ${extracted.error ?? ""}`.trim(),
          provider: "gemini",
        });
      }
      const { data: exp, error: insErr } = await supabase.from("expenses").insert({
        category: extracted.category,
        amount: extracted.amount,
        spent_at: new Date().toISOString(),
        note: extracted.note ?? null,
        receipt_url: null,
        recorded_by: user.id,
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
