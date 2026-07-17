"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIPOS, ORIGENS, SITUACAO, type Conta, type Lancamento } from "@/lib/types";
import { CAMPOS_TIPO } from "@/lib/campos-tipo";
import { useContaForm } from "@/lib/hooks/useContaForm";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { formatarPeriodo, contaValidaNoPeriodo } from "@/lib/date-utils";
import TipoIcon from "@/components/tipo-icon";
import { money, MES, nomeArquivoSeguro, formatarDataSemFuso } from "@/lib/format";

function StatusBadge({ status }: { status: string }) {
  if (status === "encerrado") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  if (status === "inativo") return <span className="badge bg-[#f1f3f5] text-[#adb5bd]">Inativa</span>;
  return <span className="badge bg-ok-bg text-ok">Ativa</span>;
}

function VencimentoCell({ contaId, dia, ano, mes }: { contaId: string; dia: number | null; ano: number; mes: number }) {
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
  if (diff < 0) { label = "Atrasada"; cor = "text-alerr"; }
  else if (diff === 0) { label = "Hoje"; cor = "text-alerr"; }
  else if (diff === 1) { label = "Amanhã"; cor = "text-amb"; }
  else if (diff <= 7) { label = `${diff} dias`; cor = "text-amb"; }
  else { label = `${diff} dias`; cor = "text-ok"; }

  return (
    <button onClick={(e) => { e.stopPropagation(); setEditando(true); }} className="flex items-center gap-2 group/venc text-left">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${diff < 0 || diff === 0 ? "bg-alerr" : diff <= 7 ? "bg-amb" : "bg-ok"}`} />
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

function FornecedorCell({ contaId, nome }: { contaId: string; nome: string | null }) {
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
    <button onClick={(e) => { e.stopPropagation(); setEditando(true); }} className="text-left hover:opacity-70 transition">
      {nome ?? "—"}
    </button>
  );
}

export default function ContasClient({ contas, situacaoPorConta, lojas, ano, mes }: {
  contas: Conta[]; situacaoPorConta: Record<string, string>; lojas: { id: string; codigo: string }[]; ano: number; mes: number;
}) {
  const params = useSearchParams();
  const [fTipo, setFTipo] = useState<string>(params.get("tipo") ?? "todos");
  const [fCoban, setFCoban] = useState("todos");
  const [fStatus, setFStatus] = useState(params.get("status") ?? "todos");
  const [fSituacao, setFSituacao] = useState(params.get("situacao") ?? "todos");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 250);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);
  const [aberta, setAberta] = useState<Conta | null>(null);
  const [criando, setCriando] = useState(false);

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
      const st = fStatus === "todos" || c.status === fStatus;
      const si = fSituacao === "todos" || (situacaoPorConta[c.id] ?? "pendente") === fSituacao;
      const q =
        buscaDebounced === "" ||
        (c.lojas?.codigo ?? "").toLowerCase().includes(buscaDebounced.toLowerCase()) ||
        (c.fornecedor_nome ?? "").toLowerCase().includes(buscaDebounced.toLowerCase());
      return t && cb && st && si && q;
    });
  }, [contas, fTipo, fCoban, fStatus, fSituacao, buscaDebounced, situacaoPorConta]);

  useEffect(() => { setPagina(1); }, [fTipo, fCoban, fStatus, fSituacao, buscaDebounced]);

  const totalPaginas = Math.max(Math.ceil(filtradas.length / itensPorPagina), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const visiveis = filtradas.slice(inicio, inicio + itensPorPagina);

  const limparFiltros = () => { setFTipo("todos"); setFCoban("todos"); setFStatus("todos"); setFSituacao("todos"); setBusca(""); };
  const temFiltro = fTipo !== "todos" || fCoban !== "todos" || fStatus !== "todos" || fSituacao !== "todos" || busca !== "";
  const chips = ["todos", ...Object.keys(TIPOS)];

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
            <option value="pendente">Em aberto</option><option value="lancado">Aguardando pagamento</option><option value="pago">Pagas</option>
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
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              {["Loja", "Tipo", "Fornecedor", "Venc.", "Origem", "Status", ""].map((h) => (
                <th key={h} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr key={c.id} onClick={() => setAberta(c)} className="h-14 cursor-pointer border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa] transition group relative">
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
                  <FornecedorCell contaId={c.id} nome={c.fornecedor_nome} />
                  {c.eh_rateio && <span className="text-[10px] font-mono text-amb border border-amarelo rounded px-1 ml-1.5">RATEIO</span>}
                </td>
                <td className="px-4"><VencimentoCell contaId={c.id} dia={c.dia_vencimento} ano={ano} mes={mes} /></td>
                <td className="px-4 text-[13px]"><OrigemCell contaId={c.id} origem={c.origem} /></td>
                <td className="px-4 text-[13px]"><StatusBadge status={c.status} /></td>
                <td className="px-4 text-right">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6" className="inline group-hover:stroke-amarelo"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="text-center py-14 text-[#adb5bd]">Nenhuma conta com esses filtros.</td></tr>
            )}
          </tbody>
        </table></div>

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

      {aberta && <ContaDrawer conta={aberta} onClose={() => setAberta(null)} ano={ano} mes={mes} />}
      {criando && <NovaContaDrawer lojas={lojas} onClose={() => setCriando(false)} />}
    </>
  );
}

function ContaDrawer({ conta, onClose, ano: ANO_ATUAL, mes: MES_ATUAL }: { conta: Conta; onClose: () => void; ano: number; mes: number }) {
  const supabase = createClient();
  const router = useRouter();
  const T = TIPOS[conta.tipo];
  const [lancs, setLancs] = useState<Lancamento[]>([]);
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
  const [encerrando, setEncerrando] = useState(false);
  const [dataEncerrar, setDataEncerrar] = useState("");
  const [motivoEncerrar, setMotivoEncerrar] = useState("");
  const [encerrarFornecedorTodo, setEncerrarFornecedorTodo] = useState(false);
  const [qtdContasFornecedor, setQtdContasFornecedor] = useState<number | null>(null);
  const [salvandoEncerramento, setSalvandoEncerramento] = useState(false);
  const [erroEncerramento, setErroEncerramento] = useState<string | null>(null);

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

  async function confirmarEncerramento() {
    if (!dataEncerrar) { setErroEncerramento("Informe a data de encerramento."); return; }
    setSalvandoEncerramento(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      status: "encerrado",
      data_encerramento: dataEncerrar,
      motivo_encerramento: motivoEncerrar.trim() || null,
      encerrada_por: user?.id ?? null,
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
    onClose();
    router.refresh();
  }
  const [lancando, setLancando] = useState(false);
  const [valorLancar, setValorLancar] = useState("");
  const [arquivoBoleto, setArquivoBoleto] = useState<File | null>(null);
  const [hashArquivo, setHashArquivo] = useState<string | null>(null);
  const [enviarDrive, setEnviarDrive] = useState(false);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [avisoExtracao, setAvisoExtracao] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [confirmarMesmoAssim, setConfirmarMesmoAssim] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);
  const [erroLancamento, setErroLancamento] = useState<string | null>(null);

  // ano/mes agora vêm por props (período selecionado no topo do sistema),
  // não mais calculado aqui dentro - assim a ficha respeita o mês que a
  // pessoa está navegando, não sempre o mês real atual.

  const [aprovadorNome, setAprovadorNome] = useState<string | null>(null);

  function carregarLancamentos() {
    supabase.from("lancamentos").select("id, ano, mes, valor, situacao, comprovante_url, comprovante_drive_url, aprovado_por, aprovado_em")
      .eq("conta_id", conta.id).eq("ano", ANO_ATUAL)
      .then(({ data }) => setLancs((data ?? []) as Lancamento[]));
  }

  useEffect(() => {
    carregarLancamentos();
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

    // regra 1: mesmo código de barras já lançado em outro lugar (duplicidade real)
    const codigoLimpo = params.codigo?.replace(/\D/g, "") ?? "";
    if (codigoLimpo.length >= 40) {
      const { data: duplicados } = await supabase
        .from("lancamentos")
        .select("id, mes, ano, contas!inner ( lojas ( codigo ) )")
        .eq("codigo_barras", params.codigo)
        .neq("id", lancamentoAtual?.id ?? "00000000-0000-0000-0000-000000000000");
      const outro = (duplicados ?? [])[0] as any;
      if (outro) {
        novosAlertas.push(`Esse código de barras já foi lançado antes: ${outro.contas?.lojas?.codigo ?? "outra conta"} (${outro.mes}/${outro.ano}). Confere se não é o mesmo boleto duplicado.`);
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

  async function lancarComBoleto() {
    if (!valorLancar.trim()) { setErroLancamento("Informe o valor da fatura."); return; }
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
      valor: Number(valorLancar.replace(",", ".")),
      situacao: "lancado", comprovante_url: caminhoBoleto,
      lancado_em: new Date().toISOString(),
      codigo_barras: codigoBarras.trim() || null,
      arquivo_hash: hashArquivo,
    };
    if (linkDrive) payload.comprovante_drive_url = linkDrive;
    const { error } = await supabase.from("lancamentos").upsert(payload, { onConflict: "conta_id,ano,mes" });
    setSalvandoLancamento(false);
    if (error) { setErroLancamento("Não foi possível salvar o lançamento."); return; }
    setLancando(false);
    setValorLancar("");
    setArquivoBoleto(null);
    // a conta acabou de sair de "a lançar" e entrou na fila de aprovação -
    // faz sentido a tela já te levar pra lá, em vez de deixar preso em Contas.
    onClose();
    router.push("/aprovacoes");
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
          <div className="text-[14px] font-semibold text-[#1a1a1a] mb-4">Detalhes da conta</div>
          <div className="grid grid-cols-2 gap-y-3.5 mb-6">
            <Campo label="Fornecedor" valor={conta.fornecedor_nome ?? "—"} />
            <Campo label="Vencimento" valor={conta.dia_vencimento ? `dia ${conta.dia_vencimento}` : "—"} />
            <Campo label={CAMPOS_TIPO[conta.tipo]?.labelIdentificador ?? "Código da conta"} valor={conta.identificador ?? "—"} mono />
            <Campo label="Origem" valor={ORIGENS[conta.origem]} />
          </div>

          <div className="pb-5 mb-5 border-b border-linha">
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
              </div>
            ) : !encerrando ? (
              <button onClick={abrirEncerramento} className="text-[12px] text-alerr font-semibold hover:underline">
                Encerrar essa conta
              </button>
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

          <div className="pt-5 border-t border-linha">
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

            {lancamentoAtual && lancamentoAtual.situacao !== "pendente" && !lancando ? (
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[18px] font-bold text-[#1a1a1a]">{money(lancamentoAtual.valor)}</div>
                    <SituacaoBadgeInline situacao={lancamentoAtual.situacao} />
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
                        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2l6 10.5H2.5L8 2z" /><path d="M9 12.5l3 5.5h6l-3-5.5" /><path d="M12 2l6 10.5-3 5.5" /></svg>
                        Ver no Drive
                      </a>
                    )}
                  </div>
                </div>
                {(lancamentoAtual.situacao === "aprovado" || lancamentoAtual.situacao === "pago" || lancamentoAtual.situacao === "contestado") && (aprovadorNome || (lancamentoAtual as any).aprovado_em) && (
                  <div className="mt-3 pt-3 border-t border-linha2 text-[11.5px] text-[#6c757d]">
                    {lancamentoAtual.situacao === "contestado" ? "Recusado" : "Aprovado"} por <b className="text-[#1a1a1a]">{aprovadorNome ?? "—"}</b>
                    {(lancamentoAtual as any).aprovado_em && ` em ${new Date((lancamentoAtual as any).aprovado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                )}
                <button onClick={() => { setValorLancar(String(lancamentoAtual.valor ?? "")); setAlertas([]); setConfirmarMesmoAssim(false); setCodigoBarras(""); setHashArquivo(null); setLancando(true); }}
                  className="w-full mt-3 pt-3 border-t border-linha2 text-[12px] font-semibold text-[#6c757d] hover:text-amb transition text-center">
                  Boleto errado? Substituir
                </button>
              </div>
            ) : !lancando ? (
              contaValidaNoPeriodo(conta.status, conta.data_encerramento, ANO_ATUAL, MES_ATUAL) ? (
                <button onClick={() => { setValorLancar(lancamentoAtual ? String(lancamentoAtual.valor ?? "") : ""); setAlertas([]); setConfirmarMesmoAssim(false); setCodigoBarras(""); setHashArquivo(null); setLancando(true); }}
                  className="w-full text-[12.5px] font-semibold text-amb border border-amarelo/40 bg-amb-bg rounded-md py-2.5 hover:bg-amarelo/10 transition">
                  {lancamentoAtual ? `Lançar fatura de ${formatarPeriodo(MES_ATUAL, ANO_ATUAL).toLowerCase()}` : `Lançar fatura de ${formatarPeriodo(MES_ATUAL, ANO_ATUAL).toLowerCase()} (sem lançamento pendente ainda)`}
                </button>
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
                  <button onClick={lancarComBoleto} disabled={salvandoLancamento || (alertas.length > 0 && !confirmarMesmoAssim)}
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
              <div className="text-[14px] font-semibold text-[#1a1a1a]">Histórico mensal (R$)</div>
              <span className="text-[12px] text-[#6c757d]">Últimos 12 meses</span>
            </div>
            {valores.length === 0 ? (
              <div className="h-[140px] flex flex-col items-center justify-center text-center gap-1 rounded-md bg-[#f8f9fa] border border-dashed border-linha">
                <span className="text-[12.5px] font-semibold text-[#6c757d]">Sem histórico ainda</span>
                <span className="text-[11px] text-[#adb5bd]">Os lançamentos desta conta aparecem aqui.</span>
              </div>
            ) : (
              <div className="flex items-stretch gap-1 h-[140px]">
                {Array.from({ length: 12 }).map((_, mi) => {
                  const l = lancs.find((x) => x.mes === mi + 1);
                  const v = l?.valor != null ? Number(l.valor) : null;
                  const h = v != null ? Math.max((v / maxv) * 100, 3) : 3;
                  const ativo = mesHover === mi;
                  return (
                    <div key={mi} className="flex-1 flex flex-col relative"
                      onMouseEnter={() => setMesHover(mi)} onMouseLeave={() => setMesHover(null)}>
                      {ativo && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap rounded-md bg-white border border-linha shadow-lg px-2.5 py-1.5 pointer-events-none">
                          <div className="text-[10px] text-[#adb5bd]">{MES[mi]}/{ANO_ATUAL}</div>
                          <div className="text-[12px] font-semibold" style={{ color: v != null ? "#B8860B" : "#adb5bd" }}>
                            {v != null ? money(v) : "Sem lançamento"}
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

function NovaContaDrawer({ lojas, onClose }: { lojas: { id: string; codigo: string }[]; onClose: () => void }) {
  const router = useRouter();
  const { state, updateField, isLoading, error, salvar } = useContaForm(lojas[0]?.id ?? "");

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
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Loja</div>
            <select value={state.lojaId} onChange={(e) => updateField("lojaId", e.target.value)} className="input-padrao w-full">
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.codigo}</option>)}
            </select>
          </label>
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