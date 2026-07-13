"use client";

import { useState, useMemo, useEffect } from "react";
import { TIPOS } from "@/lib/types";
import { useDebounce } from "@/lib/hooks/useDebounce";

type Fornecedor = { id: string; nome: string; tipo_padrao: string | null; portal_padrao: string | null };

export default function FornecedoresClient({ fornecedores, nomesAtivos }: { fornecedores: Fornecedor[]; nomesAtivos: string[] }) {
  const ativosSet = useMemo(() => new Set(nomesAtivos), [nomesAtivos]);
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 250);
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 25;

  const filtrados = useMemo(() => {
    return fornecedores.filter((f) => {
      const q = f.nome.toLowerCase().includes(buscaDebounced.toLowerCase());
      const t = fTipo === "todos" || f.tipo_padrao === fTipo;
      const ativo = ativosSet.has(f.nome);
      const s = fStatus === "todos" || (fStatus === "ativo" ? ativo : !ativo);
      return q && t && s;
    });
  }, [fornecedores, buscaDebounced, fTipo, fStatus, ativosSet]);

  useEffect(() => { setPagina(1); }, [buscaDebounced, fTipo, fStatus]);
  const totalPaginas = Math.max(Math.ceil(filtrados.length / itensPorPagina), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const visiveis = filtrados.slice(inicio, inicio + itensPorPagina);

  return (
    <>
      <div className="flex flex-wrap gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor..."
            className="w-full h-10 bg-[#f8f9fa] border border-linha rounded-md pl-10 pr-3 text-[13px] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10" />
        </div>
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Fornecedor</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Tipo de conta</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Portal</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((f) => {
              const T = f.tipo_padrao ? TIPOS[f.tipo_padrao] : null;
              const ativo = ativosSet.has(f.nome);
              return (
                <tr key={f.id} className="h-12 border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa]">
                  <td className="px-4 text-[13px] font-medium">{f.nome}</td>
                  <td className="px-4 text-[13px]">
                    {T ? <span className="badge" style={{ background: T.bg, color: T.c }}>{T.n}</span> : "—"}
                  </td>
                  <td className="px-4 text-[12px] text-[#adb5bd] font-mono truncate max-w-[220px]">{f.portal_padrao ?? "—"}</td>
                  <td className="px-4"><span className={`badge ${ativo ? "bg-ok-bg text-ok" : "bg-[#f1f3f5] text-[#adb5bd]"}`}>{ativo ? "Ativo" : "Inativo"}</span></td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-[#adb5bd]">Nenhum fornecedor encontrado.</td></tr>
            )}
          </tbody>
        </table></div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-linha2 flex-wrap gap-3">
          <span className="text-[12px] text-[#6c757d]">Mostrando {filtrados.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + itensPorPagina, filtrados.length)} de {filtrados.length}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPagina((p) => Math.max(p - 1, 1))} disabled={paginaSegura === 1} className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">‹</button>
            <span className="text-[12.5px] text-[#1a1a1a] font-semibold px-2">{paginaSegura} / {totalPaginas}</span>
            <button onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))} disabled={paginaSegura === totalPaginas} className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">›</button>
          </div>
        </div>
      </div>
    </>
  );
}
