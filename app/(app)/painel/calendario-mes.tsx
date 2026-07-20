"use client";

import { useState } from "react";
import { money } from "@/lib/format";

/**
 * Calendário do mês com bolinhas por situação em cada dia.
 * Recebe os lançamentos já agrupados por dia de vencimento.
 */

export type DiaCal = {
  dia: number;
  pagas: number;
  aVencer: number;
  atrasadas: number;
  aprovacoes: number;
  total: number;
  valor: number;
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const LEGENDA = [
  { cor: "#2E7D32", rotulo: "Pagas", chave: "pagas" as const },
  { cor: "#E6A600", rotulo: "A vencer", chave: "aVencer" as const },
  { cor: "#D32F2F", rotulo: "Atrasadas", chave: "atrasadas" as const },
  { cor: "#7B4FC4", rotulo: "Aprovações", chave: "aprovacoes" as const },
];

export default function CalendarioMes({
  ano, mes, dias, nomeMes, ehMesAtual,
}: {
  ano: number; mes: number; dias: DiaCal[]; nomeMes: string; ehMesAtual: boolean;
}) {
  const [selecionado, setSelecionado] = useState<number | null>(null);

  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDias = new Date(ano, mes, 0).getDate();
  const hoje = new Date();
  const diaHoje = ehMesAtual ? hoje.getDate() : -1;

  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const celulas: (number | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const detalhe = selecionado != null ? porDia.get(selecionado) : null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-disp text-[15px] font-semibold text-[#1a1a1a]">
          Calendário de {nomeMes}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {LEGENDA.map((l) => (
            <span key={l.chave} className="flex items-center gap-1.5 text-[10.5px] text-[#6c757d]">
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: l.cor }} />
              {l.rotulo}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={d} className={`text-center text-[10.5px] font-semibold pb-1.5 ${i === 0 || i === 6 ? "text-[#c4a04a]" : "text-[#adb5bd]"}`}>
            {d}
          </div>
        ))}

        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`v${i}`} />;
          const info = porDia.get(dia);
          const fds = (i % 7 === 0) || (i % 7 === 6);
          const ehHoje = dia === diaHoje;
          const ativo = selecionado === dia;
          return (
            <button
              key={dia}
              onClick={() => setSelecionado(ativo ? null : dia)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 transition
                ${ehHoje ? "bg-amarelo/15 ring-1 ring-amarelo" : ativo ? "bg-[#f1f3f5]" : "hover:bg-[#f8f9fa]"}`}
            >
              <span className={`text-[12px] leading-none ${ehHoje ? "font-bold text-[#1a1a1a]" : fds ? "text-[#c98a8a]" : "text-[#495057]"}`}>
                {dia}
              </span>
              <span className="flex gap-[2px] h-[5px] items-center">
                {info && LEGENDA.map((l) =>
                  info[l.chave] > 0 ? (
                    <span key={l.chave} className="w-[4px] h-[4px] rounded-full" style={{ background: l.cor }} />
                  ) : null
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3.5 pt-3.5 border-t border-linha2 min-h-[46px]">
        {detalhe ? (
          <div>
            <div className="text-[12.5px] font-semibold text-[#1a1a1a]">
              Dia {detalhe.dia} · {detalhe.total} {detalhe.total === 1 ? "conta" : "contas"} · {money(detalhe.valor)}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {LEGENDA.map((l) =>
                detalhe[l.chave] > 0 ? (
                  <span key={l.chave} className="text-[11px]" style={{ color: l.cor }}>
                    {detalhe[l.chave]} {l.rotulo.toLowerCase()}
                  </span>
                ) : null
              )}
            </div>
          </div>
        ) : (
          <div className="text-[11.5px] text-[#adb5bd]">Toque num dia para ver as contas daquele vencimento.</div>
        )}
      </div>
    </div>
  );
}
