"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { agente } from "@/lib/agente-proativo";
import { TIPOS, ORIGENS, SITUACAO, type Conta, type Lancamento } from "@/lib/types";
import { CAMPOS_TIPO } from "@/lib/campos-tipo";
import { useContaForm } from "@/lib/hooks/useContaForm";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { formatarPeriodo, contaValidaNoPeriodo, estaAtrasada } from "@/lib/date-utils";
import { Calendario, type Feriado, type RegraVencimento } from "@/lib/calendario";
import TipoIcon from "@/components/tipo-icon";
import LogoFornecedor from "@/components/logo-fornecedor";
import { money, MES, nomeArquivoSeguro, formatarDataSemFuso } from "@/lib/format";
import { MOTIVOS_SEM_DOCUMENTO, motivoValido, textoDoMotivo, mensagemSemDocumento, agoraBrasil } from "@/lib/sem-documento";
import { MOTIVOS_ZERADO, motivoZeradoValido, textoMotivoZerado, lerValorDigitado, ehZerada } from "@/lib/conta-zerada";

function StatusBadge({ status }: { status: string }) {
  if (status === "encerrado") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  if (status === "inativo") return <span className="badge bg-[#f1f3f5] text-[#adb5bd]">Inativa</span>;
  return <span className="badge bg-ok-bg text-ok">Ativa</span>;
}

function VencimentoCell({ contaId, dia, ano, mes, situacao }: { contaId: string; dia: number | null; ano: number; mes: number; situacao?: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(dia ?? ""));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const novoDia = Number(valor);
    if (!Number.isInteger(novoDia) || novoDia < 1 || novoDia > 31) return;
    setSalvando(true);
    const { error } = await supabase.from("contas").update({ dia_vencimento: novoDia }).eq("id", contaId);
    setSalvando(false);
    if (!error) { setEditando(false); router.refresh(); }
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="number" min={1} max={31} autoFocus value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(false); }}
          className="w-14 border border-amarelo rounded-md px-1.5 py-1 text-[12.5px] font-mono focus:outline-none"
        />
        <button onClick={salvar} disabled={salvando} className="text-ok hover:text-ok-dark disabled:opacity-40" title="Salvar">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
        </button>
        <button onClick={() => setEditando(false)} className="text-[#adb5bd] hover:text-[#1a1a1a]" title="Cancelar">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
    );
  }

  if (!dia) {
    return (
      <button onClick={(e) => { e.stopPropagation(); setEditando(true); }} className="text-[12.5px] text-info font-semibold hover:underline">
        + definir vencimento
      </button>
    );
  }

  const diaAtual = new Date().getDate();
  const diff = dia - diaAtual;
  const dataFormatada = new Date(ano, mes - 1, dia).toLocaleDateString("pt-br");

  let label: string; let cor: string;
  // conta que já teve boleto lançado não é mais "atrasada" - ela já foi processada
  const jaLancada = situacao != null && situacao !== "pendente";
  if (jaLancada) { label = "Lançada"; cor = "text-ok"; }
  else if (diff < 0) { label = "Atrasada"; cor = "text-alerr"; }
  else if (diff === 0) { label = "Hoje"; cor = "text-alerr"; }
  else if (diff === 1) { label = "Amanhã"; cor = "text-amb"; }
  else if (diff <= 7) { label = `${diff} dias`; cor = "text-amb"; }
  else { label = `${diff} dias`; cor = "text-ok"; }

  return (
    <button onClick={(e) => { e.stopPropagation(); setEditando(true); }} className="flex items-center gap-2 group/venc text-left">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${jaLancada ? "bg-ok" : diff < 0 || diff === 0 ? "bg-alerr" : diff <= 7 ? "bg-amb" : "bg-ok"}`} />
      <div>
        <div className={`text-[12.5px] font-semibold ${cor} flex items-center gap-1`}>
          {label}
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="opacity-0 group-hover/venc:opacity-50 transition"><path d="M13.5 3.5l3 3-10 10H3.5v-3l10-10z" /></svg>
        </div>
        <div className="text-[11px] text-[#adb5bd] font-mono">{dataFormatada}</div>
      </div>
    </button>
  );
}

function OrigemCell({ contaId, origem }: { contaId: string; origem: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(novaOrigem: string) {
    setSalvando(true);
    const { error } = await supabase.from("contas").update({ origem: novaOrigem }).eq("id", contaId);
    setSalvando(false);
    if (!error) { setEditando(false); router.refresh(); }
  }

  if (editando) {
    return (
      <select autoFocus disabled={salvando} defaultValue={origem} onClick={(e) => e.stopPropagation()}
        onChange={(e) => salvar(e.target.value)} onBlur={() => setEditando(false)}
        className="border border-amarelo rounded-md px-1.5 py-1 text-[12px]">
        {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    );
  }
  return (
    <button onClick={(e) => { e.stopPropagation(); setEditando(true); }} className="hover:opacity-70 transition">
      <span className="badge bg-info-bg text-info">{ORIGENS[origem] ?? origem}</span>
    </button>
  );
}

function LojaCell({ contaId, lojaAtual, lojas }: { contaId: string; lojaAtual: { codigo: string; coban: string } | null; lojas: { id: string; codigo: string }[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const filtradas = busca.trim() ? lojas.filter((l) => l.codigo.toLowerCase().includes(busca.toLowerCase())).slice(0, 30) : lojas.slice(0, 30);

  async function salvar(lojaId: string) {
    setSalvando(true);
    const { error } = await supabase.from("contas").update({ loja_id: lojaId }).eq("id", contaId);
    setSalvando(false);
    if (!error) { setEditando(false); router.refresh(); }
  }

  if (editando) {
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja..."
          onKeyDown={(e) => e.key === "Escape" && setEditando(false)}
          className="w-40 border border-amarelo rounded-md px-1.5 py-1 text-[12px]" />
        <div className="absolute z-30 top-full left-0 mt-1 w-56 max-h-48 overflow-y-auto bg-white border border-linha rounded-md shadow-media">
          {filtradas.map((l) => (
            <button key={l.id} disabled={salvando} onClick={() => salvar(l.id)}
              className="block w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-off disabled:opacity-40">
              {l.codigo}
            </button>
          ))}
          {filtradas.length === 0 && <div className="px-2.5 py-1.5 text-[12px] text-[#adb5bd]">Nenhuma loja encontrada.</div>}
          <button onClick={() => setEditando(false)} className="block w-full text-left px-2.5 py-1.5 text-[11.5px] text-[#adb5bd] border-t border-linha2 hover:bg-off">Cancelar</button>
        </div>
      </div>
    );
  }
  return (
    <button onClick={(e) => { e.stopPropagation(); setEditando(true); setBusca(""); }} className="text-left hover:opacity-70 transition">
      {lojaAtual?.codigo ?? "—"}
      <small className="block text-[#adb5bd] text-[11px] font-mono">{lojaAtual?.coban}</small>
    </button>
  );
}

function FornecedorCell({ contaId, nome, logo }: { contaId: string; nome: string | null; logo?: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase.from("contas").update({ fornecedor_nome: valor.trim() || null }).eq("id", contaId);
    setSalvando(false);
    if (!error) { setEditando(false); router.refresh(); }
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(false); }}
          className="w-32 border border-amarelo rounded-md px-1.5 py-1 text-[12px]" />
        <button onClick={salvar} disabled={salvando} className="text-ok hover:text-ok-dark disabled:opacity-40">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
        </button>
      </div>
    );
  }
  return (
    <button onClick={(e) => { e.stopPropagation(); setEditando(true); }} className="text-left hover:opacity-70 transition flex items-center gap-2">
      <LogoFornecedor nome={nome ?? "?"} url={logo} size={26} />
      <span>{nome ?? "—"}</span>
    </button>
  );
}

export default function ContasClient({ contas, situacaoPorConta, lojas, ano, mes, feriados = [], regraVencimento = "adiar", logos = {}, usuarioId = null, usuarioEmail = null, usuarioNome = null }: {
  contas: Conta[]; situacaoPorConta: Record<string, string>; lojas: { id: string; codigo: string }[]; ano: number; mes: number;
  feriados?: Feriado[]; regraVencimento?: RegraVencimento; logos?: Record<string, string>;
  usuarioId?: string | null; usuarioEmail?: string | null; usuarioNome?: string | null;
}) {
  // calendário da empresa: vencimento em fim de semana ou feriado é ajustado
  // pela regra, e o que foi ajustado não conta como atraso.
  const cal = useMemo(() => ({
    calendario: new Calendario([ano - 1, ano, ano + 1], feriados),
    regra: regraVencimento,
  }), [ano, feriados, regraVencimento]);
  const params = useSearchParams();
  const [fTipo, setFTipo] = useState<string>(params.get("tipo") ?? "todos");
  const [fCoban, setFCoban] = useState("todos");
  const [fStatus, setFStatus] = useState(params.get("status") ?? "todos");
  const [fSituacao, setFSituacao] = useState(params.get("situacao") ?? "todos");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const buscaDebounced = useDebounce(busca, 250);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);
  const [aberta, setAberta] = useState<Conta | null>(null);
  const [criando, setCriando] = useState(false);
  // Ordenação da tabela. Padrão: vencimento crescente (vencidas mais
  // antigas -> vence hoje -> a vencer), independente do filtro aplicado.
  const [ordem, setOrdem] = useState<{ campo: "venc" | "loja" | "fornecedor" | "status"; dir: "asc" | "desc" }>({ campo: "venc", dir: "asc" });

  // abre direto a conta específica quando a URL vem com ?conta=id (ex.: um
  // clique em "atrasada" no Painel ou em Alertas) - sem isso, a pessoa cai
  // numa lista de centenas de contas e precisa procurar a certa na mão.
  useEffect(() => {
    const contaId = params.get("conta");
    if (contaId) {
      const encontrada = contas.find((c) => c.id === contaId);
      if (encontrada) setAberta(encontrada);
    }
  }, [params, contas]);

  const filtradas = useMemo(() => {
    return contas.filter((c) => {
      const t = fTipo === "todos" || c.tipo === fTipo;
      const cb = fCoban === "todos" || c.lojas?.coban === fCoban;
      // conta encerrada some da lista assim que é encerrada (o cadastro fica
      // salvo, e ela continua acessível pelo filtro de status "Encerrada")
      const st = fStatus === "todos" ? c.status !== "encerrado" : c.status === fStatus;
      const sit = situacaoPorConta[c.id] ?? "pendente";
      const diaHoje = new Date().getDate();
      const si =
        fSituacao === "todos" ? true
        : fSituacao === "atrasada" ? estaAtrasada(sit, c.dia_vencimento, mes, ano, undefined, cal)
        : fSituacao === "a_vencer" ? (
            sit === "pendente" && c.dia_vencimento != null &&
            c.dia_vencimento >= diaHoje && c.dia_vencimento <= diaHoje + 7 &&
            !estaAtrasada(sit, c.dia_vencimento, mes, ano, undefined, cal)
          )
        : sit === fSituacao;
      const q =
        buscaDebounced === "" ||
        (c.lojas?.codigo ?? "").toLowerCase().includes(buscaDebounced.toLowerCase()) ||
        (c.fornecedor_nome ?? "").toLowerCase().includes(buscaDebounced.toLowerCase());
      return t && cb && st && si && q;
    });
  }, [contas, fTipo, fCoban, fStatus, fSituacao, buscaDebounced, situacaoPorConta, cal]);

  // Ordena o resultado JÁ filtrado. Vencimento é o critério padrão: como
  // todas as contas estão no mesmo mês/ano, ordenar pelo dia_vencimento
  // crescente produz exatamente vencidas (mais antigas) -> vence hoje ->
  // a vencer crescente. Contas sem vencimento definido ficam sempre no fim.
  const ordenadas = useMemo(() => {
    const dir = ordem.dir === "asc" ? 1 : -1;
    const rankStatus = (s?: string) => (s === "ativo" ? 0 : s === "inativo" ? 1 : s === "encerrado" ? 2 : 3);
    const dvKey = (c: Conta) => (c.dia_vencimento == null ? Number.POSITIVE_INFINITY : c.dia_vencimento);
    const base = (a: Conta, b: Conta) => {
      switch (ordem.campo) {
        case "loja": return (a.lojas?.codigo ?? "").localeCompare(b.lojas?.codigo ?? "", "pt-BR");
        case "fornecedor": return (a.fornecedor_nome ?? "").localeCompare(b.fornecedor_nome ?? "", "pt-BR");
        case "status": return rankStatus(a.status) - rankStatus(b.status);
        default: return 0;
      }
    };
    return [...filtradas].sort((a, b) => {
      if (ordem.campo === "venc") {
        const an = a.dia_vencimento == null, bn = b.dia_vencimento == null;
        if (an || bn) return an === bn ? 0 : an ? 1 : -1; // sem venc -> fim, sempre
        const r = (a.dia_vencimento! - b.dia_vencimento!) * dir;
        return r !== 0 ? r : (a.fornecedor_nome ?? "").localeCompare(b.fornecedor_nome ?? "", "pt-BR");
      }
      const r = base(a, b) * dir;
      return r !== 0 ? r : dvKey(a) - dvKey(b); // desempate sempre por vencimento
    });
  }, [filtradas, ordem]);

  useEffect(() => { setPagina(1); }, [fTipo, fCoban, fStatus, fSituacao, buscaDebounced, ordem]);

  const totalPaginas = Math.max(Math.ceil(ordenadas.length / itensPorPagina), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const visiveis = ordenadas.slice(inicio, inicio + itensPorPagina);

  const limparFiltros = () => { setFTipo("todos"); setFCoban("todos"); setFStatus("todos"); setFSituacao("todos"); setBusca(""); };

  const alternarSel = (id: string) => setSelecionados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const limparSel = () => setSelecionados(new Set());
  const temFiltro = fTipo !== "todos" || fCoban !== "todos" || fStatus !== "todos" || fSituacao !== "todos" || busca !== "";
  const chips = ["todos", ...Object.keys(TIPOS)];

  const COLUNAS: { label: string; campo?: "venc" | "loja" | "fornecedor" | "status"; sortable: boolean }[] = [
    { label: "Loja", campo: "loja", sortable: true },
    { label: "Tipo", sortable: false },
    { label: "Fornecedor", campo: "fornecedor", sortable: true },
    { label: "Venc.", campo: "venc", sortable: true },
    { label: "Origem", sortable: false },
    { label: "Status", campo: "status", sortable: true },
    { label: "", sortable: false },
  ];
  function alternarOrdem(campo: "venc" | "loja" | "fornecedor" | "status") {
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }));
  }

  return (
    <>
      {/* Seção de filtros */}
      <div className="bg-white border border-linha rounded-xl p-6 mb-6 shadow-leve">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[20px] font-semibold text-[#1a1a1a]">Filtrar contas</h2>
          <button onClick={() => setCriando(true)}
            className="flex items-center gap-1.5 bg-amarelo hover:bg-amarelo-dark text-[#1a1a1a] font-semibold text-[13px] px-4 py-2.5 rounded-md transition-colors">
            <span className="text-base leading-none">+</span> Nova conta
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 mb-4">
          {chips.map((t) => (
            <button key={t} onClick={() => setFTipo(t)}
              className={`px-4 py-2 rounded-full text-[13px] border transition ${
                fTipo === t ? "bg-amarelo text-[#1a1a1a] border-amarelo font-semibold" : "bg-[#f1f3f5] text-[#1a1a1a] border-linha font-medium hover:bg-white"
              }`}>
              {t === "todos" ? "Todos os tipos" : TIPOS[t].n}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por fornecedor, loja ou código..."
              className="w-full h-10 bg-[#f8f9fa] border border-linha rounded-md pl-10 pr-3 text-[13px] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10" />
          </div>
          <select value={fCoban} onChange={(e) => setFCoban(e.target.value)}
            className="h-10 bg-white border border-linha rounded-md px-3 text-[13px] text-[#1a1a1a] min-w-[150px]">
            <option value="todos">Todas as lojas</option>
            <option>MG</option><option>MS</option><option>SP</option>
            <option value="QUIOSQUE">Quiosque</option><option value="CORP">Corporativo</option>
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
            className="h-10 bg-white border border-linha rounded-md px-3 text-[13px] text-[#1a1a1a] min-w-[150px]">
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativa</option><option value="inativo">Inativa</option><option value="encerrado">Encerrada</option>
          </select>
          <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)}
            className="h-10 bg-white border border-linha rounded-md px-3 text-[13px] text-[#1a1a1a] min-w-[170px]">
            <option value="todos">Qualquer situação</option>
            <option value="pendente">Em aberto</option><option value="a_vencer">A vencer (7 dias)</option><option value="atrasada">Atrasadas</option><option value="lancado">Aguardando pagamento</option><option value="pago">Pagas</option>
          </select>
          {temFiltro && (
            <button onClick={limparFiltros} className="flex items-center gap-1.5 text-[13px] text-[#6c757d] hover:text-alerr font-medium">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-linha rounded-xl overflow-hidden shadow-leve">
        <div className="hidden sm:block overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              <th className="w-10 px-4">
                <input type="checkbox"
                  checked={visiveis.length > 0 && visiveis.every((c) => selecionados.has(c.id))}
                  onChange={(e) => setSelecionados((s) => {
                    const n = new Set(s);
                    if (e.target.checked) visiveis.forEach((c) => n.add(c.id));
                    else visiveis.forEach((c) => n.delete(c.id));
                    return n;
                  })}
                  className="w-4 h-4 rounded border-linha cursor-pointer accent-amarelo" />
              </th>
              {COLUNAS.map((col) => {
                const ativa = col.sortable && ordem.campo === col.campo;
                return (
                  <th key={col.label || "acao"} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">
                    {col.sortable ? (
                      <button
                        onClick={() => alternarOrdem(col.campo!)}
                        className="inline-flex items-center gap-1 hover:text-amb transition select-none"
                        title="Ordenar por esta coluna"
                      >
                        {col.label}
                        <span className={`text-[10px] leading-none ${ativa ? "text-amb" : "text-[#c4c4c4]"}`}>
                          {ativa ? (ordem.dir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </button>
                    ) : col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr key={c.id} onClick={() => setAberta(c)} className={`h-14 cursor-pointer border-b border-[#f1f3f5] last:border-0 transition group relative ${selecionados.has(c.id) ? "bg-amarelo-light" : "hover:bg-[#f8f9fa]"}`}>
                <td className="w-10 px-4" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => alternarSel(c.id)}
                    className="w-4 h-4 rounded border-linha cursor-pointer accent-amarelo" />
                </td>
                <td className="px-4 text-[13px] font-medium relative">
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-amarelo opacity-0 group-hover:opacity-100 transition" />
                  <LojaCell contaId={c.id} lojaAtual={c.lojas} lojas={lojas} />
                </td>
                <td className="px-4 text-[13px] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <TipoIcon tipo={c.tipo} size={15} color={TIPOS[c.tipo]?.c} />
                    {TIPOS[c.tipo]?.n}
                  </span>
                </td>
                <td className="px-4 text-[13px] font-medium">
                  <FornecedorCell contaId={c.id} nome={c.fornecedor_nome} logo={logos[(c.fornecedor_nome ?? "").toLowerCase()]} />
                  {c.eh_rateio && <span className="text-[10px] font-mono text-amb border border-amarelo rounded px-1 ml-1.5">RATEIO</span>}
                </td>
                <td className="px-4">
                  {(c.tipo === "compra" || c.tipo === "nota_fiscal")
                    ? <span className="text-[13px] font-mono text-[#1a1a1a]">{c.chamado_numero ? `#${c.chamado_numero}` : (c.numero_nf ? `NF ${c.numero_nf}` : "—")}</span>
                    : <VencimentoCell contaId={c.id} dia={c.dia_vencimento} ano={ano} mes={mes} situacao={situacaoPorConta[c.id]} />}
                </td>
                <td className="px-4 text-[13px]">
                  {(c.tipo === "compra" || c.tipo === "nota_fiscal")
                    ? <span className="badge bg-info-bg text-info">SIGA POTENCIAL</span>
                    : <OrigemCell contaId={c.id} origem={c.origem} />}
                </td>
                <td className="px-4 text-[13px]"><StatusBadge status={c.status} /></td>
                <td className="px-4 text-right">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6" className="inline group-hover:stroke-amarelo"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={8} className="text-center py-14 text-[#adb5bd]">Nenhuma conta com esses filtros.</td></tr>
            )}
          </tbody>
        </table></div>

        {/* Lista em cards no celular (a tabela acima fica só no desktop) */}
        <div className="sm:hidden divide-y divide-linha2">
          {visiveis.map((c) => (
            <button key={c.id} onClick={() => setAberta(c)} className="w-full text-left px-4 py-3.5 hover:bg-[#f8f9fa] transition flex items-start gap-3">
              <div className="w-9 h-9 rounded-full grid place-items-center shrink-0 mt-0.5" style={{ background: TIPOS[c.tipo]?.bg }}>
                <TipoIcon tipo={c.tipo} size={17} color={TIPOS[c.tipo]?.c} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-txt truncate">{c.lojas?.codigo ?? "—"}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-[13px] text-txt-2 truncate mt-0.5">{c.fornecedor_nome ?? "—"}</div>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-txt-3">
                  <span>{TIPOS[c.tipo]?.n}</span>
                  {c.dia_vencimento != null && (c.tipo !== "compra" && c.tipo !== "nota_fiscal") && <span>vence dia {c.dia_vencimento}</span>}
                  {c.chamado_numero && <span>#{c.chamado_numero}</span>}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6" className="shrink-0 mt-2"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
            </button>
          ))}
          {filtradas.length === 0 && (
            <div className="text-center py-14 text-[#adb5bd] text-[13px]">Nenhuma conta com esses filtros.</div>
          )}
        </div>

        {/* paginação real - evita renderizar as 450 linhas de uma vez */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-linha2 flex-wrap gap-3">
          <span className="text-[12px] text-[#6c757d]">
            Mostrando {filtradas.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + itensPorPagina, filtradas.length)} de {filtradas.length} contas
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPagina((p) => Math.max(p - 1, 1))} disabled={paginaSegura === 1}
              className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">‹</button>
            <span className="text-[12.5px] text-[#1a1a1a] font-semibold px-2">{paginaSegura} / {totalPaginas}</span>
            <button onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))} disabled={paginaSegura === totalPaginas}
              className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">›</button>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#6c757d]">
            Por página
            <select value={itensPorPagina} onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPagina(1); }}
              className="border border-linha rounded-md px-2 py-1.5 text-[12.5px]">
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      {aberta && <ContaDrawer conta={aberta} onClose={() => setAberta(null)} ano={ano} mes={mes} usuarioId={usuarioId} usuarioEmail={usuarioEmail} usuarioNome={usuarioNome} />}
      {criando && <NovaContaDrawer lojas={lojas} onClose={() => setCriando(false)} />}

      {/* Barra fixa de ações em lote — aparece quando há contas selecionadas */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ebano text-white rounded-xl shadow-forte flex items-center gap-4 pl-5 pr-3 py-3">
          <span className="text-[13px] font-medium">{selecionados.size} selecionada{selecionados.size !== 1 ? "s" : ""}</span>
          <div className="h-5 w-px bg-white/20" />
          <button onClick={limparSel} className="text-[13px] text-white/70 hover:text-white transition">Limpar</button>
        </div>
      )}
    </>
  );
}

function ContaDrawer({ conta, onClose, ano: ANO_ATUAL, mes: MES_ATUAL, usuarioId, usuarioEmail, usuarioNome }: { conta: Conta; onClose: () => void; ano: number; mes: number; usuarioId: string | null; usuarioEmail: string | null; usuarioNome: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const T = TIPOS[conta.tipo];
  const ehCompraNF = conta.tipo === "compra" || conta.tipo === "nota_fiscal";
  const fmtCnpj = (c?: string | null) => (c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5") : "—");
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [comprasLoja, setComprasLoja] = useState<any[] | null>(null);
  const [movendoNeg, setMovendoNeg] = useState(false);
  const [negCriada, setNegCriada] = useState(false);

  async function moverParaNegociacao() {
    setMovendoNeg(true);
    const valorOriginal = (lancamentoAtual as any)?.valor ?? (conta as any).valor ?? null;
    const { error } = await supabase.from("negociacoes").insert({
      conta_id: conta.id,
      loja_id: conta.loja_id,
      tipo: conta.tipo,
      fornecedor_nome: conta.fornecedor_nome,
      valor_original: valorOriginal,
      valor_atualizado: valorOriginal,
      status: "aberta",
      prioridade: "media",
      criado_por: usuarioId ?? null,
    });
    setMovendoNeg(false);
    if (!error) {
      await supabase.from("contas").update({ em_negociacao: true }).eq("id", conta.id);
      setNegCriada(true);
    }
  }
  const [mesHover, setMesHover] = useState<number | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [senha, setSenha] = useState<string | null>(null);
  const [revelando, setRevelando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editandoCred, setEditandoCred] = useState(false);
  const [novoLogin, setNovoLogin] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [salvandoCred, setSalvandoCred] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(conta.portal_link ?? null);
  const [portalPadraoFornecedor, setPortalPadraoFornecedor] = useState<string | null>(null);
  const [editandoPortal, setEditandoPortal] = useState(false);
  const [novoPortalLink, setNovoPortalLink] = useState(conta.portal_link ?? "");
  const [salvarComoPadrao, setSalvarComoPadrao] = useState(false);
  const [salvandoPortal, setSalvandoPortal] = useState(false);
  const [editandoNf, setEditandoNf] = useState(false);
  const [salvandoNf, setSalvandoNf] = useState(false);
  const [nfNumero, setNfNumero] = useState(conta.numero_nf ?? "");
  const [nfRemetenteCnpj, setNfRemetenteCnpj] = useState(conta.remetente_cnpj ?? "");
  const [nfDestRazao, setNfDestRazao] = useState(conta.destinatario_razao ?? "");
  const [nfDestCnpj, setNfDestCnpj] = useState(conta.destinatario_cnpj ?? "");
  const [editandoDetalhes, setEditandoDetalhes] = useState(false);
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false);
  const [detFornecedor, setDetFornecedor] = useState(conta.fornecedor_nome ?? "");
  const [detVenc, setDetVenc] = useState(conta.dia_vencimento != null ? String(conta.dia_vencimento) : "");
  const [detIdent, setDetIdent] = useState(conta.identificador ?? "");
  const [detOrigem, setDetOrigem] = useState<string>(conta.origem);
  const [erroDetalhes, setErroDetalhes] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [dataEncerrar, setDataEncerrar] = useState("");
  const [motivoEncerrar, setMotivoEncerrar] = useState("");
  const [encerrarFornecedorTodo, setEncerrarFornecedorTodo] = useState(false);
  const [qtdContasFornecedor, setQtdContasFornecedor] = useState<number | null>(null);
  const [salvandoEncerramento, setSalvandoEncerramento] = useState(false);
  const [erroEncerramento, setErroEncerramento] = useState<string | null>(null);
  const [reativando, setReativando] = useState(false);

  async function abrirEncerramento() {
    setEncerrando(true);
    setDataEncerrar(new Date().toISOString().slice(0, 10));
    setMotivoEncerrar("");
    setEncerrarFornecedorTodo(false);
    setErroEncerramento(null);
    if (conta.fornecedor_nome) {
      const { count } = await supabase.from("contas").select("id", { count: "exact", head: true })
        .ilike("fornecedor_nome", conta.fornecedor_nome).eq("status", "ativo");
      setQtdContasFornecedor(count ?? null);
    }
  }

  async function reativarConta() {
    setReativando(true); setAviso(null);
    const { error } = await supabase.from("contas").update({
      status: "ativo",
      data_encerramento: null,
      encerrada_em: null,
      motivo_encerramento: null,
      encerrada_por: null,
    }).eq("id", conta.id);
    setReativando(false);
    if (error) { setAviso("Não foi possível reativar a conta."); return; }
    setAviso("Conta reativada.");
    agente.evento("conta_reativada", { loja: conta.lojas?.codigo });
    router.refresh();
  }

  async function confirmarEncerramento() {
    if (!dataEncerrar) { setErroEncerramento("Informe a data de encerramento."); return; }
    setSalvandoEncerramento(true);
    const payload = {
      status: "encerrado",
      data_encerramento: dataEncerrar,
      motivo_encerramento: motivoEncerrar.trim() || null,
      encerrada_por: usuarioId ?? null,
    };

    if (encerrarFornecedorTodo && conta.fornecedor_nome) {
      const { error } = await supabase.from("contas").update(payload).ilike("fornecedor_nome", conta.fornecedor_nome).eq("status", "ativo");
      setSalvandoEncerramento(false);
      if (error) { setErroEncerramento("Não foi possível encerrar as contas desse fornecedor."); return; }
    } else {
      const { error } = await supabase.from("contas").update(payload).eq("id", conta.id);
      setSalvandoEncerramento(false);
      if (error) { setErroEncerramento("Não foi possível encerrar a conta."); return; }
    }
    agente.evento("conta_encerrada", { loja: conta.lojas?.codigo });
    onClose();
    router.refresh();
  }
  const [lancando, setLancando] = useState(false);
  const [sucessoLancamento, setSucessoLancamento] = useState<string | null>(null);
  const [valorLancar, setValorLancar] = useState("");
  // lançamento sem documento: a conta existe e vence, mas o boleto não chegou
  const [semDoc, setSemDoc] = useState(false);
  const [motivoSemDoc, setMotivoSemDoc] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");
  const [vencSemDoc, setVencSemDoc] = useState("");
  const [obsSemDoc, setObsSemDoc] = useState("");
  const [motivoZerado, setMotivoZerado] = useState("");
  const [motivoZeradoOutro, setMotivoZeradoOutro] = useState("");
  const [salvandoSemDoc, setSalvandoSemDoc] = useState(false);
  const [erroSemDoc, setErroSemDoc] = useState<string | null>(null);
  const [arquivoBoleto, setArquivoBoleto] = useState<File | null>(null);
  const [hashArquivo, setHashArquivo] = useState<string | null>(null);
  const [enviarDrive, setEnviarDrive] = useState(false);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [avisoExtracao, setAvisoExtracao] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [confirmarMesmoAssim, setConfirmarMesmoAssim] = useState(false);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);
  const [erroLancamento, setErroLancamento] = useState<string | null>(null);

  // ano/mes agora vêm por props (período selecionado no topo do sistema),
  // não mais calculado aqui dentro - assim a ficha respeita o mês que a
  // pessoa está navegando, não sempre o mês real atual.

  const [aprovadorNome, setAprovadorNome] = useState<string | null>(null);
  const [historico, setHistorico] = useState<{ de: string | null; para: string; em: string; comentario: string | null; nome: string | null }[] | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [ajustandoStatus, setAjustandoStatus] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  function carregarLancamentos() {
    supabase.from("lancamentos").select("id, ano, mes, valor, situacao, comprovante_url, comprovante_drive_url, aprovado_por, aprovado_em, sem_documento, motivo_sem_documento, documento_anexado_em, motivo_zerado")
      .eq("conta_id", conta.id).eq("ano", ANO_ATUAL)
      .then(({ data }) => setLancs((data ?? []) as Lancamento[]));
  }

  useEffect(() => {
    carregarLancamentos();
    if (ehCompraNF && conta.loja_id) {
      supabase.from("compra_detalhe")
        .select("valor, ano, mes, dia, fornecedor_nome, chamado_numero, numero_nf, criado_em")
        .eq("loja_id", conta.loja_id).eq("ano", ANO_ATUAL)
        .order("mes", { ascending: false }).order("dia", { ascending: false })
        .then(({ data }) => setComprasLoja((data ?? []) as any[]));
    }
    supabase.from("credenciais_login").select("login").eq("conta_id", conta.id).maybeSingle()
      .then(({ data }) => setLogin((data as any)?.login ?? null));
    setPortalLink(conta.portal_link ?? null);
    setNovoPortalLink(conta.portal_link ?? "");
    if (conta.fornecedor_nome) {
      supabase.from("fornecedores").select("portal_padrao").ilike("nome", conta.fornecedor_nome).maybeSingle()
        .then(({ data }) => setPortalPadraoFornecedor((data as any)?.portal_padrao ?? null));
    }
  }, [conta.id]);

  const lancamentoAtual = lancs.find((l) => l.mes === MES_ATUAL);

  useEffect(() => {
    const idAprovador = (lancamentoAtual as any)?.aprovado_por;
    if (!idAprovador) { setAprovadorNome(null); return; }
    supabase.from("perfis").select("nome").eq("id", idAprovador).maybeSingle()
      .then(({ data }) => setAprovadorNome(data?.nome ?? null));
  }, [(lancamentoAtual as any)?.aprovado_por]);

  // linha do tempo do lançamento (quem fez o quê, quando e por quê)
  useEffect(() => {
    if (!verHistorico || !lancamentoAtual?.id) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("lancamento_historico")
        .select("de, para, em, comentario, quem")
        .eq("lancamento_id", lancamentoAtual.id)
        .order("em", { ascending: true });
      if (!vivo) return;
      const ids = Array.from(new Set((data ?? []).map((h: any) => h.quem).filter(Boolean)));
      const { data: pf } = ids.length
        ? await supabase.from("perfis").select("id, nome").in("id", ids)
        : { data: [] as any[] };
      const mapa = new Map((pf ?? []).map((x: any) => [x.id, x.nome]));
      if (!vivo) return;
      setHistorico((data ?? []).map((h: any) => ({
        de: h.de, para: h.para, em: h.em, comentario: h.comentario,
        nome: h.quem ? (mapa.get(h.quem) ?? null) : null,
      })));
    })();
    return () => { vivo = false; };
  }, [verHistorico, lancamentoAtual?.id]);

  const STATUS_AJUSTE: { valor: string; rotulo: string; ajuda: string }[] = [
    { valor: "pendente",   rotulo: "Em lançamento",       ajuda: "volta para edição, sai da fila" },
    { valor: "lancado",    rotulo: "Aguardando aprovação", ajuda: "volta para a fila como solicitação nova" },
    { valor: "aprovado",   rotulo: "Aprovada",            ajuda: "considera aprovada" },
    { valor: "contestado", rotulo: "Reprovada",           ajuda: "marca como recusada" },
    { valor: "cancelado",  rotulo: "Cancelada",           ajuda: "encerra sem pagamento" },
  ];

  async function aplicarAjusteStatus() {
    if (!lancamentoAtual?.id || !novoStatus) return;
    setSalvandoStatus(true);
    const { data, error } = await supabase.rpc("ajustar_status_lancamento", {
      p_id: lancamentoAtual.id, p_situacao: novoStatus,
    });
    setSalvandoStatus(false);
    if (error) {
      setAviso(/permiss|42501/i.test(error.message ?? "")
        ? "Só admin ou gestor pode ajustar o status."
        : "Não foi possível ajustar o status.");
      return;
    }
    if (!data || Number(data) === 0) { setAviso("Nada foi alterado."); return; }

    // voltou para a fila: avisa o Slack como uma solicitação nova
    if (novoStatus === "lancado") {
      fetch("/api/notificar-evento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "reenviada", loja: conta.lojas?.codigo,
          tipo: TIPOS[conta.tipo]?.n ?? conta.tipo,
          valor: money(Number(lancamentoAtual.valor ?? 0)), por: usuarioEmail ?? undefined,
        }),
      }).catch(() => {});
    }
    setAjustandoStatus(false); setNovoStatus("");
    setSucessoLancamento("Status ajustado.");
    setTimeout(() => setSucessoLancamento(null), 6000);
    router.refresh();
  }

  async function reenviarParaAprovacao() {
    if (!lancamentoAtual?.id) return;
    setReenviando(true);
    const { error } = await supabase.from("lancamentos").update({
      situacao: "lancado",
      reenviado_em: new Date().toISOString(),
      reenviado_por: usuarioId ?? null,
    }).eq("id", lancamentoAtual.id);
    setReenviando(false);
    if (error) { setAviso("Não foi possível reenviar para aprovação."); return; }
    setSucessoLancamento("Reenviado para aprovação.");
    setTimeout(() => setSucessoLancamento(null), 6000);
    router.refresh();
  }

  async function salvarDetalhes() {
    setSalvandoDetalhes(true); setErroDetalhes(null);
    const diaNum = detVenc.trim() === "" ? null : parseInt(detVenc, 10);
    if (diaNum !== null && (isNaN(diaNum) || diaNum < 1 || diaNum > 31)) {
      setSalvandoDetalhes(false); setErroDetalhes("O vencimento deve ser um dia entre 1 e 31."); return;
    }
    const { error } = await supabase.from("contas").update({
      fornecedor_nome: detFornecedor.trim() || null,
      dia_vencimento: diaNum,
      identificador: detIdent.trim() || null,
      origem: detOrigem,
    }).eq("id", conta.id);
    setSalvandoDetalhes(false);
    if (error) { setErroDetalhes("Não foi possível salvar as alterações."); return; }
    setEditandoDetalhes(false);
  }

  async function salvarNf() {
    setSalvandoNf(true);
    const patch = {
      numero_nf: nfNumero.trim() || null,
      remetente_cnpj: nfRemetenteCnpj.replace(/\D/g, "") || null,
      destinatario_razao: nfDestRazao.trim() || null,
      destinatario_cnpj: nfDestCnpj.replace(/\D/g, "") || null,
    };
    const mudou = patch.numero_nf !== (conta.numero_nf ?? null) || patch.remetente_cnpj !== (conta.remetente_cnpj ?? null)
      || patch.destinatario_razao !== (conta.destinatario_razao ?? null) || patch.destinatario_cnpj !== (conta.destinatario_cnpj ?? null);
    await supabase.from("contas").update(patch).eq("id", conta.id);
    // registra no histórico do lançamento (rastreabilidade: quem, quando, o quê)
    if (mudou && lancamentoAtual?.id) {
      await supabase.from("lancamento_historico").insert({
        lancamento_id: lancamentoAtual.id,
        de: conta.destinatario_razao ?? conta.numero_nf ?? "—",
        para: patch.destinatario_razao ?? patch.numero_nf ?? "—",
        comentario: "Dados da nota fiscal atualizados manualmente",
        quem: usuarioId ?? null,
        em: new Date().toISOString(),
      });
    }
    conta.numero_nf = patch.numero_nf;
    conta.remetente_cnpj = patch.remetente_cnpj;
    conta.destinatario_razao = patch.destinatario_razao;
    conta.destinatario_cnpj = patch.destinatario_cnpj;
    setSalvandoNf(false);
    setEditandoNf(false);
  }

  async function salvarPortal() {
    const link = novoPortalLink.trim();
    if (!link) return;
    setSalvandoPortal(true);
    const { error } = await supabase.from("contas").update({ portal_link: link }).eq("id", conta.id);
    if (!error && salvarComoPadrao && conta.fornecedor_nome) {
      // aplica esse link como padrão do fornecedor, pra próxima conta desse
      // mesmo fornecedor já vir sugerida sozinha, sem digitar de novo.
      await supabase.from("fornecedores").update({ portal_padrao: link }).ilike("nome", conta.fornecedor_nome);
      setPortalPadraoFornecedor(link);
    }
    setSalvandoPortal(false);
    if (!error) { setPortalLink(link); setEditandoPortal(false); router.refresh(); }
  }

  async function revelar() {
    setRevelando(true);
    const { data, error } = await supabase.rpc("credencial_ler", { p_conta_id: conta.id, p_motivo: "consulta de fatura" });
    setRevelando(false);
    if (error) { setAviso("Sem permissão ou credencial não encontrada."); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setLogin(row?.login ?? login);
    setSenha(row?.senha ?? "(vazia)");
    setAviso("Acesso registrado no log de auditoria.");
  }

  async function salvarCredencial() {
    setSalvandoCred(true);
    const { error } = await supabase.rpc("credencial_salvar", {
      p_conta_id: conta.id, p_login: novoLogin.trim() || null, p_senha: novaSenha.trim() || null,
    });
    setSalvandoCred(false);
    if (error) { setAviso("Sem permissão para editar credencial."); return; }
    setLogin(novoLogin.trim() || login);
    setSenha(null);
    setEditandoCred(false);
    setAviso("Credencial atualizada.");
  }

  async function selecionarArquivo(arquivo: File | null) {
    setArquivoBoleto(arquivo);
    setHashArquivo(null);
    setAvisoExtracao(null);
    setAlertas([]);
    setConfirmarMesmoAssim(false);
    if (!arquivo) return;

    // hash dos bytes do arquivo - calculado no navegador, na hora, sem
    // precisar mandar pra IA. Dois arquivos idênticos sempre dão o mesmo
    // hash, então é a forma confiável de achar "esse arquivo já foi
    // enviado antes", mesmo que a leitura do código de barras varie.
    const bytes = await arquivo.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    setHashArquivo(hash);

    // checagens rápidas, sem gastar chamada de IA: tamanho fora do normal
    // pra um boleto, e assinatura do arquivo (os primeiros bytes) batendo
    // com o formato esperado - pega arquivo corrompido ou trocado na hora.
    const tamanhoForaDoNormal = arquivo.size < 3000 || arquivo.size > 10 * 1024 * 1024;
    const cabecalho = new Uint8Array(bytes.slice(0, 4));
    const ehPdfValido = cabecalho[0] === 0x25 && cabecalho[1] === 0x50 && cabecalho[2] === 0x44 && cabecalho[3] === 0x46; // %PDF
    const ehJpegValido = cabecalho[0] === 0xff && cabecalho[1] === 0xd8;
    const ehPngValido = cabecalho[0] === 0x89 && cabecalho[1] === 0x50 && cabecalho[2] === 0x4e && cabecalho[3] === 0x47;
    const arquivoCorrompido = !ehPdfValido && !ehJpegValido && !ehPngValido;

    setExtraindo(true);
    let valorExtraido: number | null = null;
    let codigoExtraido: string | null = null;
    let documentoSuspeito = false;
    let formatoInvalido = false;
    let codigoNaoFechaMatematicamente = false;
    let tipoDetectado: string | null = null;
    let diaVencimentoDetectado: number | null = null;
    if (!arquivoCorrompido) {
      try {
        const form = new FormData();
        form.append("arquivo", arquivo);
        const resp = await fetch("/api/extrair-boleto", { method: "POST", body: form });
        const json = await resp.json();
        if (resp.ok) {
          valorExtraido = json.valor;
          codigoExtraido = json.codigo_barras;
          documentoSuspeito = json.parece_documento_valido === false;
          formatoInvalido = json.codigo_barras && json.formato_codigo_valido === false;
          codigoNaoFechaMatematicamente = json.codigo_barras && json.codigo_barras_fecha_matematicamente === false;
          tipoDetectado = json.tipo_conta ?? null;
          diaVencimentoDetectado = json.dia_vencimento ?? null;
          // só preenche sozinho se a pessoa ainda não tinha digitado nada -
          // nunca sobrescreve um valor que já foi digitado na mão.
          if (valorExtraido != null && !valorLancar.trim()) setValorLancar(String(valorExtraido).replace(".", ","));
          if (codigoExtraido) setCodigoBarras(codigoExtraido);
          if (valorExtraido == null && !codigoExtraido) setAvisoExtracao("Não consegui ler o valor nem o código de barras automaticamente - confere e preenche na mão.");
        } else {
          setAvisoExtracao("Não foi possível ler o boleto automaticamente. Confere e preenche na mão.");
        }
      } catch {
        setAvisoExtracao("Não foi possível ler o boleto automaticamente. Confere e preenche na mão.");
      }
    }
    setExtraindo(false);

    await rodarVerificacoes({
      codigo: codigoExtraido ?? codigoBarras,
      valor: valorExtraido ?? Number(valorLancar.replace(",", ".")) ?? null,
      documentoSuspeito, formatoInvalido, hash, tipoDetectado,
      codigoNaoFechaMatematicamente, diaVencimentoDetectado,
      arquivoCorrompido, tamanhoForaDoNormal,
    });
  }

  async function rodarVerificacoes(params: {
    codigo: string | null; valor: number | null; documentoSuspeito?: boolean; formatoInvalido?: boolean; hash?: string | null; tipoDetectado?: string | null;
    codigoNaoFechaMatematicamente?: boolean; diaVencimentoDetectado?: number | null; arquivoCorrompido?: boolean; tamanhoForaDoNormal?: boolean;
  }) {
    setVerificando(true);
    const novosAlertas: string[] = [];
    setBloqueio(null);

    // regra: o tipo de conta que a IA identificou no documento bate com o
    // tipo dessa conta específica? Pega quem anexa conta de telefone numa
    // ficha de água, por exemplo.
    if (params.tipoDetectado && params.tipoDetectado !== conta.tipo) {
      const nomeDetectado = TIPOS[params.tipoDetectado]?.n ?? params.tipoDetectado;
      const nomeConta = TIPOS[conta.tipo]?.n ?? conta.tipo;
      novosAlertas.push(`Esse documento parece ser uma conta de ${nomeDetectado}, mas você está lançando numa conta de ${nomeConta}. Confere se é o arquivo certo.`);
    }

    // regra 0: mesmo arquivo (bytes idênticos) já enviado em qualquer lançamento
    // - mais confiável que comparar código de barras, que pode ler diferente
    // entre duas fotos/scans do mesmo boleto.
    const hashParaChecar = params.hash ?? hashArquivo;
    if (hashParaChecar) {
      const { data: mesmoArquivo } = await supabase
        .from("lancamentos")
        .select("id, mes, ano, contas!inner ( lojas ( codigo ) )")
        .eq("arquivo_hash", hashParaChecar)
        .neq("id", lancamentoAtual?.id ?? "00000000-0000-0000-0000-000000000000");
      const outroArquivo = (mesmoArquivo ?? [])[0] as any;
      if (outroArquivo) {
        novosAlertas.push(`Esse exato arquivo já foi enviado antes: ${outroArquivo.contas?.lojas?.codigo ?? "outra conta"} (${outroArquivo.mes}/${outroArquivo.ano}). Confere se não é o mesmo boleto por engano.`);
      }
    }

    if (params.arquivoCorrompido) {
      novosAlertas.push("Esse arquivo não parece um PDF ou imagem válido - pode estar corrompido ou ter vindo errado no envio.");
    }
    if (params.tamanhoForaDoNormal) {
      novosAlertas.push("O tamanho desse arquivo está fora do normal pra um boleto - confere se é o arquivo certo antes de lançar.");
    }
    if (params.documentoSuspeito) {
      novosAlertas.push("O arquivo enviado não parece um boleto ou fatura de verdade - confere se é o documento certo.");
    }
    if (params.formatoInvalido) {
      novosAlertas.push("O código de barras não tem o formato esperado (47 ou 48 dígitos) - pode ter vindo errado na leitura.");
    }
    if (params.codigoNaoFechaMatematicamente) {
      novosAlertas.push("O código de barras lido não fecha matematicamente (dígito verificador não bate) - bem provável que a leitura veio errada. Confere na mão.");
    }
    if (params.diaVencimentoDetectado != null && conta.dia_vencimento != null) {
      const diff = Math.abs(params.diaVencimentoDetectado - conta.dia_vencimento);
      if (diff > 3) {
        novosAlertas.push(`O vencimento lido no documento (dia ${params.diaVencimentoDetectado}) está bem diferente do cadastrado nessa conta (dia ${conta.dia_vencimento}). Confere se é o boleto certo.`);
      }
    }

    // regra 1: BLOQUEIO - mesmo código de barras já lançado NESTA loja.
    // Exceções: boleto anterior recusado/cancelado, ou competência diferente.
    const codigoLimpo = params.codigo?.replace(/\D/g, "") ?? "";
    if (codigoLimpo.length >= 40) {
      const { data: duplicados } = await supabase
        .from("lancamentos")
        .select("id, mes, ano, situacao, lancado_em, lancado_por, contas!inner ( loja_id, lojas ( codigo ) )")
        .eq("codigo_barras", params.codigo)
        .neq("id", lancamentoAtual?.id ?? "00000000-0000-0000-0000-000000000000");

      const mesmaLoja = (duplicados ?? []).filter((d: any) => d.contas?.loja_id === conta.loja_id);
      // recusado/cancelado não bloqueia; competência diferente também não
      const impeditivo = mesmaLoja.find((d: any) =>
        d.situacao !== "contestado" && d.ano === ANO_ATUAL && d.mes === MES_ATUAL);

      if (impeditivo) {
        let quem = "";
        if ((impeditivo as any).lancado_por) {
          const { data: p } = await supabase.from("perfis").select("nome").eq("id", (impeditivo as any).lancado_por).maybeSingle();
          if (p?.nome) quem = ` por ${p.nome}`;
        }
        const quando = (impeditivo as any).lancado_em
          ? new Date((impeditivo as any).lancado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : `${impeditivo.mes}/${impeditivo.ano}`;
        const st = SITUACAO[(impeditivo as any).situacao]?.label ?? (impeditivo as any).situacao;
        setBloqueio(`Este boleto já foi lançado anteriormente para esta loja e não pode ser cadastrado novamente.\nLançado em ${quando}${quem} · Status atual: ${st}.`);
        setAlertas([]);
        setVerificando(false);
        return;
      }
      // mesmo código, mas em outra loja ou outra competência: só avisa
      const outro = mesmaLoja[0] ?? (duplicados ?? [])[0];
      if (outro) {
        novosAlertas.push(`Esse código de barras já foi lançado antes: ${(outro as any).contas?.lojas?.codigo ?? "outra conta"} (${outro.mes}/${outro.ano}). Confere se não é o mesmo boleto duplicado.`);
      }
    }

    // regra 1b: possível duplicidade - mesma loja + fornecedor + valor + vencimento,
    // mesmo com código de barras diferente.
    if (params.valor != null && params.valor > 0 && conta.fornecedor_nome) {
      const { data: semelhantes } = await supabase
        .from("lancamentos")
        .select("id, mes, ano, valor, contas!inner ( loja_id, fornecedor_nome, dia_vencimento )")
        .eq("ano", ANO_ATUAL).eq("mes", MES_ATUAL)
        .eq("valor", params.valor)
        .neq("id", lancamentoAtual?.id ?? "00000000-0000-0000-0000-000000000000");
      const parecido = (semelhantes ?? []).find((s: any) =>
        s.contas?.loja_id === conta.loja_id &&
        (s.contas?.fornecedor_nome ?? "").toLowerCase() === (conta.fornecedor_nome ?? "").toLowerCase() &&
        s.contas?.dia_vencimento === conta.dia_vencimento);
      if (parecido) {
        novosAlertas.push("Foi encontrada uma conta muito semelhante já cadastrada (mesma loja, fornecedor, valor e vencimento). Deseja revisar antes de continuar?");
      }
    }

    // regra 2: valor muito fora do padrão histórico dessa conta
    if (params.valor != null && params.valor > 0) {
      const historico = lancs.filter((l) => l.valor != null && l.valor > 0 && l.id !== lancamentoAtual?.id).map((l) => l.valor!);
      if (historico.length >= 2) {
        const media = historico.reduce((s, v) => s + v, 0) / historico.length;
        if (media > 0 && (params.valor > media * 2.5 || params.valor < media * 0.3)) {
          novosAlertas.push(`Esse valor está bem diferente do que essa conta costuma ter (média de ${money(media)} nos últimos lançamentos).`);
        }
      }
    }

    setAlertas(novosAlertas);
    setVerificando(false);
  }

  /**
   * Lança uma conta cujo boleto não chegou.
   *
   * O lançamento entra em "lancado" como qualquer outro — segue pra
   * aprovação e pagamento normalmente. O que muda é que fica marcado como
   * sem documento, com o motivo obrigatório, e o Slack avisa o time pra
   * alguém correr atrás do documento.
   */
  async function lancarSemDocumento() {
    setErroSemDoc(null);

    const lido = lerValorDigitado(valorLancar);
    if (!lido.ok) { setErroSemDoc(lido.erro!); return; }
    const valorNum = lido.valor!;
    // R$ 0,00 é aceito, mas exige dizer por que não houve cobrança
    if (ehZerada(valorNum) && !motivoZeradoValido(motivoZerado, motivoZeradoOutro)) {
      setErroSemDoc("Conta zerada: informe o motivo da conta estar em R$ 0,00."); return;
    }
    // a regra de segurança: sem motivo, não lança
    if (!motivoValido(motivoSemDoc, motivoOutro)) {
      setErroSemDoc(motivoSemDoc === "outro"
        ? "Descreva o motivo do lançamento sem documento."
        : "Selecione o motivo do lançamento sem documento.");
      return;
    }

    setSalvandoSemDoc(true);
    const motivo = textoDoMotivo(motivoSemDoc, motivoOutro);
    const vencimento = vencSemDoc || null;

    const { data: lanc, error } = await supabase.from("lancamentos").upsert({
      conta_id: conta.id, ano: ANO_ATUAL, mes: MES_ATUAL,
      valor: valorNum,
      situacao: "lancado",
      lancado_em: new Date().toISOString(),
      lancado_por: usuarioId,
      sem_documento: true,
      motivo_sem_documento: motivo,
      motivo_zerado: ehZerada(valorNum) ? textoMotivoZerado(motivoZerado, motivoZeradoOutro) : null,
      vencimento,
      observacao: obsSemDoc.trim() || null,
    }, { onConflict: "conta_id,ano,mes" }).select("id").single();

    if (error || !lanc) {
      setSalvandoSemDoc(false);
      setErroSemDoc("Não foi possível salvar o lançamento.");
      return;
    }

    // histórico: fica registrado que entrou sem documento, e por quê
    await supabase.from("lancamento_historico").insert({
      lancamento_id: lanc.id,
      de: "pendente", para: "lancado",
      quem: usuarioId,
      comentario: `Lançado sem documento. Motivo: ${motivo}`,
      em: new Date().toISOString(),
    });

    const venc = vencimento
      ? formatarDataSemFuso(vencimento)
      : (conta.dia_vencimento ? `${String(conta.dia_vencimento).padStart(2, "0")}/${String(MES_ATUAL).padStart(2, "0")}/${ANO_ATUAL}` : "—");

    fetch("/api/notificar-evento", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento: "sem_documento",
        texto: mensagemSemDocumento({
          loja: conta.lojas?.codigo ?? null,
          tipoConta: T?.n ?? conta.tipo,
          instalacao: conta.insc_cod_mat ?? conta.identificador ?? null,
          fornecedor: conta.fornecedor_nome ?? null,
          competencia: `${String(MES_ATUAL).padStart(2, "0")}/${ANO_ATUAL}`,
          vencimento: venc,
          valor: money(valorNum),
          motivo,
          observacao: obsSemDoc,
          lancadoPor: usuarioNome ?? usuarioEmail ?? "—",
          dataHora: agoraBrasil(),
        }),
      }),
    }).catch(() => {});

    setSalvandoSemDoc(false);
    setSemDoc(false);
    setMotivoSemDoc(""); setMotivoOutro(""); setObsSemDoc(""); setVencSemDoc("");
    setValorLancar("");
    setSucessoLancamento("Conta lançada sem documento. O time foi avisado no Slack.");
    setTimeout(() => setSucessoLancamento(null), 6000);
    router.refresh();
  }

  async function lancarComBoleto() {
    const lidoBoleto = lerValorDigitado(valorLancar);
    if (!lidoBoleto.ok) { setErroLancamento(lidoBoleto.erro!); return; }
    // R$ 0,00 vale como lançamento, desde que se diga por quê
    if (ehZerada(lidoBoleto.valor) && !motivoZeradoValido(motivoZerado, motivoZeradoOutro)) {
      setErroLancamento("Conta zerada: informe o motivo da conta estar em R$ 0,00."); return;
    }
    setSalvandoLancamento(true);
    setErroLancamento(null);

    let caminhoBoleto: string | null = lancamentoAtual?.comprovante_url ?? null;
    let linkDrive: string | null = (lancamentoAtual as any)?.comprovante_drive_url ?? null;

    if (arquivoBoleto) {
      const ext = arquivoBoleto.name.split(".").pop();
      const lojaSlug = nomeArquivoSeguro(conta.lojas?.codigo ?? "loja");
      const competencia = `${String(MES_ATUAL).padStart(2, "0")}-${ANO_ATUAL}`;
      const caminho = `${lojaSlug}/${conta.tipo}/${competencia}_${conta.id.slice(0, 8)}.${ext}`;
      const { error: erroUpload } = await supabase.storage.from("boletos").upload(caminho, arquivoBoleto, { upsert: true });
      if (erroUpload) { setSalvandoLancamento(false); setErroLancamento("Não foi possível enviar o boleto."); return; }
      caminhoBoleto = caminho;

      if (enviarDrive) {
        const form = new FormData();
        form.append("arquivo", arquivoBoleto);
        form.append("ano", String(ANO_ATUAL));
        form.append("mes", MES[MES_ATUAL - 1]);
        form.append("mesNumero", String(MES_ATUAL).padStart(2, "0"));
        form.append("dia", String(new Date().getDate()).padStart(2, "0"));
        form.append("loja", conta.lojas?.codigo ?? "loja");
        form.append("tipo", T?.n ?? conta.tipo);
        form.append("empresa", conta.lojas?.empresas?.nome ?? "");
        try {
          const resp = await fetch("/api/upload-drive", { method: "POST", body: form });
          const json = await resp.json();
          if (resp.ok) linkDrive = json.webViewLink;
          else setErroLancamento(`Boleto salvo no sistema, mas não foi possível enviar ao Drive: ${json.error}`);
        } catch {
          setErroLancamento("Boleto salvo no sistema, mas o envio ao Google Drive falhou.");
        }
      }
    }

    const payload: any = {
      conta_id: conta.id, ano: ANO_ATUAL, mes: MES_ATUAL,
      valor: lidoBoleto.valor,
      motivo_zerado: ehZerada(lidoBoleto.valor) ? textoMotivoZerado(motivoZerado, motivoZeradoOutro) : null,
      situacao: "lancado", comprovante_url: caminhoBoleto,
      lancado_em: new Date().toISOString(),
      codigo_barras: codigoBarras.trim() || null,
      arquivo_hash: hashArquivo,
    };
    if (linkDrive) payload.comprovante_drive_url = linkDrive;

    // Esse lançamento tinha entrado sem documento e agora o documento chegou:
    // marca quem anexou e quando. O sem_documento continua true de propósito —
    // é fato histórico, e é o que permite auditar depois quantas contas
    // entraram às cegas num mês.
    const anexandoDepois = !!arquivoBoleto
      && !!(lancamentoAtual as any)?.sem_documento
      && !(lancamentoAtual as any)?.documento_anexado_em;
    if (anexandoDepois) {
      payload.documento_anexado_em = new Date().toISOString();
      payload.documento_anexado_por = usuarioId;
    }

    const { error } = await supabase.from("lancamentos").upsert(payload, { onConflict: "conta_id,ano,mes" });
    setSalvandoLancamento(false);
    if (error) { setErroLancamento("Não foi possível salvar o lançamento."); return; }

    if (anexandoDepois && lancamentoAtual?.id) {
      await supabase.from("lancamento_historico").insert({
        lancamento_id: lancamentoAtual.id,
        de: "sem documento", para: "documento anexado",
        quem: usuarioId,
        comentario: "Documento que faltava foi anexado.",
        em: new Date().toISOString(),
      });
      fetch("/api/notificar-evento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "documento_anexado",
          loja: conta.lojas?.codigo, tipo: T?.n ?? conta.tipo,
          competencia: `${String(MES_ATUAL).padStart(2, "0")}/${ANO_ATUAL}`,
          por: usuarioNome ?? usuarioEmail ?? undefined,
        }),
      }).catch(() => {});
    }
    // fecha o formulário, limpa os campos e confirma na própria área da fatura
    setLancando(false);
    setValorLancar("");
    setArquivoBoleto(null);
    setCodigoBarras("");
    setHashArquivo(null);
    setAlertas([]);
    setConfirmarMesmoAssim(false);
    setErroLancamento(null);
    setSucessoLancamento("Lançamento realizado com sucesso.");
    agente.evento("lancamento", { loja: conta.lojas?.codigo, tipo: conta.tipo });
    setTimeout(() => setSucessoLancamento(null), 6000);
    router.refresh(); // atualiza a lista de contas sem sair da página
  }

  async function verBoleto(caminho: string) {
    const { data, error } = await supabase.storage.from("boletos").createSignedUrl(caminho, 300);
    if (error || !data) { setAviso("Não foi possível abrir o boleto."); return; }
    window.open(data.signedUrl, "_blank");
  }

  function baixarExtrato() {
    const linhas = ["mes,valor,situacao"];
    lancs.forEach((l) => linhas.push(`${MES[l.mes - 1]},${l.valor ?? ""},${SITUACAO[l.situacao]?.label ?? l.situacao}`));
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `extrato_${conta.lojas?.codigo ?? "conta"}_${conta.tipo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const valores = lancs.filter((l) => l.valor != null).map((l) => Number(l.valor));
  const maxv = Math.max(...valores, 1);
  // Compra/NF: soma por mês das compras da loja (todos os fornecedores)
  const somaMesCompra = (mi: number) => (comprasLoja ?? []).filter((c) => c.mes === mi + 1).reduce((s, c) => s + Number(c.valor || 0), 0);
  const comprasPorMes = Array.from({ length: 12 }, (_, mi) => somaMesCompra(mi));
  const maxCompra = Math.max(...comprasPorMes, 1);
  const temHistoricoCompra = (comprasLoja ?? []).length > 0;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[380px] max-w-[94vw] bg-white border-l border-linha z-50 overflow-y-auto">
        <div className="relative px-5 py-5 border-b border-linha">
          <span className="absolute left-0 right-0 top-0 h-1 bg-amarelo" />
          <button onClick={onClose} className="absolute right-5 top-5 text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: T?.bg }}>
              <TipoIcon tipo={conta.tipo} size={20} color={T?.c} />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-[#1a1a1a] leading-tight">Conta de {T?.n}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[13px] text-[#6c757d]">{conta.lojas?.codigo}</span>
                <StatusBadgeDrawer status={conta.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-semibold text-[#1a1a1a]">Detalhes da conta</div>
            {!editandoDetalhes && (
              <button onClick={() => { setEditandoDetalhes(true); setErroDetalhes(null); }}
                className="text-[11.5px] text-[#adb5bd] hover:text-[#1a1a1a]">editar</button>
            )}
          </div>
          {!editandoDetalhes ? (
            ehCompraNF ? (
            <div className="grid grid-cols-2 gap-y-4 gap-x-3 mb-6">
              <CampoIcone icone={<TipoIcon tipo={conta.tipo} size={16} />} label="Fornecedor" valor={detFornecedor || "—"} />
              {conta.tipo === "compra" && <CampoIcone icone={ICONES_CAMPO.tag} label="Nº do chamado" valor={conta.chamado_numero || "—"} mono />}
              <CampoIcone icone={ICONES_CAMPO.documento} label="Nº da nota fiscal" valor={(nfNumero || conta.numero_nf) || "—"} mono />
              <CampoIcone icone={ICONES_CAMPO.globo} label="Origem" valor="SIGA POTENCIAL" />
            </div>
            ) : (
            <div className="grid grid-cols-2 gap-y-4 gap-x-3 mb-6">
              <CampoIcone icone={<TipoIcon tipo={conta.tipo} size={16} />} label="Fornecedor" valor={detFornecedor || "—"} />
              <CampoIcone icone={ICONES_CAMPO.calendario} label="Vencimento" valor={detVenc ? `dia ${detVenc}` : "—"} />
              <CampoIcone icone={ICONES_CAMPO.documento} label={CAMPOS_TIPO[conta.tipo]?.labelIdentificador ?? "Código da conta"} valor={detIdent || "—"} mono />
              <CampoIcone icone={ICONES_CAMPO.globo} label="Origem" valor={ORIGENS[detOrigem]} />
            </div>
            )
          ) : (
            <div className="mb-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <div className="text-[11px] text-[#adb5bd] font-medium mb-1">Fornecedor</div>
                  <input value={detFornecedor} onChange={(e) => setDetFornecedor(e.target.value)} className="input-padrao w-full" />
                </label>
                <label>
                  <div className="text-[11px] text-[#adb5bd] font-medium mb-1">Vencimento (dia)</div>
                  <input value={detVenc} onChange={(e) => setDetVenc(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1-31" className="input-padrao w-full" />
                </label>
                <label>
                  <div className="text-[11px] text-[#adb5bd] font-medium mb-1">{CAMPOS_TIPO[conta.tipo]?.labelIdentificador ?? "Código da conta"}</div>
                  <input value={detIdent} onChange={(e) => setDetIdent(e.target.value)} className="input-padrao w-full font-mono" />
                </label>
                <label>
                  <div className="text-[11px] text-[#adb5bd] font-medium mb-1">Origem</div>
                  <select value={detOrigem} onChange={(e) => setDetOrigem(e.target.value)} className="input-padrao w-full">
                    {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
              {erroDetalhes && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{erroDetalhes}</div>}
              <div className="flex gap-2">
                <button onClick={salvarDetalhes} disabled={salvandoDetalhes} className="btn-primario flex-1 disabled:opacity-50">
                  {salvandoDetalhes ? "Salvando..." : "Salvar detalhes"}
                </button>
                <button onClick={() => {
                  setEditandoDetalhes(false); setErroDetalhes(null);
                  setDetFornecedor(conta.fornecedor_nome ?? "");
                  setDetVenc(conta.dia_vencimento != null ? String(conta.dia_vencimento) : "");
                  setDetIdent(conta.identificador ?? "");
                  setDetOrigem(conta.origem);
                }} className="btn-secundario">Cancelar</button>
              </div>
            </div>
          )}

          <div className={`pb-5 mb-5 border-b border-linha ${ehCompraNF ? "hidden" : ""}`}>
            <div className="text-[11px] text-[#adb5bd] font-medium mb-2">Portal do fornecedor</div>
            {!editandoPortal ? (
              portalLink ? (
                <div className="flex items-center gap-2">
                  <a href={portalLink} target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-ebano text-white rounded-md py-2 text-[12.5px] font-semibold hover:opacity-90 transition">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 12l7-7M11 3h6v6M17 11v5a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h5" /></svg>
                    Abrir site do fornecedor
                  </a>
                  <button onClick={() => setEditandoPortal(true)} className="text-[11.5px] text-[#adb5bd] hover:text-[#1a1a1a] shrink-0">editar</button>
                </div>
              ) : portalPadraoFornecedor ? (
                <div>
                  <div className="text-[11.5px] text-[#6c757d] mb-1.5">Essa conta não tem link próprio, mas {conta.fornecedor_nome} já tem um padrão salvo.</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setNovoPortalLink(portalPadraoFornecedor); salvarPortal(); }}
                      className="flex-1 bg-ebano text-white rounded-md py-2 text-[12.5px] font-semibold hover:opacity-90 transition">
                      Usar {portalPadraoFornecedor.replace(/^https?:\/\//, "").split("/")[0]}
                    </button>
                    <button onClick={() => setEditandoPortal(true)} className="text-[11.5px] text-[#adb5bd] hover:text-[#1a1a1a] shrink-0">outro link</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditandoPortal(true)} className="text-[12.5px] text-info font-semibold hover:underline">
                  + adicionar link do portal
                </button>
              )
            ) : (
              <div>
                <input autoFocus value={novoPortalLink} onChange={(e) => setNovoPortalLink(e.target.value)}
                  placeholder="https://..." className="input-padrao w-full mb-2 text-[12.5px]" />
                {conta.fornecedor_nome && (
                  <label className="flex items-center gap-2 mb-2.5">
                    <input type="checkbox" checked={salvarComoPadrao} onChange={(e) => setSalvarComoPadrao(e.target.checked)} className="w-3.5 h-3.5" />
                    <span className="text-[11.5px] text-[#6c757d]">Usar esse link pra todas as contas de {conta.fornecedor_nome}</span>
                  </label>
                )}
                <div className="flex gap-2">
                  <button onClick={salvarPortal} disabled={salvandoPortal || !novoPortalLink.trim()} className="btn-primario flex-1 disabled:opacity-50">
                    {salvandoPortal ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => { setEditandoPortal(false); setNovoPortalLink(portalLink ?? ""); }} className="btn-secundario">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <div className="pb-5 mb-5 border-b border-linha">
            {conta.status === "encerrado" ? (
              <div className="bg-alerr-bg rounded-md px-3 py-2.5">
                <div className="text-[12.5px] font-semibold text-alerr">Conta encerrada</div>
                <div className="text-[11.5px] text-[#7a3838] mt-0.5">
                  {conta.data_encerramento && `Válida até ${formatarDataSemFuso(conta.data_encerramento)}. `}
                  {conta.motivo_encerramento && `Motivo: ${conta.motivo_encerramento}`}
                </div>
                <button onClick={reativarConta} disabled={reativando}
                  className="mt-2.5 text-[12px] font-semibold text-ok border border-ok/30 bg-ok-bg rounded-md px-3 py-1.5 hover:bg-ok/10 transition disabled:opacity-50">
                  {reativando ? "Reativando..." : "Reativar conta"}
                </button>
              </div>
            ) : !encerrando ? (
              <div className="flex items-center gap-4">
                {negCriada ? (
                  <span className="text-[12px] font-semibold text-ok">✓ Negociação criada</span>
                ) : (
                  <button onClick={moverParaNegociacao} disabled={movendoNeg}
                    className="text-[12px] font-semibold text-amb hover:underline disabled:opacity-50">
                    {movendoNeg ? "Movendo..." : "Mover para Negociação"}
                  </button>
                )}
                <button onClick={abrirEncerramento} className="text-[12px] text-alerr font-semibold hover:underline">
                  Encerrar essa conta
                </button>
              </div>
            ) : (
              <div className="bg-off rounded-md p-3.5">
                <div className="text-[12.5px] font-semibold text-[#1a1a1a] mb-3">Encerrar conta</div>
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Data de encerramento *</div>
                  <input type="date" value={dataEncerrar} onChange={(e) => setDataEncerrar(e.target.value)} className="input-padrao w-full" />
                </label>
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Motivo (opcional)</div>
                  <input value={motivoEncerrar} onChange={(e) => setMotivoEncerrar(e.target.value)} placeholder="Ex: contrato cancelado" className="input-padrao w-full text-[12.5px]" />
                </label>
                {conta.fornecedor_nome && qtdContasFornecedor != null && qtdContasFornecedor > 1 && (
                  <label className="flex items-start gap-2 mb-3">
                    <input type="checkbox" checked={encerrarFornecedorTodo} onChange={(e) => setEncerrarFornecedorTodo(e.target.checked)} className="w-3.5 h-3.5 mt-0.5" />
                    <span className="text-[11.5px] text-[#6c757d]">
                      Encerrar também as outras <b>{qtdContasFornecedor - 1}</b> conta(s) ativa(s) de {conta.fornecedor_nome}, em todas as lojas
                    </span>
                  </label>
                )}
                {erroEncerramento && <div className="text-[11.5px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">{erroEncerramento}</div>}
                <div className="flex gap-2">
                  <button onClick={confirmarEncerramento} disabled={salvandoEncerramento}
                    className="flex-1 bg-alerr hover:bg-alerr-dark text-white rounded-md py-2 text-[12.5px] font-semibold disabled:opacity-50 transition-colors">
                    {salvandoEncerramento ? "Encerrando..." : encerrarFornecedorTodo ? `Encerrar ${qtdContasFornecedor} contas` : "Confirmar encerramento"}
                  </button>
                  <button onClick={() => setEncerrando(false)} className="btn-secundario">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {ehCompraNF && (
            <div className="pt-5 border-t border-linha mb-1">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[14px] font-semibold text-[#1a1a1a]">Dados da nota fiscal</div>
                <button onClick={() => { setEditandoNf((v) => !v); setNfNumero(conta.numero_nf ?? ""); setNfRemetenteCnpj(conta.remetente_cnpj ?? ""); setNfDestRazao(conta.destinatario_razao ?? ""); setNfDestCnpj(conta.destinatario_cnpj ?? ""); }}
                  className="text-amarelo text-[12px] font-semibold hover:underline">{editandoNf ? "Cancelar" : "Editar"}</button>
              </div>
              <p className="text-[11.5px] text-[#adb5bd] mb-3">Lidos automaticamente da NF. Ajuste aqui se a leitura vier errada.</p>
              {!editandoNf ? (
                <>
                <div className="grid grid-cols-2 gap-y-3.5 gap-x-3 mb-3">
                  <Campo label="Remetente" valor={conta.fornecedor_nome || "—"} />
                  <Campo label="CNPJ do remetente" valor={fmtCnpj(nfRemetenteCnpj || conta.remetente_cnpj)} mono />
                  <Campo label="Destinatário" valor={nfDestRazao || conta.destinatario_razao || "—"} />
                  <Campo label="CNPJ do destinatário" valor={fmtCnpj(nfDestCnpj || conta.destinatario_cnpj)} mono />
                </div>
                {conta.chave_acesso && (
                  <div className="mb-6">
                    <div className="text-[11px] text-[#adb5bd] font-medium mb-0.5">Chave de acesso</div>
                    <div className="text-[11px] font-mono text-[#1a1a1a] break-all">{conta.chave_acesso}</div>
                  </div>
                )}
                </>
              ) : (
                <div className="space-y-3 mb-6">
                  <label className="block">
                    <div className="text-[11px] text-[#adb5bd] font-medium mb-1">Nº da nota fiscal</div>
                    <input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} className="input-padrao w-full font-mono" />
                  </label>
                  <label className="block">
                    <div className="text-[11px] text-[#adb5bd] font-medium mb-1">CNPJ do remetente</div>
                    <input value={nfRemetenteCnpj} onChange={(e) => setNfRemetenteCnpj(e.target.value)} className="input-padrao w-full font-mono" />
                  </label>
                  <label className="block">
                    <div className="text-[11px] text-[#adb5bd] font-medium mb-1">Destinatário (razão social)</div>
                    <input value={nfDestRazao} onChange={(e) => setNfDestRazao(e.target.value)} className="input-padrao w-full" />
                  </label>
                  <label className="block">
                    <div className="text-[11px] text-[#adb5bd] font-medium mb-1">CNPJ do destinatário</div>
                    <input value={nfDestCnpj} onChange={(e) => setNfDestCnpj(e.target.value)} className="input-padrao w-full font-mono" />
                  </label>
                  <button onClick={salvarNf} disabled={salvandoNf} className="btn-primario disabled:opacity-50">
                    {salvandoNf ? "Salvando..." : "Salvar dados da NF"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className={`pt-5 border-t border-linha ${ehCompraNF ? "hidden" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-semibold text-[#1a1a1a]">Credenciais</div>
              <button onClick={() => { setEditandoCred((v) => !v); setNovoLogin(login ?? ""); setNovaSenha(""); }}
                className="text-amarelo text-[12px] font-semibold hover:underline">
                {editandoCred ? "Cancelar" : "Editar"}
              </button>
            </div>

            {!editandoCred ? (
              <div className="space-y-3">
                <Campo label="Usuário" valor={login ?? "não cadastrado"} mono />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">Senha</div>
                    <div className="text-[13px] font-semibold text-[#1a1a1a] font-mono">{senha ?? "•••••••••"}</div>
                  </div>
                  {!senha && (
                    <button onClick={revelar} disabled={revelando} className="text-[#adb5bd] hover:text-amarelo">
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.3" /></svg>
                    </button>
                  )}
                </div>
                {aviso && <div className="text-[11px] text-amb bg-amb-bg rounded-md px-3 py-2 leading-snug">{aviso}</div>}
              </div>
            ) : (
              <div className="space-y-3">
                <label>
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Usuário</div>
                  <input value={novoLogin} onChange={(e) => setNovoLogin(e.target.value)} className="input-padrao w-full font-mono" />
                </label>
                <label>
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Nova senha</div>
                  <input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="deixe em branco para manter" className="input-padrao w-full font-mono" />
                </label>
                <button onClick={salvarCredencial} disabled={salvandoCred} className="btn-primario w-full">
                  {salvandoCred ? "Salvando..." : "Salvar credencial"}
                </button>
              </div>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-linha">
            <div className="text-[14px] font-semibold text-[#1a1a1a] mb-3.5">Fatura de {formatarPeriodo(MES_ATUAL, ANO_ATUAL)}</div>

            {sucessoLancamento && (
              <div className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-ok bg-ok-bg border border-ok/25 rounded-md px-3 py-2.5">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M4 10.5l4 4 8-9" />
                </svg>
                {sucessoLancamento}
              </div>
            )}

            {lancamentoAtual && lancamentoAtual.situacao !== "pendente" && !lancando ? (
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[18px] font-bold text-[#1a1a1a]">{money(lancamentoAtual.valor)}</div>
                    <SituacaoBadgeInline situacao={lancamentoAtual.situacao} />
                    {/* estado do DOCUMENTO, separado do estado do dinheiro:
                        a conta pode estar aprovada e paga e o boleto ainda faltar */}
                    {ehZerada(lancamentoAtual.valor) && (
                      <span className="badge bg-info-bg text-info ml-2" title={(lancamentoAtual as any).motivo_zerado ?? undefined}>
                        R$ 0,00 · Conta zerada
                      </span>
                    )}
                    {(lancamentoAtual as any).sem_documento && (
                      (lancamentoAtual as any).documento_anexado_em ? (
                        <span className="badge bg-ok-bg text-ok ml-2">📎 Documento anexado</span>
                      ) : (
                        <span className="badge bg-amb-bg text-amb ml-2" title={(lancamentoAtual as any).motivo_sem_documento ?? undefined}>
                          ⚠️ Sem documento
                        </span>
                      )
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {lancamentoAtual.comprovante_url && (
                      <button onClick={() => verBoleto(lancamentoAtual.comprovante_url!)}
                        className="flex items-center gap-1.5 text-[12.5px] font-semibold text-info hover:underline">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></svg>
                        Ver boleto
                      </button>
                    )}
                    {lancamentoAtual.comprovante_drive_url && (
                      <a href={lancamentoAtual.comprovante_drive_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6c757d] hover:underline">
                        <svg width="14" height="14" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                          <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5C.4 49.9 0 51.45 0 53h27.5z" fill="#00ac47"/>
                          <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.3c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
                          <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                          <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                          <path d="M73.4 26.5L60.75 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                        Ver no Drive
                      </a>
                    )}
                  </div>
                </div>
                {lancamentoAtual.situacao === "contestado" && (
                  <div className="mt-3 bg-alerr-bg border border-alerr/30 rounded-md px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-alerr mb-0.5">Recusado — precisa de correção</div>
                    {(lancamentoAtual as any).motivo_recusa && (
                      <div className="text-[11.5px] text-[#7a3838] leading-snug">
                        Motivo: {(lancamentoAtual as any).motivo_recusa}
                      </div>
                    )}
                    <button onClick={reenviarParaAprovacao} disabled={reenviando}
                      className="mt-2.5 w-full bg-amarelo text-[#1a1a1a] rounded-md py-2 text-[12px] font-semibold disabled:opacity-50">
                      {reenviando ? "Reenviando..." : "Corrigi — reenviar para aprovação"}
                    </button>
                  </div>
                )}
                {(lancamentoAtual.situacao === "aprovado" || lancamentoAtual.situacao === "pago" || lancamentoAtual.situacao === "contestado") && (aprovadorNome || (lancamentoAtual as any).aprovado_em) && (
                  <div className="mt-3 pt-3 border-t border-linha2 text-[11.5px] text-[#6c757d]">
                    {lancamentoAtual.situacao === "contestado" ? "Recusado" : "Aprovado"} por <b className="text-[#1a1a1a]">{aprovadorNome ?? "—"}</b>
                    {(lancamentoAtual as any).aprovado_em && ` em ${new Date((lancamentoAtual as any).aprovado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                )}
                {/* linha do tempo do lançamento */}
                <div className="mt-3 pt-3 border-t border-linha2">
                  <button onClick={() => setVerHistorico((v) => !v)}
                    className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#6c757d] hover:text-info transition">
                    {verHistorico ? "Ocultar histórico" : "Ver histórico"}
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"
                      style={{ transform: verHistorico ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
                      <path d="M5 8l5 5 5-5" />
                    </svg>
                  </button>

                  {verHistorico && (
                    <div className="mt-3">
                      {historico === null && <div className="text-[12px] text-[#adb5bd]">Carregando...</div>}
                      {historico?.length === 0 && (
                        <div className="text-[12px] text-[#adb5bd]">Sem registros anteriores para este lançamento.</div>
                      )}
                      <div className="relative pl-4">
                        {(historico?.length ?? 0) > 0 && <span className="absolute left-[4px] top-1.5 bottom-1.5 w-px bg-linha2" />}
                        {(historico ?? []).map((h, i) => {
                          const cor = h.para === "aprovado" ? "#2E7D32"
                            : h.para === "contestado" ? "#D32F2F"
                            : h.para === "pago" ? "#2A74C4"
                            : h.para === "cancelado" ? "#8A8A8A" : "#E6A600";
                          const rotulo = SITUACAO[h.para]?.label ?? h.para;
                          return (
                            <div key={i} className="relative pb-2.5 last:pb-0">
                              <span className="absolute -left-4 top-1 w-[9px] h-[9px] rounded-full border-2 border-white"
                                style={{ background: cor, boxShadow: "0 0 0 1.5px #e9ecef" }} />
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="text-[12px] font-semibold" style={{ color: cor }}>{rotulo}</span>
                                {h.nome && <span className="text-[11.5px] text-[#495057]">por {h.nome}</span>}
                                <span className="text-[10.5px] text-[#adb5bd] font-mono ml-auto">
                                  {new Date(h.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              {h.comentario && (
                                <div className="text-[11px] text-[#6c757d] leading-snug mt-0.5">{h.comentario}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ajuste manual de status (admin/gestor) */}
                <div className="mt-3 pt-3 border-t border-linha2">
                  {!ajustandoStatus ? (
                    <button onClick={() => { setAjustandoStatus(true); setNovoStatus(lancamentoAtual.situacao); }}
                      className="w-full text-[12px] font-semibold text-[#6c757d] hover:text-info transition text-center">
                      Ajustar status
                    </button>
                  ) : (
                    <div>
                      <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1.5">Ajustar status</div>
                      <div className="space-y-1 mb-2.5">
                        {STATUS_AJUSTE.map((op) => (
                          <label key={op.valor} className="flex items-start gap-2 text-[12.5px] cursor-pointer rounded px-1.5 py-1 hover:bg-off">
                            <input type="radio" name="ajuste-status" className="mt-0.5" checked={novoStatus === op.valor}
                              onChange={() => setNovoStatus(op.valor)} />
                            <span>
                              <b className="font-medium">{op.rotulo}</b>
                              <span className="block text-[10.5px] text-[#adb5bd]">{op.ajuda}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      {novoStatus === "lancado" && (
                        <div className="text-[11px] text-info bg-info-bg rounded-md px-2 py-1.5 mb-2.5">
                          A conta sai das aprovadas, volta para a fila de Aprovações e avisa o Slack.
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={aplicarAjusteStatus} disabled={salvandoStatus || novoStatus === lancamentoAtual.situacao}
                          className="btn-primario flex-1 disabled:opacity-50">
                          {salvandoStatus ? "Ajustando..." : "Aplicar"}
                        </button>
                        <button onClick={() => { setAjustandoStatus(false); setNovoStatus(""); }} className="btn-secundario">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => { setValorLancar(String(lancamentoAtual.valor ?? "")); setAlertas([]); setConfirmarMesmoAssim(false); setCodigoBarras(""); setHashArquivo(null); setBloqueio(null); setLancando(true); }}
                  className="w-full mt-3 pt-3 border-t border-linha2 text-[12px] font-semibold text-[#6c757d] hover:text-amb transition text-center">
                  Boleto errado? Substituir
                </button>
              </div>
            ) : semDoc ? (
              <div className="card p-4">
                <div className="text-[12.5px] font-semibold text-[#1a1a1a] mb-1">Lançar conta sem documento</div>
                <p className="text-[11.5px] text-[#6c757d] mb-3 leading-relaxed">
                  A conta segue normalmente para aprovação e pagamento. Fica marcada como sem documento
                  até alguém anexar o boleto, e o time é avisado no Slack.
                </p>

                {/* o que já se sabe da conta: confere antes de lançar às cegas */}
                <div className="grid grid-cols-2 gap-3 mb-3 bg-off rounded-md p-3">
                  <Campo label="Loja" valor={conta.lojas?.codigo ?? "—"} />
                  <Campo label="Fornecedor" valor={conta.fornecedor_nome ?? "—"} />
                  <Campo label={CAMPOS_TIPO[conta.tipo]?.labelIdentificador ?? "Instalação"}
                    valor={conta.insc_cod_mat ?? conta.identificador ?? "—"} />
                  <Campo label="Competência" valor={`${String(MES_ATUAL).padStart(2, "0")}/${ANO_ATUAL}`} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="block">
                    <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Valor</div>
                    <input value={valorLancar} onChange={(e) => setValorLancar(e.target.value)}
                      placeholder="0,00" className="input-padrao w-full font-mono" />
                  </label>
                  <label className="block">
                    <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Vencimento</div>
                    <input type="date" value={vencSemDoc} onChange={(e) => setVencSemDoc(e.target.value)}
                      className="input-padrao w-full" />
                  </label>
                </div>


                {/* Zero é valor informado, não campo vazio — mas exige explicação. */}
                {ehZerada(lerValorDigitado(valorLancar).valor) && (
                  <div className="border border-amarelo/40 bg-amb-bg rounded-md p-3 mb-3">
                    <div className="text-[11.5px] font-semibold text-amb mb-2">Conta zerada — por que não houve cobrança? <span className="text-alerr">*</span></div>
                    <select value={motivoZerado} onChange={(e) => setMotivoZerado(e.target.value)}
                      className="input-padrao w-full text-[12.5px] mb-2">
                      <option value="">Selecione o motivo...</option>
                      {MOTIVOS_ZERADO.map((m) => (<option key={m.valor} value={m.valor}>{m.rotulo}</option>))}
                    </select>
                    {motivoZerado === "outro" && (
                      <input value={motivoZeradoOutro} onChange={(e) => setMotivoZeradoOutro(e.target.value)}
                        placeholder="Descreva o motivo" className="input-padrao w-full text-[12.5px]" />
                    )}
                  </div>
                )}
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">
                    Motivo do lançamento sem documento <span className="text-alerr">*</span>
                  </div>
                  <select value={motivoSemDoc} onChange={(e) => setMotivoSemDoc(e.target.value)}
                    className="input-padrao w-full text-[12.5px]">
                    <option value="">Selecione o motivo...</option>
                    {MOTIVOS_SEM_DOCUMENTO.map((m) => (
                      <option key={m.valor} value={m.valor}>{m.rotulo}</option>
                    ))}
                  </select>
                </label>

                {motivoSemDoc === "outro" && (
                  <label className="block mb-3">
                    <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Qual o motivo? <span className="text-alerr">*</span></div>
                    <input value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)}
                      placeholder="Descreva por que está lançando sem o documento"
                      className="input-padrao w-full text-[12.5px]" />
                  </label>
                )}

                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Observação</div>
                  <textarea value={obsSemDoc} onChange={(e) => setObsSemDoc(e.target.value)} rows={2}
                    placeholder="opcional" className="input-padrao w-full text-[12.5px]" />
                </label>

                {erroSemDoc && <div className="text-[11.5px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">{erroSemDoc}</div>}

                <div className="flex gap-2">
                  <button onClick={lancarSemDocumento} disabled={salvandoSemDoc}
                    className="btn-primario flex-1 disabled:opacity-50">
                    {salvandoSemDoc ? "Lançando..." : "Lançar sem documento"}
                  </button>
                  <button onClick={() => { setSemDoc(false); setErroSemDoc(null); }} className="btn-secundario">Cancelar</button>
                </div>
              </div>
            ) : !lancando ? (
              contaValidaNoPeriodo(conta.status, conta.data_encerramento, ANO_ATUAL, MES_ATUAL) ? (
                <>
                <button onClick={() => { setValorLancar(lancamentoAtual ? String(lancamentoAtual.valor ?? "") : ""); setAlertas([]); setConfirmarMesmoAssim(false); setCodigoBarras(""); setHashArquivo(null); setBloqueio(null); setLancando(true); }}
                  className="w-full text-[12.5px] font-semibold text-amb border border-amarelo/40 bg-amb-bg rounded-md py-2.5 hover:bg-amarelo/10 transition">
                  {lancamentoAtual ? `Lançar fatura de ${formatarPeriodo(MES_ATUAL, ANO_ATUAL).toLowerCase()}` : `Lançar fatura de ${formatarPeriodo(MES_ATUAL, ANO_ATUAL).toLowerCase()} (sem lançamento pendente ainda)`}
                </button>
                <button onClick={() => { setValorLancar(lancamentoAtual ? String(lancamentoAtual.valor ?? "") : ""); setMotivoSemDoc(""); setMotivoOutro(""); setObsSemDoc(""); setVencSemDoc(""); setErroSemDoc(null); setSemDoc(true); }}
                  className="w-full mt-2 text-[12px] font-medium text-[#6c757d] border border-linha rounded-md py-2 hover:border-txt-3 hover:text-txt transition">
                  Lançar conta sem documento
                </button>
                </>
              ) : (
                <div className="text-center text-[12px] text-[#adb5bd] bg-off rounded-md py-2.5 px-3">
                  Essa conta foi encerrada em {conta.data_encerramento && formatarDataSemFuso(conta.data_encerramento)} - não é possível lançar depois desse período.
                </div>
              )
            ) : (
              <div className="card p-4">
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Valor da fatura</div>
                  <input value={valorLancar} onChange={(e) => setValorLancar(e.target.value)}
                    onBlur={() => rodarVerificacoes({ codigo: codigoBarras, valor: Number(valorLancar.replace(",", ".")) || null })}
                    placeholder="0,00" className="input-padrao w-full font-mono" />
                </label>

                {/* Zero é valor informado, não campo vazio — mas exige explicação. */}
                {ehZerada(lerValorDigitado(valorLancar).valor) && (
                  <div className="border border-amarelo/40 bg-amb-bg rounded-md p-3 mb-3">
                    <div className="text-[11.5px] font-semibold text-amb mb-2">Conta zerada — por que não houve cobrança? <span className="text-alerr">*</span></div>
                    <select value={motivoZerado} onChange={(e) => setMotivoZerado(e.target.value)}
                      className="input-padrao w-full text-[12.5px] mb-2">
                      <option value="">Selecione o motivo...</option>
                      {MOTIVOS_ZERADO.map((m) => (<option key={m.valor} value={m.valor}>{m.rotulo}</option>))}
                    </select>
                    {motivoZerado === "outro" && (
                      <input value={motivoZeradoOutro} onChange={(e) => setMotivoZeradoOutro(e.target.value)}
                        placeholder="Descreva o motivo" className="input-padrao w-full text-[12.5px]" />
                    )}
                  </div>
                )}
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Boleto (PDF ou imagem)</div>
                  <input type="file" accept=".pdf,image/*" onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
                    className="w-full text-[12.5px] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#f1f3f5] file:text-[12px] file:font-medium" />
                </label>
                {extraindo && (
                  <div className="text-[11.5px] text-info bg-info-bg rounded-md px-3 py-2 mb-3 flex items-center gap-2">
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3a7 7 0 107 7" strokeLinecap="round" /></svg>
                    Lendo o boleto automaticamente...
                  </div>
                )}
                {avisoExtracao && <div className="text-[11.5px] text-[#adb5bd] mb-3">{avisoExtracao}</div>}
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Código de barras (linha digitável)</div>
                  <div className="flex gap-1.5">
                    <input value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)}
                      onBlur={() => rodarVerificacoes({ codigo: codigoBarras, valor: Number(valorLancar.replace(",", ".")) || null })}
                      placeholder="Preenche sozinho se conseguir ler do boleto"
                      className="input-padrao w-full font-mono text-[11.5px]" />
                    {codigoBarras && (
                      <button type="button" onClick={() => navigator.clipboard.writeText(codigoBarras)}
                        className="shrink-0 px-3 rounded-md border border-linha text-[11px] font-semibold text-[#6c757d] hover:bg-off">
                        Copiar
                      </button>
                    )}
                  </div>
                </label>
                <label className="flex items-center gap-2 mb-3">
                  <input type="checkbox" checked={enviarDrive} onChange={(e) => setEnviarDrive(e.target.checked)}
                    disabled={!arquivoBoleto} className="w-4 h-4" />
                  <span className="text-[12.5px] text-[#6c757d]">Enviar cópia também para o Google Drive</span>
                </label>
                <div className="text-[10.5px] text-[#adb5bd] mb-3 leading-snug">
                  Baixado do portal do fornecedor. Depois de lançar, a conta entra na fila de Aprovações.
                </div>

                {verificando && <div className="text-[11px] text-[#adb5bd] mb-3">Verificando duplicidade e histórico...</div>}

                {bloqueio && (
                  <div className="bg-alerr-bg border border-alerr/35 rounded-md px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#B23B3B" strokeWidth="1.8"><path d="M10.9 3.6l7.6 13a1 1 0 01-.9 1.5H2.4a1 1 0 01-.9-1.5l7.6-13a1 1 0 011.8 0z" /><path d="M10 8.5v4" /></svg>
                      <b className="text-[11.5px] font-semibold text-alerr">Boleto duplicado — lançamento bloqueado</b>
                    </div>
                    <div className="text-[11.5px] text-[#7a3838] leading-snug whitespace-pre-line">{bloqueio}</div>
                  </div>
                )}

                {alertas.length > 0 && (
                  <div className="bg-amb-bg border border-amarelo/40 rounded-md px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#B8860B" strokeWidth="1.8"><path d="M10.9 3.6l7.6 13a1 1 0 01-.9 1.5H2.4a1 1 0 01-.9-1.5l7.6-13a1 1 0 011.8 0z" /><path d="M10 8.5v4" /></svg>
                      <b className="text-[11.5px] font-semibold text-[#7a5c00]">Antes de lançar, confere isso:</b>
                    </div>
                    <ul className="text-[11.5px] text-[#7a5c00] space-y-1 mb-2.5 list-disc list-inside">
                      {alertas.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={confirmarMesmoAssim} onChange={(e) => setConfirmarMesmoAssim(e.target.checked)} className="w-4 h-4" />
                      <span className="text-[11.5px] font-semibold text-[#7a5c00]">Já conferi, quero lançar mesmo assim</span>
                    </label>
                  </div>
                )}

                {erroLancamento && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">{erroLancamento}</div>}
                <div className="flex gap-2">
                  <button onClick={lancarComBoleto} disabled={salvandoLancamento || bloqueio != null || (alertas.length > 0 && !confirmarMesmoAssim)}
                    className="btn-primario flex-1 disabled:opacity-50">
                    {salvandoLancamento ? "Enviando..." : "Lançar"}
                  </button>
                  <button onClick={() => { setLancando(false); setErroLancamento(null); }} className="btn-secundario">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-linha">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-semibold text-[#1a1a1a]">{ehCompraNF ? "Compras da loja por mês (R$)" : "Histórico mensal (R$)"}</div>
              <span className="text-[12px] text-[#6c757d]">Últimos 12 meses</span>
            </div>
            {(ehCompraNF ? !temHistoricoCompra : valores.length === 0) ? (
              <div className="h-[140px] flex flex-col items-center justify-center text-center gap-1 rounded-md bg-[#f8f9fa] border border-dashed border-linha">
                <span className="text-[12.5px] font-semibold text-[#6c757d]">Sem histórico ainda</span>
                <span className="text-[11px] text-[#adb5bd]">{ehCompraNF ? "As compras desta loja aparecem aqui." : "Os lançamentos desta conta aparecem aqui."}</span>
              </div>
            ) : (
              <div className="flex items-stretch gap-1 h-[140px]">
                {Array.from({ length: 12 }).map((_, mi) => {
                  const v = ehCompraNF
                    ? (comprasPorMes[mi] > 0 ? comprasPorMes[mi] : null)
                    : (() => { const l = lancs.find((x) => x.mes === mi + 1); return l?.valor != null ? Number(l.valor) : null; })();
                  const teto = ehCompraNF ? maxCompra : maxv;
                  const h = v != null ? Math.max((v / teto) * 100, 3) : 3;
                  const ativo = mesHover === mi;
                  return (
                    <div key={mi} className="flex-1 flex flex-col relative"
                      onMouseEnter={() => setMesHover(mi)} onMouseLeave={() => setMesHover(null)}>
                      {ativo && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap rounded-md bg-white border border-linha shadow-lg px-2.5 py-1.5 pointer-events-none">
                          <div className="text-[10px] text-[#adb5bd]">{MES[mi]}/{ANO_ATUAL}</div>
                          <div className="text-[12px] font-semibold" style={{ color: v != null ? "#B8860B" : "#adb5bd" }}>
                            {v != null ? money(v) : ehCompraNF ? "Sem compras" : "Sem lançamento"}
                          </div>
                        </div>
                      )}
                      <div className="flex-1 flex items-end">
                        <div className="w-full rounded-t-sm transition-all" style={{ height: `${h}%`, background: v == null ? "#f1f3f5" : ativo ? "#E0A800" : "#FFC107" }} />
                      </div>
                      <span className="text-[9px] font-mono text-center mt-1.5" style={{ color: ativo ? "#B8860B" : "#adb5bd" }}>{MES[mi][0]}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {ehCompraNF && temHistoricoCompra && (
              <div className="mt-5">
                <div className="text-[12px] font-semibold text-[#6c757d] mb-2">Compras da loja</div>
                <div className="border border-linha rounded-lg divide-y divide-linha2 max-h-[220px] overflow-auto">
                  {(comprasLoja ?? []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-[#1a1a1a] truncate">{c.fornecedor_nome || "—"}</div>
                        <div className="text-[10.5px] text-[#adb5bd]">
                          {c.dia ? String(c.dia).padStart(2, "0") + "/" : ""}{String(c.mes).padStart(2, "0")}/{c.ano}
                          {c.chamado_numero ? ` · #${c.chamado_numero}` : ""}{c.numero_nf ? ` · NF ${c.numero_nf}` : ""}
                        </div>
                      </div>
                      <div className="text-[12.5px] font-semibold text-[#1a1a1a] shrink-0">{c.valor != null ? money(Number(c.valor)) : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={baixarExtrato} className="btn-secundario w-full mt-6 flex items-center justify-center gap-2">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3v10m0 0l-4-4m4 4l4-4" /><path d="M3.5 15v2a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-2" /></svg>
            Baixar extrato da conta
          </button>
        </div>
      </aside>
    </>
  );
}

function StatusBadgeDrawer({ status }: { status: string }) {
  if (status === "encerrado") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  if (status === "inativo") return <span className="badge bg-[#f1f3f5] text-[#adb5bd]">Inativa</span>;
  return <span className="badge bg-ok-bg text-ok">Ativa</span>;
}

function Campo({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">{label}</div>
      <div className={`text-[13px] font-semibold text-[#1a1a1a] ${mono ? "font-mono !font-normal" : ""}`}>{valor}</div>
    </div>
  );
}

const ICONES_CAMPO: Record<string, React.ReactNode> = {
  fornecedor: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/></svg>,
  calendario: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  tag: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/></svg>,
  documento: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  globo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
};

function CampoIcone({ icone, label, valor, mono }: { icone: React.ReactNode; label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[#FFF6E0] text-amb flex items-center justify-center shrink-0 mt-0.5">{icone}</div>
      <div className="min-w-0">
        <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">{label}</div>
        <div className={`text-[13px] font-semibold text-[#1a1a1a] break-words ${mono ? "font-mono !font-normal" : ""}`}>{valor}</div>
      </div>
    </div>
  );
}

function NovaContaDrawer({ lojas, onClose }: { lojas: { id: string; codigo: string }[]; onClose: () => void }) {
  const router = useRouter();
  const { state, updateField, isLoading, error, salvar } = useContaForm(lojas[0]?.id ?? "");
  const [buscaLoja, setBuscaLoja] = useState("");
  const [abertoLoja, setAbertoLoja] = useState(false);
  const lojaSel = lojas.find((l) => l.id === state.lojaId);
  const lojasFiltradas = (buscaLoja.trim()
    ? lojas.filter((l) => l.codigo.toLowerCase().includes(buscaLoja.toLowerCase()))
    : lojas).slice(0, 50);

  async function handleSalvar() {
    const resultado = await salvar();
    if (resultado) {
      // atualiza os dados da página sem recarregar o navegador inteiro
      router.refresh();
      onClose();
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[380px] max-w-[94vw] bg-white border-l border-linha z-50 overflow-y-auto">
        <div className="relative px-5 py-5 border-b border-linha">
          <span className="absolute left-0 right-0 top-0 h-1 bg-amarelo" />
          <button onClick={onClose} className="absolute right-5 top-5 text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <h3 className="text-[20px] font-bold text-[#1a1a1a]">Nova conta</h3>
        </div>
        <div className="p-5 space-y-3.5">
          <div className="relative">
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Loja</div>
            <input
              value={abertoLoja ? buscaLoja : (lojaSel?.codigo ?? "")}
              onFocus={() => { setAbertoLoja(true); setBuscaLoja(""); }}
              onChange={(e) => setBuscaLoja(e.target.value)}
              placeholder="Buscar loja..."
              className="input-padrao w-full"
            />
            {abertoLoja && (
              <div className="absolute z-30 top-full left-0 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-linha rounded-md shadow-media">
                {lojasFiltradas.map((l) => (
                  <button key={l.id} type="button" onClick={() => { updateField("lojaId", l.id); setAbertoLoja(false); }}
                    className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-off">{l.codigo}</button>
                ))}
                {lojasFiltradas.length === 0 && <div className="px-3 py-1.5 text-[12px] text-[#adb5bd]">Nenhuma loja encontrada.</div>}
                <button type="button" onClick={() => setAbertoLoja(false)} className="block w-full text-left px-3 py-1.5 text-[11px] text-[#adb5bd] border-t border-linha2 hover:bg-off">Fechar</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Tipo</div>
              <select value={state.tipo} onChange={(e) => updateField("tipo", e.target.value)} className="input-padrao w-full">
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
              </select>
            </label>
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Origem</div>
              <select value={state.origem} onChange={(e) => updateField("origem", e.target.value)} className="input-padrao w-full">
                {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Fornecedor</div>
            <input value={state.fornecedor} onChange={(e) => updateField("fornecedor", e.target.value)} placeholder={CAMPOS_TIPO[state.tipo]?.placeholderFornecedor} className="input-padrao w-full" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">{CAMPOS_TIPO[state.tipo]?.labelIdentificador ?? "Identificador"}</div>
              <input value={state.identificador} onChange={(e) => updateField("identificador", e.target.value)} placeholder={CAMPOS_TIPO[state.tipo]?.placeholderIdentificador} className="input-padrao w-full font-mono" />
            </label>
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Vencimento</div>
              <input value={state.vencimento} onChange={(e) => updateField("vencimento", e.target.value)} placeholder="1-31" className="input-padrao w-full" />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={state.ehRateio} onChange={(e) => updateField("ehRateio", e.target.checked)} className="w-4 h-4" />
            <span className="text-[12.5px] text-txt-2">É rateio</span>
            {state.ehRateio && (
              <input value={state.rateioDivisor} onChange={(e) => updateField("rateioDivisor", e.target.value)} placeholder="/2"
                className="w-16 border border-linha rounded-md px-2 py-1.5 text-[12.5px] ml-1" />
            )}
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Login do portal</div>
            <input value={state.login} onChange={(e) => updateField("login", e.target.value)} className="input-padrao w-full font-mono" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Senha do portal</div>
            <input value={state.senha} onChange={(e) => updateField("senha", e.target.value)} className="input-padrao w-full font-mono" />
          </label>
          <div className="text-[10.5px] text-[#adb5bd] leading-snug">A senha vai direto para o cofre criptografado.</div>
          {error && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{error}</div>}
          <button onClick={handleSalvar} disabled={isLoading} className="btn-primario w-full">
            {isLoading ? "Salvando..." : "Criar conta"}
          </button>
        </div>
      </aside>
    </>
  );
}

function SituacaoBadgeInline({ situacao }: { situacao: string }) {
  const s = SITUACAO[situacao] ?? { label: situacao, cls: "bg-[#f1f3f5] text-[#adb5bd]" };
  return <span className={`badge mt-1 ${s.cls}`}>{s.label}</span>;
}
