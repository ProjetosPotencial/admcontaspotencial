"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Empresa } from "@/lib/empresa-types";

export default function EmpresasClient({ empresas: iniciais, contagemLojas }: { empresas: Empresa[]; contagemLojas: Record<string, number> }) {
  const [empresas, setEmpresas] = useState(iniciais);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);

  function upsertLocal(emp: Empresa) {
    setEmpresas((lista) => (lista.some((e) => e.id === emp.id) ? lista.map((e) => (e.id === emp.id ? emp : e)) : [...lista, emp].sort((a, b) => a.nome.localeCompare(b.nome))));
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setCriando(true)}
          className="flex items-center gap-1.5 bg-amarelo hover:bg-amarelo-dark text-ebano font-semibold text-[13px] px-4 py-2.5 rounded-md transition-colors">
          <span className="text-base leading-none">+</span> Nova empresa
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              {["Empresa", "CNPJ", "Lojas vinculadas", "Status", ""].map((h) => (
                <th key={h} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} onClick={() => setEditando(e)} className="h-12 border-b border-linha2 last:border-0 hover:bg-[#f8f9fa] cursor-pointer">
                <td className="px-4 text-[13px] font-medium">
                  {e.nome}
                  {e.razao_social && <small className="block text-[#adb5bd] text-[11px]">{e.razao_social}</small>}
                </td>
                <td className="px-4 text-[13px] font-mono text-[#6c757d]">{e.cnpj ?? "—"}</td>
                <td className="px-4 text-[13px] font-mono">{contagemLojas[e.id] ?? 0}</td>
                <td className="px-4"><span className={`badge ${e.ativa ? "bg-ok-bg text-ok" : "bg-[#f1f3f5] text-[#adb5bd]"}`}>{e.ativa ? "Ativa" : "Inativa"}</span></td>
                <td className="px-4 text-right text-[#adb5bd]">
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="inline"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
                </td>
              </tr>
            ))}
            {empresas.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-[#adb5bd]">Nenhuma empresa cadastrada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {criando && <EmpresaDrawer onClose={() => setCriando(false)} onSalvar={(e) => { upsertLocal(e); setCriando(false); }} />}
      {editando && <EmpresaDrawer empresa={editando} onClose={() => setEditando(null)} onSalvar={(e) => { upsertLocal(e); setEditando(null); }} />}
    </>
  );
}

function EmpresaDrawer({ empresa, onClose, onSalvar }: { empresa?: Empresa; onClose: () => void; onSalvar: (e: Empresa) => void }) {
  const supabase = createClient();
  const [nome, setNome] = useState(empresa?.nome ?? "");
  const [razaoSocial, setRazaoSocial] = useState(empresa?.razao_social ?? "");
  const [cnpj, setCnpj] = useState(empresa?.cnpj ?? "");
  const [observacoes, setObservacoes] = useState(empresa?.observacoes ?? "");
  const [ativa, setAtiva] = useState(empresa?.ativa ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) { setErro("Informe o nome da empresa."); return; }
    setSalvando(true);
    setErro(null);
    const payload = {
      nome: nome.trim(), razao_social: razaoSocial.trim() || null, cnpj: cnpj.trim() || null,
      observacoes: observacoes.trim() || null, ativa,
    };
    const query = empresa
      ? supabase.from("empresas").update(payload).eq("id", empresa.id).select().single()
      : supabase.from("empresas").insert(payload).select().single();
    const { data, error } = await query;
    setSalvando(false);
    if (error) { setErro(error.message.includes("duplicate") ? "Já existe uma empresa com esse nome." : "Não foi possível salvar."); return; }
    onSalvar(data as Empresa);
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[400px] max-w-[94vw] bg-white border-l border-linha z-50 overflow-y-auto">
        <div className="relative px-5 py-5 border-b border-linha">
          <span className="absolute left-0 right-0 top-0 h-1 bg-amarelo" />
          <button onClick={onClose} className="absolute right-5 top-5 text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <h3 className="text-[20px] font-bold text-[#1a1a1a]">{empresa ? "Editar empresa" : "Nova empresa"}</h3>
        </div>
        <div className="p-5 space-y-3.5">
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Nome</div>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Grupo Potencial, Parcele Aqui..." className="input-padrao w-full" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Razão social</div>
            <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="input-padrao w-full" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">CNPJ</div>
            <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="input-padrao w-full font-mono" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Observações</div>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3}
              className="w-full border border-linha rounded-md px-3 py-2 text-[13px]" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="w-4 h-4" />
            <span className="text-[12.5px] text-[#6c757d]">Empresa ativa</span>
          </label>
          {erro && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{erro}</div>}
          <button onClick={salvar} disabled={salvando} className="btn-primario w-full">
            {salvando ? "Salvando..." : empresa ? "Salvar alterações" : "Criar empresa"}
          </button>
        </div>
      </aside>
    </>
  );
}
