"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Ponto = { mes: string; total: number; atual?: boolean };

function fmtCurto(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)} mi`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)} mil`;
  return `R$ ${v.toFixed(0)}`;
}

export default function GraficoEvolucao({ dados }: { dados: Ponto[] }) {
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="corEvolucao" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFC107" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FFC107" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#98a2b3" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#98a2b3" }} axisLine={false} tickLine={false} tickFormatter={fmtCurto} width={64} />
          <Tooltip
            formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Total"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e6e9ee", fontSize: 12, boxShadow: "0 4px 12px rgba(16,24,40,0.08)" }}
          />
          <Area type="monotone" dataKey="total" stroke="#F2AE00" strokeWidth={2.5} fill="url(#corEvolucao)" dot={{ r: 3, fill: "#F2AE00" }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
