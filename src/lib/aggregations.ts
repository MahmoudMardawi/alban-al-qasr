export function bucketByDay<T>(
  rows: T[],
  getDate: (r: T) => Date,
  getValue: (r: T) => number,
): Array<{ date: string; value: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = getDate(r);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + getValue(r));
  }
  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function sumBy<T>(rows: T[], getValue: (r: T) => number): number {
  return rows.reduce((s, r) => s + (getValue(r) ?? 0), 0);
}

export function topN<T>(rows: T[], getValue: (r: T) => number, n: number): T[] {
  return [...rows]
    .sort((a, b) => getValue(b) - getValue(a))
    .slice(0, n);
}

export function calcNetProfit(args: { revenue: number; expenses: number; wasteCost: number }): number {
  return args.revenue - (args.expenses + args.wasteCost);
}
