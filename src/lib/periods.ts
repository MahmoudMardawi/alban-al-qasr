export type Period = "daily" | "weekly" | "monthly" | "yearly";

export function periodLabel(p: Period): string {
  switch (p) {
    case "daily":   return "يومي";
    case "weekly":  return "أسبوعي";
    case "monthly": return "شهري";
    case "yearly":  return "سنوي";
  }
}

/**
 * Returns inclusive-start, exclusive-end (canonical half-open interval).
 * Week starts Saturday (Levant convention).
 */
export function periodStartEnd(period: Period, ref: Date = new Date()): { start: Date; end: Date } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  if (period === "daily") {
    const start = new Date(y, m, d);
    const end   = new Date(y, m, d + 1);
    return { start, end };
  }
  if (period === "weekly") {
    const dow = ref.getDay();                    // Sun=0..Sat=6
    const daysSinceSat = (dow + 1) % 7;          // Sat→0, Sun→1, ..., Fri→6
    const start = new Date(y, m, d - daysSinceSat);
    const end   = new Date(y, m, d - daysSinceSat + 7);
    return { start, end };
  }
  if (period === "monthly") {
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 1);
    return { start, end };
  }
  // yearly
  const start = new Date(y, 0, 1);
  const end   = new Date(y + 1, 0, 1);
  return { start, end };
}

/**
 * Returns a Date that, when fed to periodStartEnd with the same period,
 * yields the immediately preceding period.
 */
export function previousPeriod(period: Period, ref: Date = new Date()): Date {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  switch (period) {
    case "daily":   return new Date(y, m, d - 1);
    case "weekly":  return new Date(y, m, d - 7);
    case "monthly": return new Date(y, m - 1, d);
    case "yearly":  return new Date(y - 1, m, d);
  }
}
