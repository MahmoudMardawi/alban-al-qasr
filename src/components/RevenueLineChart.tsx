"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: Array<{ date: string; value: number }>;
}

export function RevenueLineChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-center text-muted text-xs py-6 font-cairo">لا توجد مبيعات في هذه الفترة</p>;
  }
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2d8659" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2d8659" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7d72" }} tickFormatter={(d) => String(d).slice(-2)} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid #d8e7d8", borderRadius: 8, fontFamily: "Cairo, sans-serif", fontSize: 12 }}
            formatter={(v) => [formatCurrency(Number(v ?? 0)), "الإيراد"]}
            labelFormatter={(l) => `يوم ${String(l)}`}
          />
          <Area type="monotone" dataKey="value" stroke="#2d8659" strokeWidth={2} fill="url(#grad-rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
