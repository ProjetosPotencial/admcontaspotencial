"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import LogoFornecedor from "@/components/logo-fornecedor";

type Neg = any;

const STATUS: Record<string, { rot: string; cls: string }> = {
  aberta: { rot: "Aberta", cls: "bg-info-bg text-info" },
  em_negociacao: { rot: "Em negociação", cls: "bg-info-bg text-info" },
  aguardando: { rot: "Aguardando retorno", cls: "bg-amb-bg text-amb" },
  proposta: { rot: "Proposta enviada", cls: "bg-amb-bg text-amb" },
  acordo: { rot: "Acordo fechado", cls: "bg-ok-bg text-ok" },
  pago: { rot: "Pago", cls: "bg-ok-bg text-ok" },
  juridico: { rot: "Enviada ao jurídico", cls: "bg-alerr-bg text-alerr" },
  encerrada: { rot: "Encerrada", cls: "bg-off text-txt-2" },
};
const PRIORIDADE: Record<string, { rot: string; cls: string }> = {
  baixa: { rot: "Baixa", cls: "bg-ok-bg text-ok" },
  media: { rot: "Média", cls: "bg-amb-bg text-amb" },
  alta: { rot: "Alta", cls: "bg-amb-bg text-amb" },
  critica: { rot: "Crítica", cls: "bg-alerr-bg text-alerr" },
};

const ABERTAS = ["aberta", "em_negociacao", "aguardando", "proposta"];

export default function NegociacoesClient({ negociacoes, lojas, responsaveis, logos }: { negociacoes: Neg[]; lojas: Record<string, any>; responsaveis: Record<string, string>; logos: Record<string, string> }) {
  const [lista, setLista] = useState<Neg[]>(negociacoes);
  const [aberta, setAberta] = useState<Neg | null>(null);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fPrioridade, setFPrioridade] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");

  const nomeLoja = (n: Neg) => {
    const l = lojas[n.loja_id];
    return l ? (`${l.codigo ?? ""}`.trim() || "—") : "—";
  };
  const cidadeLoja = (n: Neg) => {
    const l = lojas[n.loja_id];
    return l ? `${l.cidade ?? ""}${l.uf ? " - " + l.uf : ""}`.trim() : "";
  };
  const diasEm = (n: Neg) => {
    const base = n.data_inicio ?? n.criado_em;
    if (!base) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / 86400000));
  };

  const tipos = useMemo(() => Array.from(new Set(lista.map((n) => n.tipo).filter(Boolean))), [lista]);

  const filtradas = useMemo(() => lista.filter((n) => {
    if (fStatus !== "todos" && n.status !== fStatus) return false;
    if (fPrioridade !== "todas" && n.prioridade !== fPrioridade) return false;
    if (fTipo !== "todos" && n.tipo !== fTipo) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const alvo = `${n.fornecedor_nome ?? ""} ${nomeLoja(n)} ${cidadeLoja(n)} ${n.tipo ?? ""}`.toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  }), [lista, fStatus, fPrioridade, fTipo, busca]);

  const m = useMemo(() => {
    const abertas = lista.filter((n) => ABERTAS.includes(n.status));
    const valorEmNeg = abertas.reduce((s, n) => s + Number(n.valor_atualizado ?? n.valor_original ?? 0), 0);
    const aguardando = lista.filter((n) => n.status === "aguardando").length;
    const acordos = lista.filter((n) => n.status === "acordo" || n.status === "pago").length;
    const juridico = lista.filter((n) => n.status === "juridico").length;
    const economia = lista.reduce((s, n) => s + Number(n.economia ?? 0), 0);
    const valorOriginal = lista.reduce((s, n) => s + Number(n.valor_original ?? 0), 0);
    const valorAtual = lista.reduce((s, n) => s + Number(n.valor_atualizado ?? n.valor_original ?? 0), 0);
    const valorNegociado = lista.reduce((s, n) => s + Number(n.valor_negociado ?? 0), 0);
    return { valorEmNeg, abertos: abertas.length, aguardando, acordos, juridico, economia, valorOriginal, valorAtual, valorNegociado };
  }, [lista]);

  return (
    <div className="max-w-[1500px]">
      <div className="mb-5">
        <h1 className="text-[30px] font-bold text-txt leading-none">Negociações</h1>
        <p className="text-[13px] text-txt-2 mt-1.5">Gestão de cobranças e acordos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Metrica icone="dinheiro" cor="amb" rot="Valor em Negociação" val={money(m.valorEmNeg)} />
        <Metrica icone="pasta" cor="info" rot="Processos Abertos" val={String(m.abertos)} />
        <Metrica icone="relogio" cor="amb" rot="Aguardando Retorno" val={String(m.aguardando)} />
        <Metrica icone="aperto" cor="ok" rot="Acordos Fechados" val={String(m.acordos)} />
        <Metrica icone="balanca" cor="alerr" rot="Enviadas ao Jurídico" val={String(m.juridico)} />
        <Metrica icone="economia" cor="ok" rot="Economia Obtida" val={money(m.economia)} />
      </div>

      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar fornecedor, loja ou negociação..." className="input-padrao w-full" />
          </div>
          <Sel label="Tipo" v={fTipo} on={setFTipo} ops={[["todos", "Todos"], ...tipos.map((t) => [t, t] as [string, string])]} />
          <Sel label="Prioridade" v={fPrioridade} on={setFPrioridade} ops={[["todas", "Todas"], ...Object.entries(PRIORIDADE).map(([k, v]) => [k, v.rot] as [string, string])]} />
          <Sel label="Status" v={fStatus} on={setFStatus} ops={[["todos", "Todos"], ...Object.entries(STATUS).map(([k, v]) => [k, v.rot] as [string, string])]} />
        </div>
      </div>

      <div className="flex gap-5 items-start">
        <div className="card flex-1 min-w-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-linha2 text-[14px] font-semibold text-txt">
            Negociações <span className="text-txt-3 font-normal">({filtradas.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-txt-2 text-left border-b border-linha2">
                  <th className="font-medium px-5 py-2.5">Loja</th>
                  <th className="font-medium px-3 py-2.5">Fornecedor</th>
                  <th className="font-medium px-3 py-2.5">Tipo</th>
                  <th className="font-medium px-3 py-2.5 text-right">Valor Atual</th>
                  <th className="font-medium px-3 py-2.5">Dias</th>
                  <th className="font-medium px-3 py-2.5">Status</th>
                  <th className="font-medium px-3 py-2.5">Prioridade</th>
                  <th className="font-medium px-3 py-2.5">Próximo contato</th>
                  <th className="font-medium px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-txt-3">Nenhuma negociação. Mova uma conta pelo painel de Contas.</td></tr>
                ) : filtradas.map((n) => {
                  const st = STATUS[n.status] ?? STATUS.aberta;
                  const pr = PRIORIDADE[n.prioridade] ?? PRIORIDADE.media;
                  const dias = diasEm(n);
                  const corDias = dias == null ? "text-txt-3" : dias > 60 ? "text-alerr" : dias > 30 ? "text-amb" : "text-txt-2";
                  return (
                    <tr key={n.id} className="border-b border-linha2 last:border-0 hover:bg-off/60">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-txt">{nomeLoja(n)}</div>
                        <div className="text-[11px] text-txt-3">{cidadeLoja(n)}</div>
                      </td>
                      <td className="px-3 py-3 font-medium text-txt">
                        <div className="flex items-center gap-2.5">
                          <LogoFornecedor nome={n.fornecedor_nome || "?"} url={logos[String(n.fornecedor_nome || "").toLowerCase()]} size={30} />
                          <span>{n.fornecedor_nome || "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-txt-2 capitalize">{n.tipo || "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="font-bold text-txt">{money(Number(n.valor_atualizado ?? n.valor_original ?? 0))}</div>
                        {n.valor_original != null && <div className="text-[10.5px] text-txt-3">Original: {money(Number(n.valor_original))}</div>}
                      </td>
                      <td className={`px-3 py-3 font-semibold ${corDias}`}>{dias == null ? "—" : `${dias} dias`}</td>
                      <td className="px-3 py-3"><span className={`text-[10.5px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.rot}</span></td>
                      <td className="px-3 py-3"><span className={`text-[10.5px] font-semibold px-2 py-1 rounded-full ${pr.cls}`}>{pr.rot}</span></td>
                      <td className="px-3 py-3 text-txt-2 whitespace-nowrap">{n.proximo_contato ? new Date(n.proximo_contato + "T00:00").toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => setAberta(n)} className="text-[12px] font-semibold text-txt border border-linha rounded-lg px-3 py-1.5 hover:bg-off">Abrir</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[320px] shrink-0 space-y-4 hidden xl:block">
          <div className="card p-4">
            <div className="text-[13px] font-semibold text-txt mb-3">Tarefas urgentes</div>
            <TarefaLinha cor="info" n={m.aguardando} txt="Aguardando retorno do fornecedor" />
            <TarefaLinha cor="alerr" n={m.juridico} txt="Prazos jurídicos" />
            <TarefaLinha cor="amb" n={lista.filter((x) => { const d = diasEm(x); return d != null && d > 7 && ABERTAS.includes(x.status); }).length} txt="Sem atualização há mais de 7 dias" />
          </div>

          <div className="card p-4">
            <div className="text-[13px] font-semibold text-txt mb-3">Resumo financeiro</div>
            <div className="flex items-center gap-4">
              <Donut original={m.valorOriginal} atual={m.valorAtual} negociado={m.valorNegociado} economia={m.economia} />
              <div className="flex-1 space-y-1.5 text-[11.5px]">
                <LegLinha cor="#9E9E9E" rot="Valor Original" val={money(m.valorOriginal)} />
                <LegLinha cor="#FFB800" rot="Valor Atual" val={money(m.valorAtual)} />
                <LegLinha cor="#2E7D32" rot="Valor Negociado" val={money(m.valorNegociado)} />
                <LegLinha cor="#2A74C4" rot="Economia" val={money(m.economia)} />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-txt mb-2">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-amb"><path d="M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6z" /></svg>
              IA Assistente
            </div>
            <p className="text-[12px] text-txt-2 leading-relaxed">A análise por IA (chances de acordo, histórico de descontos, recomendação de envio ao jurídico) chega no próximo passo do módulo.</p>
          </div>
        </div>
      </div>

      {aberta && (
        <PainelNegociacao
          neg={aberta} nomeLoja={`${nomeLoja(aberta)} ${cidadeLoja(aberta)}`.trim()} responsaveis={responsaveis}
          onClose={() => setAberta(null)}
          onSalvo={(atual) => { setLista((l) => l.map((x) => (x.id === atual.id ? { ...x, ...atual } : x))); setAberta({ ...aberta, ...atual }); }}
        />
      )}
    </div>
  );
}

const ICONES_METRICA: Record<string, React.ReactNode> = {
  dinheiro: <path d="M10 4v12M7 7.5h4a1.8 1.8 0 010 3.6H7m0 0h4.5a1.8 1.8 0 010 3.4H7" />,
  pasta: <path d="M3 6a1 1 0 011-1h3.5l1.5 2H16a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" />,
  relogio: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2" /></>,
  aperto: <path d="M4 11l2.5-2.5 2 1.5 3-3 4.5 4.5M13 11l-2 2-1.5-1.5" />,
  balanca: <path d="M10 3v14M5 6h10M5 6l-2 5h4l-2-5zM15 6l-2 5h4l-2-5zM7 17h6" />,
  economia: <><rect x="3" y="5.5" width="14" height="9" rx="1.5" /><circle cx="10" cy="10" r="2" /></>,
};
function Metrica({ icone, cor, rot, val }: { icone: string; cor: string; rot: string; val: string }) {
  const bg = { amb: "bg-amb-bg text-amb", info: "bg-info-bg text-info", ok: "bg-ok-bg text-ok", alerr: "bg-alerr-bg text-alerr" }[cor] ?? "bg-off text-txt-2";
  return (
    <div className="card p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${bg}`}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONES_METRICA[icone]}</svg>
      </div>
      <div className="text-[11.5px] text-txt-2 mb-0.5">{rot}</div>
      <div className="text-[19px] font-bold text-txt leading-tight">{val}</div>
    </div>
  );
}

function Sel({ label, v, on, ops }: { label: string; v: string; on: (v: string) => void; ops: [string, string][] }) {
  return (
    <label className="block">
      <div className="text-[11px] text-txt-2 font-medium mb-1">{label}</div>
      <select value={v} onChange={(e) => on(e.target.value)} className="input-padrao min-w-[130px]">
        {ops.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
      </select>
    </label>
  );
}

function TarefaLinha({ cor, n, txt }: { cor: string; n: number; txt: string }) {
  const c = { info: "text-info", alerr: "text-alerr", amb: "text-amb" }[cor] ?? "text-txt-2";
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className={`text-[15px] font-bold ${c} leading-none mt-0.5`}>{n}</span>
      <div className="text-[12px] text-txt-2 leading-snug">{txt}</div>
    </div>
  );
}

function LegLinha({ cor, rot, val }: { cor: string; rot: string; val: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-txt-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />{rot}</span>
      <span className="font-semibold text-txt">{val}</span>
    </div>
  );
}

function Donut({ original, atual, negociado, economia }: { original: number; atual: number; negociado: number; economia: number }) {
  const vals = [original, atual, negociado, economia];
  const cores = ["#9E9E9E", "#FFB800", "#2E7D32", "#2A74C4"];
  const total = vals.reduce((s, v) => s + v, 0) || 1;
  let acc = 0;
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg width="86" height="86" viewBox="0 0 86 86" className="shrink-0">
      <circle cx="43" cy="43" r={r} fill="none" stroke="#EEEEEE" strokeWidth="12" />
      {vals.map((v, i) => {
        const frac = v / total;
        const dash = frac * c;
        const el = <circle key={i} cx="43" cy="43" r={r} fill="none" stroke={cores[i]} strokeWidth="12"
          strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc} transform="rotate(-90 43 43)" />;
        acc += dash;
        return el;
      })}
    </svg>
  );
}

function PainelNegociacao({ neg, nomeLoja, responsaveis, onClose, onSalvo }: { neg: Neg; nomeLoja: string; responsaveis: Record<string, string>; onClose: () => void; onSalvo: (n: Neg) => void }) {
  const supabase = createClient();
  const [f, setF] = useState<Neg>({ ...neg });
  const [salvando, setSalvando] = useState(false);
  const [interacoes, setInteracoes] = useState<any[] | null>(null);
  const [novaObs, setNovaObs] = useState("");
  const [addingObs, setAddingObs] = useState(false);

  const set = (campo: string, valor: any) => setF((x: Neg) => ({ ...x, [campo]: valor }));
  const num = (v: any) => (v === "" || v == null ? null : Number(v));

  async function carregarInteracoes() {
    const { data } = await supabase.from("negociacao_interacoes").select("*").eq("negociacao_id", neg.id).order("em", { ascending: false });
    setInteracoes((data ?? []) as any[]);
  }
  if (interacoes === null) carregarInteracoes();

  async function salvar() {
    setSalvando(true);
    const economia = num(f.valor_atualizado) != null && num(f.valor_aprovado) != null
      ? Number(f.valor_atualizado) - Number(f.valor_aprovado) : num(f.economia);
    const patch = {
      status: f.status, prioridade: f.prioridade, motivo: f.motivo || null,
      data_inicio: f.data_inicio || null, proximo_contato: f.proximo_contato || null, data_limite: f.data_limite || null,
      juros: num(f.juros), multa: num(f.multa), correcao_monetaria: num(f.correcao_monetaria),
      valor_atualizado: num(f.valor_atualizado), valor_negociado: num(f.valor_negociado),
      valor_aprovado: num(f.valor_aprovado), economia,
      fornecedor_contato: f.fornecedor_contato || null, fornecedor_email: f.fornecedor_email || null,
      fornecedor_telefone: f.fornecedor_telefone || null, fornecedor_responsavel: f.fornecedor_responsavel || null,
    };
    await supabase.from("negociacoes").update(patch).eq("id", neg.id);
    if (neg.conta_id) {
      await supabase.from("contas").update({ em_negociacao: f.status !== "encerrada" }).eq("id", neg.conta_id);
    }
    setSalvando(false);
    onSalvo({ ...f, ...patch });
  }

  async function adicionarObs() {
    if (!novaObs.trim()) return;
    setAddingObs(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("negociacao_interacoes").insert({ negociacao_id: neg.id, tipo: "observacao", conteudo: novaObs.trim(), origem: "sistema", quem: user?.id ?? null });
    setNovaObs(""); setAddingObs(false); carregarInteracoes();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full max-w-[560px] h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-linha px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-[18px] font-bold text-txt">{f.fornecedor_nome || "Negociação"}</div>
            <div className="text-[12px] text-txt-2">{nomeLoja}{f.tipo ? ` · ${f.tipo}` : ""}</div>
          </div>
          <button onClick={onClose} className="text-txt-3 hover:text-txt">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <Secao titulo="Controle">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Status">
                <select value={f.status ?? "aberta"} onChange={(e) => set("status", e.target.value)} className="input-padrao w-full">
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
                </select>
              </Campo>
              <Campo label="Prioridade">
                <select value={f.prioridade ?? "media"} onChange={(e) => set("prioridade", e.target.value)} className="input-padrao w-full">
                  {Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
                </select>
              </Campo>
              <Campo label="Responsável"><div className="input-padrao w-full bg-off text-txt-2 flex items-center">{f.responsavel_id ? (responsaveis[f.responsavel_id] ?? "—") : "—"}</div></Campo>
              <div />
              <Campo label="Início"><input type="date" value={f.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Próximo contato"><input type="date" value={f.proximo_contato ?? ""} onChange={(e) => set("proximo_contato", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Data limite"><input type="date" value={f.data_limite ?? ""} onChange={(e) => set("data_limite", e.target.value)} className="input-padrao w-full" /></Campo>
            </div>
            <Campo label="Motivo da negociação"><textarea value={f.motivo ?? ""} onChange={(e) => set("motivo", e.target.value)} rows={2} className="input-padrao w-full resize-none py-2" /></Campo>
          </Secao>

          <Secao titulo="Financeiro">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor original"><div className="input-padrao w-full bg-off text-txt-2 flex items-center">{money(Number(f.valor_original ?? 0))}</div></Campo>
              <CampoNum label="Juros" v={f.juros} on={(v) => set("juros", v)} />
              <CampoNum label="Multa" v={f.multa} on={(v) => set("multa", v)} />
              <CampoNum label="Correção monetária" v={f.correcao_monetaria} on={(v) => set("correcao_monetaria", v)} />
              <CampoNum label="Valor atualizado" v={f.valor_atualizado} on={(v) => set("valor_atualizado", v)} />
              <CampoNum label="Valor negociado" v={f.valor_negociado} on={(v) => set("valor_negociado", v)} />
              <CampoNum label="Valor aprovado" v={f.valor_aprovado} on={(v) => set("valor_aprovado", v)} />
              <Campo label="Economia obtida">
                <div className="input-padrao w-full bg-ok-bg text-ok font-semibold flex items-center">
                  {f.valor_atualizado != null && f.valor_aprovado != null && f.valor_atualizado !== "" && f.valor_aprovado !== ""
                    ? money(Number(f.valor_atualizado) - Number(f.valor_aprovado)) : "—"}
                </div>
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Contato do fornecedor">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Pessoa responsável"><input value={f.fornecedor_responsavel ?? ""} onChange={(e) => set("fornecedor_responsavel", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Contato"><input value={f.fornecedor_contato ?? ""} onChange={(e) => set("fornecedor_contato", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="E-mail"><input value={f.fornecedor_email ?? ""} onChange={(e) => set("fornecedor_email", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Telefone"><input value={f.fornecedor_telefone ?? ""} onChange={(e) => set("fornecedor_telefone", e.target.value)} className="input-padrao w-full" /></Campo>
            </div>
          </Secao>

          <button onClick={salvar} disabled={salvando} className="btn-primario w-full disabled:opacity-50">{salvando ? "Salvando..." : "Salvar negociação"}</button>

          <Secao titulo="Histórico">
            <div className="flex gap-2 mb-3">
              <input value={novaObs} onChange={(e) => setNovaObs(e.target.value)} placeholder="Registrar observação, ligação, e-mail..." className="input-padrao flex-1" />
              <button onClick={adicionarObs} disabled={addingObs || !novaObs.trim()} className="btn-secundario disabled:opacity-40">Adicionar</button>
            </div>
            {interacoes === null ? <div className="text-[12px] text-txt-3">Carregando...</div>
              : interacoes.length === 0 ? <div className="text-[12px] text-txt-3">Nenhuma interação registrada ainda.</div>
              : <div className="space-y-2">{interacoes.map((it) => (
                  <div key={it.id} className="border border-linha rounded-lg px-3 py-2">
                    <div className="text-[12.5px] text-txt">{it.conteudo}</div>
                    <div className="text-[10.5px] text-txt-3 mt-0.5">{new Date(it.em).toLocaleString("pt-BR")} · {it.tipo}{it.origem ? ` · ${it.origem}` : ""}</div>
                  </div>))}</div>}
          </Secao>
        </div>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <div><div className="text-[13px] font-semibold text-txt mb-3 pb-1.5 border-b border-linha">{titulo}</div><div className="space-y-3">{children}</div></div>;
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-[11px] text-txt-3 font-medium mb-1">{label}</div>{children}</label>;
}
function CampoNum({ label, v, on }: { label: string; v: any; on: (v: string) => void }) {
  return <Campo label={label}><input type="number" step="0.01" value={v ?? ""} onChange={(e) => on(e.target.value)} className="input-padrao w-full font-mono" /></Campo>;
}
