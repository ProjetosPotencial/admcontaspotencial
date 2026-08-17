"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Item = { rotulo: string; valor: number; cor: string };

function fmtCurto(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} mi`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} mil`;
  return `${v.toFixed(0)}`;
}

export default function GraficoBarras({ dados }: { dados: Item[] }) {
  const altura = Math.max(dados.length * 42, 80);
  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="rotulo" width={110}
            tick={{ fontSize: 12, fill: "#475467" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#f6f7f9" }}
            formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Total"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e6e9ee", fontSize: 12, boxShadow: "0 4px 12px rgba(16,24,40,0.08)" }}
          />
          <Bar dataKey="valor" radius={[0, 6, 6, 0]} label={{ position: "right", formatter: (v: any) => fmtCurto(Number(v)), fontSize: 11, fill: "#98a2b3" }}>
            {dados.map((d, i) => <Cell key={i} fill={d.cor} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
