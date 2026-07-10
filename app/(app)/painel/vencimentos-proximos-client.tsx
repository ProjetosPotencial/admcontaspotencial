"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TIPOS } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { money } from "@/lib/format";

type Item = {
  id: string; valor: number | null;
  contas: { tipo: string; dia_vencimento: number | null; fornecedor_nome: string | null; lojas: { codigo: string } | null };
};

export default function VencimentosProximosClient({ itens, diaAtual }: { itens: Item[]; diaAtual: number }) {
  const [janela, setJanela] = useState<7 | 15 | 30>(7);

  const filtrados = useMemo(() => {
    return itens
      .filter((l) => {
        const dv = l.contas?.dia_vencimento;
        if (dv == null) return false;
        // dentro do mês (nosso modelo não guarda vencimento com mês/ano
        // próprio, só o dia recorrente) - a janela de 30 dias cobre
        // essencialmente "o resto do mês", que é o limite real do dado.
        return dv >= diaAtual && dv <= Math.min(diaAtual + janela, 31);
      })
      .sort((a, b) => (a.contas?.dia_vencimento ?? 0) - (b.contas?.dia_vencimento ?? 0));
  }, [itens, janela, diaAtual]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 px-5 pt-4 pb-3 border-b border-linha2">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-[#1a1a1a]">Vencimentos próximos</h2>
          <span className="badge bg-alerr-bg text-alerr">{filtrados.length}</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {([7, 15, 30] as const).map((n) => (
            <button key={n} onClick={() => setJanela(n)}
              className={`px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition ${
                janela === n ? "text-amarelo-dark border-b-2 border-amarelo" : "text-[#6c757d] hover:text-[#1a1a1a]"
              }`}>
              {n} dias
            </button>
          ))}
        </div>
        <Link href="/alertas" className="ml-auto text-[12.5px] text-info font-semibold hover:underline">Ver todos →</Link>
      </div>

      <ul>
        {filtrados.slice(0, 8).map((l) => {
          const T = TIPOS[l.contas.tipo];
          const venceHoje = l.contas.dia_vencimento === diaAtual;
          return (
            <li key={l.id} className="flex items-center gap-3.5 px-5 py-3 border-b border-linha2 last:border-0 hover:bg-[#f8f9fa] transition">
              <div className="w-9 h-9 rounded-full grid place-items-center shrink-0" style={{ background: T?.bg }}>
                <TipoIcon tipo={l.contas.tipo} size={16} color={T?.c} />
              </div>
              <div className="min-w-0">
                <b className="text-[13px] font-semibold">{l.contas.lojas?.codigo}</b>
                <small className="block text-[11.5px] text-[#6c757d] truncate">{T?.n} · {l.contas.fornecedor_nome ?? "—"}</small>
              </div>
              <span className="badge bg-info-bg text-info shrink-0 hidden sm:inline-flex">{T?.n}</span>
              <div className="ml-auto text-right shrink-0">
                <div className="text-[13.5px] font-bold font-mono">{money(l.valor)}</div>
                <div className={`text-[11px] font-semibold ${venceHoje ? "text-alerr alerta-piscando" : "text-[#6c757d]"}`}>
                  {venceHoje ? "vence hoje" : `dia ${l.contas.dia_vencimento}`}
                </div>
              </div>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6" className="shrink-0"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
            </li>
          );
        })}
        {filtrados.length === 0 && (
          <li className="text-center py-10 text-[#adb5bd] text-[13px]">Nada vencendo nessa janela.</li>
        )}
      </ul>
    </div>
  );
}
