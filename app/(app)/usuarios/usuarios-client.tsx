"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PAPEL_LABEL: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-alerr-bg text-alerr" },
  gestor: { label: "Gestor", cls: "bg-info-bg text-info" },
  operador: { label: "Operador", cls: "bg-ok-bg text-ok" },
  leitura: { label: "Leitura", cls: "bg-[#f1f3f5] text-[#adb5bd]" },
};
const PAPEIS = ["leitura", "operador", "gestor", "admin"];

type Usuario = { id: string; nome: string; email: string; papel: string; ativo: boolean };

export default function UsuariosClient({ usuarios: iniciais, ehAdmin, meuId }: { usuarios: Usuario[]; ehAdmin: boolean; meuId: string }) {
  const supabase = createClient();
  const [usuarios, setUsuarios] = useState(iniciais);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function mudarPapel(id: string, novoPapel: string) {
    if (id === meuId && novoPapel !== "admin") {
      setAviso("Você não pode rebaixar o próprio papel por aqui — peça pra outro admin fazer isso.");
      return;
    }
    setSalvandoId(id);
    setAviso(null);
    const { error } = await supabase.from("perfis").update({ papel: novoPapel }).eq("id", id);
    setSalvandoId(null);
    if (error) { setAviso("Sem permissão para alterar este usuário."); return; }
    setUsuarios((lista) => lista.map((u) => (u.id === id ? { ...u, papel: novoPapel } : u)));
  }

  async function mudarAtivo(id: string, ativo: boolean) {
    setSalvandoId(id);
    const { error } = await supabase.from("perfis").update({ ativo }).eq("id", id);
    setSalvandoId(null);
    if (error) { setAviso("Sem permissão para alterar este usuário."); return; }
    setUsuarios((lista) => lista.map((u) => (u.id === id ? { ...u, ativo } : u)));
  }

  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Nome</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">E-mail</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Papel</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const iniciais = (u.nome ?? "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
              const p = PAPEL_LABEL[u.papel] ?? PAPEL_LABEL.leitura;
              return (
                <tr key={u.id} className="h-14 border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa]">
                  <td className="px-4 text-[13px] font-medium">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[#e9ecef] text-[#1a1a1a] grid place-items-center text-[10px] font-semibold shrink-0">{iniciais}</span>
                      {u.nome}
                      {u.id === meuId && <span className="text-[10px] text-[#adb5bd] font-normal">(você)</span>}
                    </div>
                  </td>
                  <td className="px-4 text-[13px] text-[#6c757d]">{u.email}</td>
                  <td className="px-4">
                    {ehAdmin ? (
                      <select value={u.papel} disabled={salvandoId === u.id}
                        onChange={(e) => mudarPapel(u.id, e.target.value)}
                        className="border border-linha rounded-md px-2.5 py-1.5 text-[12.5px] capitalize disabled:opacity-50">
                        {PAPEIS.map((papel) => <option key={papel} value={papel}>{papel}</option>)}
                      </select>
                    ) : (
                      <span className={`badge ${p.cls}`}>{p.label}</span>
                    )}
                  </td>
                  <td className="px-4">
                    {ehAdmin ? (
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={u.ativo} disabled={salvandoId === u.id}
                          onChange={(e) => mudarAtivo(u.id, e.target.checked)} className="w-4 h-4" />
                        <span className="text-[12.5px] text-[#6c757d]">{u.ativo ? "Ativo" : "Inativo"}</span>
                      </label>
                    ) : (
                      <span className={`badge ${u.ativo ? "bg-ok-bg text-ok" : "bg-[#f1f3f5] text-[#adb5bd]"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {usuarios.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-[#adb5bd]">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
        {aviso && <div className="px-4 py-2.5 text-[12px] text-alerr bg-alerr-bg border-t border-linha2">{aviso}</div>}
      </div>
      {ehAdmin && (
        <div className="text-[11px] text-[#adb5bd] mt-3 leading-relaxed">
          admin vê e muda tudo · gestor aprova pagamentos e vê Cofre/Relatórios · operador lança contas · leitura só consulta.
          Uma pessoa só aparece aqui depois do primeiro login dela no sistema.
        </div>
      )}
    </>
  );
}
