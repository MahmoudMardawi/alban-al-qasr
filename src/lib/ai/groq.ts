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
