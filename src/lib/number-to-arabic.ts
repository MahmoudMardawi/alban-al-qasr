// Tafqit — converts a positive number to Arabic words, suitable for receipt vouchers
// (سند قبض). Handles integers and decimals up to 2 places. Caps at billions.
//
// Examples:
//   numberToArabicWords(0)      → "صفر شيكل"
//   numberToArabicWords(1)      → "شيكل واحد"
//   numberToArabicWords(2)      → "شيكلان"
//   numberToArabicWords(125.5)  → "مئة وخمسة وعشرون شيكلًا و٥٠ أغورة"
//
// Intentionally Pragma "diplomatic" Arabic — no extra honorifics, just clear amount.

const ONES_FEM = ["", "إحدى", "اثنتان", "ثلاث", "أربع", "خمس", "ست", "سبع", "ثمان", "تسع"];
const TENS     = ["", "عشر", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

function lessThanHundred(n: number): string {
  if (n === 0) return "";
  if (n < 11) {
    // Special masculine-feminine cases; here we treat as masculine for شيكل.
    const MASC = ["صفر", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
    return MASC[n];
  }
  if (n < 20) {
    const TEEN = ["أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    return TEEN[n - 11];
  }
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (o === 0) return TENS[t];
  return `${ONES_FEM[o] === "" ? "" : (["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"][o])} و${TENS[t]}`;
}

function lessThanThousand(n: number): string {
  if (n < 100) return lessThanHundred(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hStr = HUNDREDS[h];
  if (rest === 0) return hStr;
  return `${hStr} و${lessThanHundred(rest)}`;
}

function lessThanMillion(n: number): string {
  if (n < 1000) return lessThanThousand(n);
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  let thStr: string;
  if (th === 1) thStr = "ألف";
  else if (th === 2) thStr = "ألفان";
  else if (th >= 3 && th <= 10) thStr = `${lessThanThousand(th)} آلاف`;
  else thStr = `${lessThanThousand(th)} ألفًا`;
  if (rest === 0) return thStr;
  return `${thStr} و${lessThanThousand(rest)}`;
}

function intToArabicWords(n: number): string {
  if (n === 0) return "صفر";
  if (n < 1_000_000) return lessThanMillion(n);
  const mil = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  let mStr: string;
  if (mil === 1) mStr = "مليون";
  else if (mil === 2) mStr = "مليونان";
  else if (mil >= 3 && mil <= 10) mStr = `${lessThanMillion(mil)} ملايين`;
  else mStr = `${lessThanMillion(mil)} مليونًا`;
  if (rest === 0) return mStr;
  return `${mStr} و${lessThanMillion(rest)}`;
}

export function numberToArabicWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "—";
  const whole = Math.floor(amount);
  const fraction = Math.round((amount - whole) * 100); // أغورة (10 fils = 1 ag)
  let wholeWords: string;
  if (whole === 0) wholeWords = "صفر شيكل";
  else if (whole === 1) wholeWords = "شيكل واحد";
  else if (whole === 2) wholeWords = "شيكلان";
  else wholeWords = `${intToArabicWords(whole)} شيكلًا`;
  if (fraction > 0) {
    return `${wholeWords} و${fraction} أغورة`;
  }
  return wholeWords;
}
