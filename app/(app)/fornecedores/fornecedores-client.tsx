"use client";

import { useState, useMemo } from "react";
import { TIPOS } from "@/lib/types";

type Fornecedor = { id: string; nome: string; tipo_padrao: string | null; portal_padrao: string | null };

export default function FornecedoresClient({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(
    () => fornecedores.filter((f) => f.nome.toLowerCase().includes(busca.toLowerCase())),
    [fornecedores, busca]
  );

  return (
    <>
      <div className="relative mb-4 max-w-sm">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor..."
          className="w-full h-10 bg-[#f8f9fa] border border-linha rounded-md pl-10 pr-3 text-[13px] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10" />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Fornecedor</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Tipo de conta</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Portal</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((f) => {
              const T = f.tipo_padrao ? TIPOS[f.tipo_padrao] : null;
              return (
                <tr key={f.id} className="h-12 border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa]">
                  <td className="px-4 text-[13px] font-medium">{f.nome}</td>
                  <td className="px-4 text-[13px]">
                    {T ? <span className="badge" style={{ background: T.bg, color: T.c }}>{T.n}</span> : "—"}
                  </td>
                  <td className="px-4 text-[12px] text-[#adb5bd] font-mono truncate max-w-[220px]">{f.portal_padrao ?? "—"}</td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={3} className="text-center py-12 text-[#adb5bd]">Nenhum fornecedor encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
