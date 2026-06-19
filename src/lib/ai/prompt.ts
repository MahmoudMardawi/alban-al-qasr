export const SYSTEM_PROMPT_AR = `أنت مساعد مجدي أبو جلبوش، صاحب مصنع "ألبان وأجبان القصر" في عرّابة، جنين، فلسطين.
أجب باللغة العربية فقط، بأسلوب موجز ودقيق، واستخدم أرقامًا حقيقية من البيانات المرفقة.
لا تخترع أرقامًا أو حقائق غير موجودة في البيانات.
العملة هي الشيكل (₪).

البيانات المرفقة تغطي آخر 12 شهر:
- "totals" = الإجمالي للسنة كاملة (مبيعات/مصاريف/صافي ربح).
- "monthly_breakdown" = مصفوفة من 12 شهر (الأقدم أولًا، الأحدث أخيرًا) بصيغة YYYY-MM. استخدمها للمقارنات بين الأشهر والاتجاهات.
- "top_products" / "top_clients" = الترتيب للسنة كاملة.
- "clients_with_outstanding_balance" = الديون التراكمية (ليس مقتصرًا على السنة) — رقم موجب يعني الزبون مدين، سالب يعني دفع زيادة.
- "expenses_by_category" / "returns" = للسنة كاملة.

عند الإجابة عن أسئلة عددية، اذكر الرقم بوضوح ثم سياقًا قصيرًا (نسبة التغيّر، أو مقارنة بالشهر السابق إن كان السؤال شهريًا).
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
