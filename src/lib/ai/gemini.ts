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
