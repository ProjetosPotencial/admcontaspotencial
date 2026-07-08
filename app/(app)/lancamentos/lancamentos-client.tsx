"use client";

import { useState, useMemo } from "react";
import { TIPOS, SITUACAO } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { money, MES } from "@/lib/format";

type Item = {
  id: string; ano: number; mes: number; valor: number | null; situacao: string;
  contas: { tipo: string; fornecedor_nome: string | null; lojas: { codigo: string; coban: string } | null };
};

export default function LancamentosClient({ itens }: { itens: Item[] }) {
  const [fMes, setFMes] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fSituacao, setFSituacao] = useState("todos");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    return itens.filter((l) => {
      const m = fMes === "todos" || String(l.mes) === fMes;
      const t = fTipo === "todos" || l.contas.tipo === fTipo;
      const s = fSituacao === "todos" || l.situacao === fSituacao;
      const q = busca === "" || (l.contas.lojas?.codigo ?? "").toLowerCase().includes(busca.toLowerCase()) ||
        (l.contas.fornecedor_nome ?? "").toLowerCase().includes(busca.toLowerCase());
      return m && t && s && q;
    });
  }, [itens, fMes, fTipo, fSituacao, busca]);

  const totalValor = filtrados.reduce((s, l) => s + (l.valor ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja ou fornecedor..."
          className="h-10 bg-[#f9f9f9] border border-linha rounded-md px-3 text-[13px] min-w-[200px] flex-1 focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10" />
        <select value={fMes} onChange={(e) => setFMes(e.target.value)} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todos os meses</option>
          {MES.map((m, i) => <option key={i} value={i + 1}>{m}/2026</option>)}
        </select>
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
        </select>
        <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todas as situações</option>
          {Object.entries(SITUACAO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="text-[12px] text-[#999] mb-3">{filtrados.length} lançamentos · total {money(totalValor)}</div>

      <div className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f5f5f5] h-12">
              {["Mês", "Loja", "Tipo", "Fornecedor", "Valor", "Situação"].map((h) => (
                <th key={h} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l) => {
              const T = TIPOS[l.contas.tipo];
              const s = SITUACAO[l.situacao] ?? { label: l.situacao, cls: "bg-[#f5f5f5] text-[#999]" };
              return (
                <tr key={l.id} className="h-12 border-b border-[#f0f0f0] last:border-0 hover:bg-[#f9f9f9]">
                  <td className="px-4 text-[13px] font-mono text-[#666]">{MES[l.mes - 1]}</td>
                  <td className="px-4 text-[13px] font-medium">{l.contas.lojas?.codigo}</td>
                  <td className="px-4 text-[13px]">
                    <span className="inline-flex items-center gap-1.5"><TipoIcon tipo={l.contas.tipo} size={14} color={T?.c} />{T?.n}</span>
                  </td>
                  <td className="px-4 text-[13px] text-[#666]">{l.contas.fornecedor_nome ?? "—"}</td>
                  <td className="px-4 text-[13px] font-mono font-semibold">{money(l.valor)}</td>
                  <td className="px-4"><span className={`badge ${s.cls}`}>{s.label}</span></td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-[#999]">Nenhum lançamento com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
