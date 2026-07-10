"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import { useDebounce } from "@/lib/hooks/useDebounce";

type ContratoRow = {
  id: string; numero: string; loja_id: string | null; empresa_id: string | null;
  tipo: string | null; data_inicio: string | null; data_fim: string | null; valor: number | null;
  status: string; observacoes: string | null;
  lojas: { codigo: string } | null; empresas: { nome: string } | null;
};

const TIPOS_CONTRATO = ["aluguel", "prestacao_servico", "franquia", "outro"];
const TIPO_LABEL: Record<string, string> = { aluguel: "Aluguel", prestacao_servico: "Prestação de serviço", franquia: "Franquia", outro: "Outro" };
const STATUS_CLS: Record<string, string> = { ativo: "bg-ok-bg text-ok", encerrado: "bg-alerr-bg text-alerr", suspenso: "bg-amb-bg text-[#c9922a]" };

export default function ContratosClient({ contratos: iniciais, lojas, empresas, buscaInicial }: {
  contratos: ContratoRow[]; lojas: { id: string; codigo: string }[]; empresas: { id: string; nome: string }[]; buscaInicial?: string;
}) {
  const [contratos, setContratos] = useState(iniciais);
  const [busca, setBusca] = useState(buscaInicial ?? "");
  const buscaDebounced = useDebounce(busca, 250);
  const [fStatus, setFStatus] = useState("todos");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<ContratoRow | null>(null);

  const filtrados = useMemo(() => contratos.filter((c) => {
    const s = fStatus === "todos" || c.status === fStatus;
    const q = buscaDebounced === "" || c.numero.toLowerCase().includes(buscaDebounced.toLowerCase()) || (c.lojas?.codigo ?? "").toLowerCase().includes(buscaDebounced.toLowerCase());
    return s && q;
  }), [contratos, buscaDebounced, fStatus]);

  function upsertLocal(c: ContratoRow) {
    setContratos((lista) => (lista.some((x) => x.id === c.id) ? lista.map((x) => (x.id === c.id ? c : x)) : [c, ...lista]));
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número ou loja..."
          className="h-10 bg-[#f8f9fa] border border-linha rounded-md px-3 text-[13px] min-w-[200px] flex-1" />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option>
        </select>
        <button onClick={() => setCriando(true)}
          className="flex items-center gap-1.5 bg-amarelo hover:bg-amarelo-dark text-ebano font-semibold text-[13px] px-4 py-2.5 rounded-md transition-colors">
          <span className="text-base leading-none">+</span> Novo contrato
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              {["Número", "Loja", "Empresa", "Tipo", "Vigência", "Valor", "Status"].map((h) => (
                <th key={h} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} onClick={() => setEditando(c)} className="h-12 border-b border-linha2 last:border-0 hover:bg-[#f8f9fa] cursor-pointer">
                <td className="px-4 text-[13px] font-mono font-medium">{c.numero}</td>
                <td className="px-4 text-[13px]">{c.lojas?.codigo ?? "—"}</td>
                <td className="px-4 text-[13px]">{c.empresas?.nome ?? "—"}</td>
                <td className="px-4 text-[13px] text-[#6c757d]">{c.tipo ? TIPO_LABEL[c.tipo] ?? c.tipo : "—"}</td>
                <td className="px-4 text-[12px] text-[#6c757d] font-mono">
                  {c.data_inicio ? new Date(c.data_inicio).toLocaleDateString("pt-br") : "—"}
                  {c.data_fim ? ` – ${new Date(c.data_fim).toLocaleDateString("pt-br")}` : ""}
                </td>
                <td className="px-4 text-[13px] font-mono font-semibold">{money(c.valor)}</td>
                <td className="px-4"><span className={`badge ${STATUS_CLS[c.status] ?? ""}`}>{c.status}</span></td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-[#adb5bd]">Nenhum contrato encontrado.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>

      {criando && <ContratoDrawer lojas={lojas} empresas={empresas} onClose={() => setCriando(false)} onSalvar={(c) => { upsertLocal(c); setCriando(false); }} />}
      {editando && <ContratoDrawer contrato={editando} lojas={lojas} empresas={empresas} onClose={() => setEditando(null)} onSalvar={(c) => { upsertLocal(c); setEditando(null); }} />}
    </>
  );
}

function ContratoDrawer({ contrato, lojas, empresas, onClose, onSalvar }: {
  contrato?: ContratoRow; lojas: { id: string; codigo: string }[]; empresas: { id: string; nome: string }[];
  onClose: () => void; onSalvar: (c: ContratoRow) => void;
}) {
  const supabase = createClient();
  const [numero, setNumero] = useState(contrato?.numero ?? "");
  const [lojaId, setLojaId] = useState(contrato?.loja_id ?? "");
  const [empresaId, setEmpresaId] = useState(contrato?.empresa_id ?? "");
  const [tipo, setTipo] = useState(contrato?.tipo ?? "aluguel");
  const [dataInicio, setDataInicio] = useState(contrato?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(contrato?.data_fim ?? "");
  const [valor, setValor] = useState(contrato?.valor?.toString() ?? "");
  const [status, setStatus] = useState(contrato?.status ?? "ativo");
  const [observacoes, setObservacoes] = useState(contrato?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!numero.trim()) { setErro("Informe o número do contrato."); return; }
    setSalvando(true);
    setErro(null);
    const payload = {
      numero: numero.trim(), loja_id: lojaId || null, empresa_id: empresaId || null,
      tipo: tipo || null, data_inicio: dataInicio || null, data_fim: dataFim || null,
      valor: valor ? Number(valor.replace(",", ".")) : null, status, observacoes: observacoes.trim() || null,
    };
    const query = contrato
      ? supabase.from("contratos").update(payload).eq("id", contrato.id).select("*, lojas ( codigo ), empresas ( nome )").single()
      : supabase.from("contratos").insert(payload).select("*, lojas ( codigo ), empresas ( nome )").single();
    const { data, error } = await query;
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar o contrato."); return; }
    onSalvar(data as ContratoRow);
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[420px] max-w-[94vw] bg-white border-l border-linha z-50 overflow-y-auto">
        <div className="relative px-5 py-5 border-b border-linha">
          <span className="absolute left-0 right-0 top-0 h-1 bg-amarelo" />
          <button onClick={onClose} className="absolute right-5 top-5 text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <h3 className="text-[20px] font-bold text-[#1a1a1a]">{contrato ? "Editar contrato" : "Novo contrato"}</h3>
        </div>
        <div className="p-5 space-y-3.5">
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Número do contrato</div>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="CT-2026-045" className="input-padrao w-full font-mono" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Loja</div>
              <select value={lojaId} onChange={(e) => setLojaId(e.target.value)} className="input-padrao w-full">
                <option value="">— nenhuma —</option>
                {lojas.map((l) => <option key={l.id} value={l.id}>{l.codigo}</option>)}
              </select>
            </label>
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Empresa</div>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="input-padrao w-full">
                <option value="">— nenhuma —</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Tipo</div>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-padrao w-full">
                {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </label>
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-padrao w-full">
                <option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Início</div>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="input-padrao w-full" />
            </label>
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Fim</div>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="input-padrao w-full" />
            </label>
          </div>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Valor mensal</div>
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="input-padrao w-full font-mono" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Observações</div>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className="w-full border border-linha rounded-md px-3 py-2 text-[13px]" />
          </label>
          {erro && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{erro}</div>}
          <button onClick={salvar} disabled={salvando} className="btn-primario w-full">
            {salvando ? "Salvando..." : contrato ? "Salvar alterações" : "Criar contrato"}
          </button>
        </div>
      </aside>
    </>
  );
}
