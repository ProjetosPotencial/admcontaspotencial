"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIPOS, SITUACAO } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { money, MES } from "@/lib/format";
import { useDebounce } from "@/lib/hooks/useDebounce";

type Item = {
  id: string; ano: number; mes: number; valor: number | null; situacao: string; lancado_em?: string | null;
  comprovante_url?: string | null; comprovante_drive_url?: string | null;
  codigo_barras?: string | null; aprovado_por?: string | null; aprovado_em?: string | null;
  contas: { tipo: string; dia_vencimento: number | null; fornecedor_nome: string | null; lojas: { codigo: string; coban: string } | null };
};

type Resumo = {
  totalLancado: number; totalLancados: number; pctLancados: number;
  totalContestados: number; pctContestados: number; quantidade: number;
  venceHojeQtd: number; venceHojeValor: number;
};

function rotuloVencimento(dia: number | null, situacao: string): { texto: string; cor: string } {
  if (!dia) return { texto: "—", cor: "text-[#999]" };
  if (situacao !== "pendente") return { texto: `dia ${dia}`, cor: "text-[#666]" };
  const diaAtual = new Date().getDate();
  const diff = dia - diaAtual;
  if (diff < 0) return { texto: "Atrasada", cor: "text-alerr font-semibold" };
  if (diff === 0) return { texto: "Hoje", cor: "text-alerr font-semibold" };
  if (diff === 1) return { texto: "Amanhã", cor: "text-amb font-semibold" };
  if (diff <= 7) return { texto: `${diff} dias`, cor: "text-amb font-semibold" };
  return { texto: `dia ${dia}`, cor: "text-[#666]" };
}

export default function LancamentosClient({ itens, ano, resumo }: { itens: Item[]; ano: number; resumo: Resumo }) {
  const [fMes, setFMes] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fSituacao, setFSituacao] = useState("todos");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 250);
  const [ordemVenc, setOrdemVenc] = useState<"asc" | "desc" | null>(null);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(12);
  const [aberto, setAberto] = useState<Item | null>(null);

  const filtrados = useMemo(() => {
    let lista = itens.filter((l) => {
      const m = fMes === "todos" || String(l.mes) === fMes;
      const t = fTipo === "todos" || l.contas.tipo === fTipo;
      const s = fSituacao === "todos" || l.situacao === fSituacao;
      const q = buscaDebounced === "" || (l.contas.lojas?.codigo ?? "").toLowerCase().includes(buscaDebounced.toLowerCase()) ||
        (l.contas.fornecedor_nome ?? "").toLowerCase().includes(buscaDebounced.toLowerCase());
      return m && t && s && q;
    });
    if (ordemVenc) {
      lista = [...lista].sort((a, b) => {
        const da = a.contas.dia_vencimento ?? 99;
        const db = b.contas.dia_vencimento ?? 99;
        return ordemVenc === "asc" ? da - db : db - da;
      });
    } else {
      // ordem padrão: cronológica pela data de lançamento (mais recente primeiro)
      lista = [...lista].sort((a, b) => {
        const ta = a.lancado_em ? Date.parse(a.lancado_em) : 0;
        const tb = b.lancado_em ? Date.parse(b.lancado_em) : 0;
        if (tb !== ta) return tb - ta;
        return (b.mes - a.mes) || ((a.contas.dia_vencimento ?? 99) - (b.contas.dia_vencimento ?? 99));
      });
    }
    return lista;
  }, [itens, fMes, fTipo, fSituacao, buscaDebounced, ordemVenc]);

  const totalPaginas = Math.max(Math.ceil(filtrados.length / itensPorPagina), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const visiveis = filtrados.slice(inicio, inicio + itensPorPagina);

  function mudarFiltro(fn: () => void) { fn(); setPagina(1); }

  function exportarCsv() {
    const linhas = ["mes,loja,praca,tipo,fornecedor,valor,situacao"];
    filtrados.forEach((l) => {
      linhas.push([
        MES[l.mes - 1], l.contas.lojas?.codigo ?? "", l.contas.lojas?.coban ?? "",
        TIPOS[l.contas.tipo]?.n ?? l.contas.tipo, l.contas.fornecedor_nome ?? "",
        l.valor ?? "", SITUACAO[l.situacao]?.label ?? l.situacao,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lancamentos_${ano}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiMini label="Total lançado" value={money(resumo.totalLancado)} sub="valor de todos os lançamentos" cor="#1976d2" bg="#e3f2fd" />
        <KpiMini label="Lançados" value={money(resumo.totalLancados)} sub={`${resumo.pctLancados}% do total`} cor="#2E7D57" bg="#E4F1EA" barra={resumo.pctLancados} corBarra="#2E7D57" />
        <KpiMini label="Contestado(s)" value={money(resumo.totalContestados)} sub={`${resumo.pctContestados}% do total`} cor="#c9922a" bg="#fdf3e3" barra={resumo.pctContestados} corBarra="#FFC107" />
        <KpiMini label="Quantidade" value={String(resumo.quantidade)} sub="lançamentos" cor="#6B5B95" bg="#EDE7F6" />
        <KpiMini label="Vencendo hoje" value={money(resumo.venceHojeValor)} sub={`${resumo.venceHojeQtd} lançamentos`} cor="#B23B3B" bg="#F7E4E2" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <input value={busca} onChange={(e) => mudarFiltro(() => setBusca(e.target.value))} placeholder="Buscar loja ou fornecedor..."
          className="h-10 bg-[#f9f9f9] border border-linha rounded-md px-3 text-[13px] min-w-[220px] flex-1 focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10" />
        <select value={fMes} onChange={(e) => mudarFiltro(() => setFMes(e.target.value))} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todos os meses</option>
          {MES.map((m, i) => <option key={i} value={i + 1}>{m}/{ano}</option>)}
        </select>
        <select value={fTipo} onChange={(e) => mudarFiltro(() => setFTipo(e.target.value))} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
        </select>
        <select value={fSituacao} onChange={(e) => mudarFiltro(() => setFSituacao(e.target.value))} className="h-10 bg-white border border-linha rounded-md px-3 text-[13px]">
          <option value="todos">Todas as situações</option>
          {Object.entries(SITUACAO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={exportarCsv} className="flex items-center gap-1.5 h-10 bg-amarelo hover:bg-amarelo-dark text-ebano font-semibold text-[13px] px-4 rounded-md transition-colors">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 3v10m0 0l-4-4m4 4l4-4" /><path d="M3.5 15v2a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-2" /></svg>
          Exportar
        </button>
      </div>

      <div className="text-[12px] text-[#999] mb-3">{filtrados.length} lançamentos · total {money(filtrados.reduce((s, l) => s + Number(l.valor ?? 0), 0))}</div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f5f5f5] h-12">
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Mês</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Loja</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Tipo</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Fornecedor</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Valor</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Situação</th>
              <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">
                <button onClick={() => setOrdemVenc(ordemVenc === "asc" ? "desc" : "asc")} className="flex items-center gap-1 hover:text-amarelo-dark">
                  Vencimento
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {ordemVenc === "asc" ? <path d="M6 12l4-4 4 4" /> : ordemVenc === "desc" ? <path d="M6 8l4 4 4-4" /> : <path d="M6 7l4-3 4 3M6 13l4 3 4-3" />}
                  </svg>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const T = TIPOS[l.contas.tipo];
              const s = SITUACAO[l.situacao] ?? { label: l.situacao, cls: "bg-[#f5f5f5] text-[#999]" };
              return (
                <tr key={l.id} onClick={() => setAberto(l)} className="h-12 border-b border-[#f0f0f0] last:border-0 hover:bg-[#f9f9f9] cursor-pointer">
                  <td className="px-4 text-[13px] font-mono text-[#666]">{MES[l.mes - 1]}</td>
                  <td className="px-4 text-[13px] font-medium">{l.contas.lojas?.codigo}</td>
                  <td className="px-4 text-[13px]">
                    <span className="inline-flex items-center gap-1.5"><TipoIcon tipo={l.contas.tipo} size={14} color={T?.c} />{T?.n}</span>
                  </td>
                  <td className="px-4 text-[13px] text-[#666]">{l.contas.fornecedor_nome ?? "—"}</td>
                  <td className="px-4 text-[13px] font-mono font-semibold">{money(l.valor)}</td>
                  <td className="px-4"><span className={`badge ${s.cls}`}>{s.label}</span></td>
                  <td className={`px-4 text-[12.5px] font-mono ${rotuloVencimento(l.contas.dia_vencimento, l.situacao).cor}`}>{rotuloVencimento(l.contas.dia_vencimento, l.situacao).texto}</td>
                </tr>
              );
            })}
            {visiveis.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-[#999]">Nenhum lançamento com esses filtros.</td></tr>
            )}
          </tbody>
        </table></div>

        {/* paginação real */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-linha2 flex-wrap gap-3">
          <span className="text-[12px] text-[#6c757d]">
            Mostrando {filtrados.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + itensPorPagina, filtrados.length)} de {filtrados.length} lançamentos
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPagina((p) => Math.max(p - 1, 1))} disabled={paginaSegura === 1}
              className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">‹</button>
            {paginasVisiveis(paginaSegura, totalPaginas).map((p, i) =>
              p === "..." ? (
                <span key={i} className="px-1.5 text-[#adb5bd] text-[12px]">…</span>
              ) : (
                <button key={i} onClick={() => setPagina(p as number)}
                  className={`w-8 h-8 rounded-md text-[12.5px] font-semibold ${paginaSegura === p ? "bg-amarelo text-ebano" : "border border-linha text-[#6c757d] hover:bg-off"}`}>
                  {p}
                </button>
              )
            )}
            <button onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))} disabled={paginaSegura === totalPaginas}
              className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">›</button>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#6c757d]">
            Itens por página
            <select value={itensPorPagina} onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPagina(1); }}
              className="border border-linha rounded-md px-2 py-1.5 text-[12.5px]">
              {[12, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      {aberto && <DetalheDrawer item={aberto} onClose={() => setAberto(null)} />}
    </>
  );
}

function paginasVisiveis(atual: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pgs: (number | "...")[] = [1];
  if (atual > 3) pgs.push("...");
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) pgs.push(i);
  if (atual < total - 2) pgs.push("...");
  pgs.push(total);
  return pgs;
}

function DetalheDrawer({ item, onClose }: { item: Item; onClose: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const T = TIPOS[item.contas.tipo];
  const s = SITUACAO[item.situacao] ?? { label: item.situacao, cls: "bg-[#f5f5f5] text-[#999]" };
  const [aviso, setAviso] = useState<string | null>(null);
  const [aprovadorNome, setAprovadorNome] = useState<string | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function excluirLancamento() {
    setExcluindo(true); setAviso(null);
    const { data, error } = await supabase.rpc("excluir_lancamento", { p_id: item.id });
    setExcluindo(false);
    if (error) {
      setAviso(/permiss|42501/i.test(error.message ?? "")
        ? "Você não tem permissão para excluir lançamentos (só admin ou gestor)."
        : "Não foi possível excluir o lançamento.");
      return;
    }
    if (!data || Number(data) === 0) { setAviso("O lançamento não foi removido."); return; }
    onClose();
    router.refresh();
  }

  useEffect(() => {
    if (!item.aprovado_por) { setAprovadorNome(null); return; }
    supabase.from("perfis").select("nome").eq("id", item.aprovado_por).maybeSingle()
      .then(({ data }) => setAprovadorNome(data?.nome ?? null));
  }, [item.aprovado_por]);

  async function verBoleto() {
    if (!item.comprovante_url) return;
    const { data, error } = await supabase.storage.from("boletos").createSignedUrl(item.comprovante_url, 300);
    if (error || !data) { setAviso("Não foi possível abrir o boleto."); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[380px] max-w-[94vw] bg-white border-l border-linha z-50 overflow-y-auto">
        <div className="relative px-5 py-5 border-b border-linha">
          <span className="absolute left-0 right-0 top-0 h-1 bg-amarelo" />
          <button onClick={onClose} className="absolute right-5 top-5 text-[#999] hover:text-[#1a1a1a]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: T?.bg }}>
              <TipoIcon tipo={item.contas.tipo} size={20} color={T?.c} />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-[#1a1a1a] leading-tight">{item.contas.lojas?.codigo}</h3>
              <div className="text-[12.5px] text-[#666]">{T?.n} · {MES[item.mes - 1]}</div>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><div className="text-[11px] text-[#999] font-medium mb-0.5">Valor</div><div className="text-[15px] font-bold font-mono">{money(item.valor)}</div></div>
            <div><div className="text-[11px] text-[#999] font-medium mb-0.5">Situação</div><span className={`badge ${s.cls}`}>{s.label}</span></div>
            <div><div className="text-[11px] text-[#999] font-medium mb-0.5">Fornecedor</div><div className="text-[13px] font-semibold">{item.contas.fornecedor_nome ?? "—"}</div></div>
            <div><div className="text-[11px] text-[#999] font-medium mb-0.5">Vencimento</div><div className="text-[13px] font-semibold font-mono">{item.contas.dia_vencimento ? `dia ${item.contas.dia_vencimento}` : "—"}</div></div>
          </div>

          {(item.situacao === "aprovado" || item.situacao === "pago" || item.situacao === "contestado") && (aprovadorNome || item.aprovado_em) && (
            <div className="text-[12px] text-[#666] bg-[#f8f9fa] rounded-md px-3 py-2.5">
              {item.situacao === "contestado" ? "Recusado" : "Aprovado"} por <b className="text-[#1a1a1a]">{aprovadorNome ?? "—"}</b>
              {item.aprovado_em && ` em ${new Date(item.aprovado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
            </div>
          )}

          {(item.comprovante_url || item.comprovante_drive_url) && (
            <div className="pt-4 border-t border-linha2 space-y-2">
              {item.comprovante_url && (
                <button onClick={verBoleto} className="flex items-center gap-1.5 text-[13px] font-semibold text-info hover:underline">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></svg>
                  Ver boleto
                </button>
              )}
              {item.comprovante_drive_url && (
                <a href={item.comprovante_drive_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6c757d] hover:underline">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2l6 10.5H2.5L8 2z" /><path d="M9 12.5l3 5.5h6l-3-5.5" /><path d="M12 2l6 10.5-3 5.5" /></svg>
                  Ver no Drive
                </a>
              )}
              {aviso && <div className="text-[11px] text-alerr">{aviso}</div>}
            </div>
          )}

          <a href={`/contas?tipo=${item.contas.tipo}`} className="btn-secundario w-full flex items-center justify-center">
            Ver contas desse tipo
          </a>

          <div className="pt-4 border-t border-linha2">
            {!confirmarExcluir ? (
              <button onClick={() => { setConfirmarExcluir(true); setAviso(null); }}
                className="text-[12.5px] font-semibold text-alerr hover:underline">
                Excluir lançamento
              </button>
            ) : (
              <div className="bg-alerr-bg rounded-md p-3">
                <div className="text-[12px] text-[#7a3838] mb-2.5">Excluir este lançamento? Não dá pra desfazer.</div>
                <div className="flex gap-2">
                  <button onClick={excluirLancamento} disabled={excluindo}
                    className="flex-1 bg-alerr text-white rounded-md py-2 text-[12.5px] font-semibold disabled:opacity-50">
                    {excluindo ? "Excluindo..." : "Sim, excluir"}
                  </button>
                  <button onClick={() => setConfirmarExcluir(false)}
                    className="bg-white border border-linha text-[#666] rounded-md px-4 py-2 text-[12.5px] font-semibold">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function KpiMini({ label, value, sub, cor, bg, barra, corBarra }: {
  label: string; value: string; sub: string; cor: string; bg: string; barra?: number; corBarra?: string;
}) {
  return (
    <div className="bg-white border border-linha rounded-xl p-4 shadow-leve">
      <div className="w-9 h-9 rounded-full grid place-items-center mb-2.5" style={{ background: bg }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
      </div>
      <div className="text-[11px] text-[#6c757d] font-medium truncate">{label}</div>
      <div className="text-[17px] font-bold text-[#1a1a1a] leading-tight mt-1 truncate">{value}</div>
      {barra !== undefined ? (
        <div className="h-1.5 rounded-full bg-[#f1f3f5] mt-2 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(barra, 100)}%`, background: corBarra }} />
        </div>
      ) : null}
      <div className="text-[10.5px] text-[#adb5bd] mt-1.5">{sub}</div>
    </div>
  );
}