"use client";

import { useState } from "react";
import { money } from "@/lib/format";

export type FatiaTipo = { chave: string; nome: string; valor: number; cor: string };

/** Donut de gastos por categoria, com destaque no hover. */
export default function DonutTipos({ fatias, total }: { fatias: FatiaTipo[]; total: number }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const R = 54, ESP = 18, C = 2 * Math.PI * R;
  let acumulado = 0;

  const emFoco = fatias.find((f) => f.chave === ativo);

  return (
    <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
      <div className="relative shrink-0" style={{ width: 148, height: 148 }}>
        <svg viewBox="0 0 148 148" className="-rotate-90">
          <circle cx="74" cy="74" r={R} fill="none" stroke="#f1f3f5" strokeWidth={ESP} />
          {fatias.map((f) => {
            const frac = total > 0 ? f.valor / total : 0;
            const dash = frac * C;
            const el = (
              <circle
                key={f.chave}
                cx="74" cy="74" r={R} fill="none"
                stroke={f.cor}
                strokeWidth={ativo === f.chave ? ESP + 4 : ESP}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-acumulado}
                onMouseEnter={() => setAtivo(f.chave)}
                onMouseLeave={() => setAtivo(null)}
                style={{ transition: "stroke-width 150ms", cursor: "pointer" }}
              />
            );
            acumulado += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
          <div>
            <div className="font-mono font-bold text-[13px] text-[#1a1a1a] leading-tight">
              {money(emFoco ? emFoco.valor : total)}
            </div>
            <div className="text-[10px] text-[#adb5bd] mt-0.5">
              {emFoco ? emFoco.nome : "Total"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 min-w-[170px]">
        {fatias.map((f) => {
          const pct = total > 0 ? (f.valor / total) * 100 : 0;
          return (
            <div
              key={f.chave}
              onMouseEnter={() => setAtivo(f.chave)}
              onMouseLeave={() => setAtivo(null)}
              className={`flex items-center gap-2 text-[11.5px] rounded px-1.5 py-0.5 -mx-1.5 transition ${ativo === f.chave ? "bg-[#f8f9fa]" : ""}`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.cor }} />
              <span className="text-[#495057] flex-1 truncate">{f.nome}</span>
              <span className="text-[#adb5bd] font-mono shrink-0">{pct.toFixed(1)}%</span>
              <span className="font-mono font-semibold text-[#1a1a1a] shrink-0 w-[86px] text-right">{money(f.valor)}</span>
            </div>
          );
        })}
        {fatias.length === 0 && <div className="text-[12px] text-[#adb5bd]">Sem lançamentos com valor neste mês.</div>}
      </div>
    </div>
  );
}
