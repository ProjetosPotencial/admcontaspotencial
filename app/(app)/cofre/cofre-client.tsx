"use client";

import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";

type Credencial = {
  conta_id: string; login: string | null; senha_secret: string | null;
  contas: { fornecedor_nome: string | null; status: string; lojas: { codigo: string; coban: string } | null } | null;
};

export default function CofreClient({ credenciais }: { credenciais: Credencial[] }) {
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 250);
  const [fSenha, setFSenha] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 25;

  const filtradas = useMemo(() => {
    return credenciais.filter((c) => {
      const termo = buscaDebounced.toLowerCase();
      const q = termo === "" ||
        (c.contas?.lojas?.codigo ?? "").toLowerCase().includes(termo) ||
        (c.contas?.fornecedor_nome ?? "").toLowerCase().includes(termo) ||
        (c.login ?? "").toLowerCase().includes(termo);
      const s = fSenha === "todos" || (fSenha === "com" ? !!c.senha_secret : !c.senha_secret);
      return q && s;
    });
  }, [credenciais, buscaDebounced, fSenha]);

  useEffect(() => { setPagina(1); }, [buscaDebounced, fSenha]);
  const totalPaginas = Math.max(Math.ceil(filtradas.length / itensPorPagina), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const visiveis = filtradas.slice(inicio, inicio + itensPorPagina);

  return (
    <>
      <div className="flex flex-wrap gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja, fornecedor ou login..."
            className="w-full h-10 bg-[#f8f9fa] border border-linha rounded-md pl-10 pr-3 text-[13px] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10" />
        </div>
        <select value={fSenha} onChange={(e) => setFSenha(e.target.value)} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todas</option>
          <option value="com">Com senha</option>
          <option value="sem">Sem senha</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              {["Loja", "Fornecedor", "Login", "Senha"].map((h) => (
                <th key={h} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr key={c.conta_id} className="h-14 border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa] transition">
                <td className="px-4 text-[13px] font-medium">
                  {c.contas?.lojas?.codigo}
                  <small className="block text-[#adb5bd] text-[11px] font-mono">{c.contas?.lojas?.coban}</small>
                </td>
                <td className="px-4 text-[13px] font-medium">{c.contas?.fornecedor_nome ?? "—"}</td>
                <td className="px-4 text-[13px] font-mono">{c.login ?? "—"}</td>
                <td className="px-4 text-[13px] font-mono text-[#adb5bd]">
                  {c.senha_secret ? "•••••••••" : <span className="badge bg-[#f1f3f5] text-[#adb5bd] font-mono">sem senha</span>}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-[#adb5bd]">Nenhuma credencial encontrada.</td></tr>
            )}
          </tbody>
        </table></div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-linha2 flex-wrap gap-3">
          <span className="text-[12px] text-[#6c757d]">Mostrando {filtradas.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + itensPorPagina, filtradas.length)} de {filtradas.length}</span>
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
