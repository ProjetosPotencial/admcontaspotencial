"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { money, formatarDataSemFuso } from "@/lib/format";
import { useDebounce } from "@/lib/hooks/useDebounce";
import StatusChip, { type Tom } from "@/components/status-chip";
import EmptyState from "@/components/empty-state";

type ContratoRow = {
  id: string; numero: string; loja_id: string | null; empresa_id: string | null;
  tipo: string | null; data_inicio: string | null; data_fim: string | null; valor: number | null;
  status: string; observacoes: string | null;
  lojas: { codigo: string } | null; empresas: { nome: string } | null;
};

const TIPOS_CONTRATO = ["aluguel", "prestacao_servico", "franquia", "outro"];
const TIPO_LABEL: Record<string, string> = { aluguel: "Aluguel", prestacao_servico: "Prestação de serviço", franquia: "Franquia", outro: "Outro" };
const STATUS_TOM: Record<string, Tom> = { ativo: "ok", encerrado: "alerta", suspenso: "aviso" };

export default function ContratosClient({ contratos: iniciais, lojas, empresas, buscaInicial }: {
  contratos: ContratoRow[]; lojas: { id: string; codigo: string }[]; empresas: { id: string; nome: string }[]; buscaInicial?: string;
}) {
  const [contratos, setContratos] = useState(iniciais);
  const [busca, setBusca] = useState(buscaInicial ?? "");
  const buscaDebounced = useDebounce(busca, 250);
  const [fStatus, setFStatus] = useState("todos");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<ContratoRow | null>(null);

  // quantos dias faltam para o contrato acabar (null = sem data de fim)
  const diasParaFim = (dataFim: string | null) => {
    if (!dataFim) return null;
    const [a, m, d] = dataFim.split("-").map(Number);
    const fim = new Date(a, m - 1, d).getTime();
    const hoje = new Date();
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
    return Math.round((fim - base) / 86400000);
  };

  const ativos = useMemo(() => contratos.filter((c) => c.status === "ativo"), [contratos]);
  const vencendo = useMemo(() => ativos
    .map((c) => ({ c, dias: diasParaFim(c.data_fim) }))
    .filter((x) => x.dias !== null && x.dias <= 90)
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0)), [ativos]);
  const vencidos = vencendo.filter((x) => (x.dias ?? 0) < 0);
  const em30 = vencendo.filter((x) => (x.dias ?? 0) >= 0 && (x.dias ?? 0) <= 30);
  const valorMensal = ativos.reduce((s2, c) => s2 + Number(c.valor ?? 0), 0);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { rot: "Contratos ativos", val: String(ativos.length), sub: `${contratos.length} no total`, cor: "#2A74C4" },
          { rot: "Vencem em 30 dias", val: String(em30.length), sub: em30.length ? "renovar ou encerrar" : "nada no radar", cor: "#E6A600" },
          { rot: "Já vencidos", val: String(vencidos.length), sub: vencidos.length ? "precisam de decisão" : "nenhum pendente", cor: "#D32F2F" },
          { rot: "Valor mensal", val: money(valorMensal), sub: "soma dos ativos", cor: "#2E7D32" },
        ].map((k) => (
          <div key={k.rot} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-semibold text-[#6c757d]">{k.rot}</span>
              <span className="w-2 h-2 rounded-full" style={{ background: k.cor }} />
            </div>
            <div className="font-disp font-bold text-[#1a1a1a] text-[22px] leading-none tracking-tight">{k.val}</div>
            <div className="text-[11px] text-[#adb5bd] mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {vencendo.length > 0 && (
        <div className="card p-4 mb-4" style={{ background: "#FFFBF0", borderColor: "#F0DFAE" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[14px]">⏳</span>
            <h3 className="font-disp text-[13.5px] font-semibold text-[#1a1a1a]">
              {vencendo.length === 1 ? "1 contrato precisa de atenção" : `${vencendo.length} contratos precisam de atenção`}
            </h3>
          </div>
          <div className="space-y-1.5">
            {vencendo.slice(0, 6).map(({ c, dias }) => {
              const d = dias ?? 0;
              const cor = d < 0 ? "#D32F2F" : d <= 30 ? "#E6A600" : "#6c757d";
              const texto = d < 0 ? `venceu há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`
                : d === 0 ? "vence hoje"
                : `vence em ${d} ${d === 1 ? "dia" : "dias"}`;
              return (
                <button key={c.id} onClick={() => setEditando(c)}
                  className="w-full flex items-center gap-2.5 text-[12.5px] text-left rounded px-1.5 py-1 hover:bg-white/60 transition">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cor }} />
                  <b className="font-mono text-[11.5px]">{c.numero}</b>
                  <span className="text-[#495057] truncate flex-1">{c.lojas?.codigo ?? "—"} · {c.tipo ?? "contrato"}</span>
                  {c.valor ? <span className="font-mono text-[11.5px] text-[#6c757d] shrink-0">{money(Number(c.valor))}</span> : null}
                  <span className="font-semibold shrink-0" style={{ color: cor }}>{texto}</span>
                </button>
              );
            })}
            {vencendo.length > 6 && (
              <div className="text-[11px] text-[#6c757d] pt-1">e mais {vencendo.length - 6}...</div>
            )}
          </div>
        </div>
      )}

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
                  {c.data_inicio ? formatarDataSemFuso(c.data_inicio) : "—"}
                  {c.data_fim ? ` – ${formatarDataSemFuso(c.data_fim)}` : ""}
                  {(() => {
                    if (c.status !== "ativo") return null;
                    const d = diasParaFim(c.data_fim);
                    if (d === null || d > 90) return null;
                    const cor = d < 0 ? "#D32F2F" : d <= 30 ? "#E6A600" : "#6c757d";
                    return (
                      <span className="ml-1.5 text-[10.5px] font-semibold" style={{ color: cor }}>
                        {d < 0 ? "vencido" : d === 0 ? "vence hoje" : `${d}d`}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 text-[13px] font-mono font-semibold">{money(c.valor)}</td>
                <td className="px-4"><StatusChip tom={STATUS_TOM[c.status] ?? "neutro"}>{c.status}</StatusChip></td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="py-4">
                <EmptyState titulo="Nenhum contrato encontrado" descricao="Contratos ativos, vencimentos e vigências aparecem aqui. Ajuste os filtros ou cadastre um novo contrato." />
              </td></tr>
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