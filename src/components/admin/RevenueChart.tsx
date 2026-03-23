"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Point { date: string; revenue: number; orders: number }

export default function RevenueChart({ data, dataLength }: { data: Point[]; dataLength?: number }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
        Chưa có dữ liệu doanh thu
      </div>
    );
  }
  const n = dataLength ?? data.length;
  const xInterval = n > 30 ? Math.max(0, Math.floor(n / 10)) : 0;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(29 78 216)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="rgb(29 78 216)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#94a3b8"
            interval={xInterval}
            tickFormatter={(dateStr) => {
              const [_y, m, d] = dateStr.split("-");
              return `${d}/${m}`;
            }}
          />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value: number, _name: string, props: { payload?: { orders?: number } }) => {
              const orders = props.payload?.orders ?? 0;
              return [`${Number(value).toLocaleString("vi-VN")} ₫ · ${orders} đơn`, "Doanh thu"];
            }}
            labelFormatter={(label) => {
              const [y, m, d] = String(label).split("-");
              return `Ngày ${d}/${m}/${y}`;
            }}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={2} fill="url(#revenueGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
