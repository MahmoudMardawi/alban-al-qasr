"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#2d8659", "#c96f2c", "#d4a55a", "#1f6943", "#6b7d72"];
const LABELS: Record<string, string> = { fuel: "وقود", salary: "رواتب", rent: "إيجار", milk: "حليب خام", other: "أخرى" };

interface Props {
  data: Array<{ category: string; amount: number }>;
}

export function ExpensePieChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-center text-muted text-xs py-6 font-cairo">لا توجد مصاريف في هذه الفترة</p>;
  }
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-24 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" innerRadius={26} outerRadius={42} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #d8e7d8", borderRadius: 8, fontFamily: "Cairo, sans-serif", fontSize: 11 }}
              formatter={(v, name) => [formatCurrency(Number(v ?? 0)), LABELS[String(name)] ?? String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 text-[11px] font-cairo">
        {data.map((d, i) => (
          <li key={d.category} className="flex items-center justify-between mb-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {LABELS[d.category] ?? d.category}
            </span>
            <strong className="text-ink">{formatCurrency(d.amount)}</strong>
          </li>
        ))}
        <li className="flex items-center justify-between mt-1 pt-1 border-t border-border">
          <span className="text-muted">الإجمالي</span>
          <strong className="text-forest">{formatCurrency(total)}</strong>
        </li>
      </ul>
    </div>
  );
}
