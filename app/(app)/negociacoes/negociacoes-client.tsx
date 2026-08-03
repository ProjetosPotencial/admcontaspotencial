"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

type Neg = any;

const STATUS: Record<string, { rot: string; cls: string }> = {
  aberta: { rot: "Aberta", cls: "bg-info-bg text-info" },
  em_andamento: { rot: "Em andamento", cls: "bg-amarelo-bg text-amb" },
  acordo: { rot: "Acordo", cls: "bg-ok-bg text-ok" },
  pago: { rot: "Pago", cls: "bg-ok-bg text-ok" },
  juridico: { rot: "Jurídico", cls: "bg-alerr-bg text-alerr" },
  encerrada: { rot: "Encerrada", cls: "bg-off text-[#6c757d]" },
};
const PRIORIDADE: Record<string, { rot: string; cls: string }> = {
  baixa: { rot: "Baixa", cls: "bg-off text-[#6c757d]" },
  media: { rot: "Média", cls: "bg-info-bg text-info" },
  alta: { rot: "Alta", cls: "bg-amarelo-bg text-amb" },
  critica: { rot: "Crítica", cls: "bg-alerr-bg text-alerr" },
};

export default function NegociacoesClient({ negociacoes, lojas, responsaveis }: { negociacoes: Neg[]; lojas: Record<string, any>; responsaveis: Record<string, string> }) {
  const [lista, setLista] = useState<Neg[]>(negociacoes);
  const [aberta, setAberta] = useState<Neg | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todas");

  const nomeLoja = (n: Neg) => {
    const l = lojas[n.loja_id];
    return l ? `${l.codigo ?? ""} ${l.cidade ?? ""}${l.uf ? "-" + l.uf : ""}`.trim() : "—";
  };

  const filtradas = filtroStatus === "todas" ? lista : lista.filter((n) => n.status === filtroStatus);

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Negociações</h1>
          <p className="text-[13px] text-[#6c757d] mt-2">Gestão de cobranças e acordos. {lista.length} processo(s).</p>
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input-padrao">
          <option value="todas">Todas as situações</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div className="card p-10 text-center text-[13px] text-[#adb5bd]">
          Nenhuma negociação {filtroStatus !== "todas" ? "nessa situação" : "ainda"}. Mova uma conta para negociação pelo painel da conta.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtradas.map((n) => {
            const st = STATUS[n.status] ?? STATUS.aberta;
            const pr = PRIORIDADE[n.prioridade] ?? PRIORIDADE.media;
            return (
              <button key={n.id} onClick={() => setAberta(n)} className="card w-full text-left p-4 hover:shadow-md transition flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.rot}</span>
                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.rot}</span>
                  </div>
                  <div className="text-[14px] font-semibold text-[#1a1a1a] truncate">{n.fornecedor_nome || "—"}</div>
                  <div className="text-[12px] text-[#6c757d]">{nomeLoja(n)}{n.tipo ? ` · ${n.tipo}` : ""}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-[#adb5bd]">Dívida atualizada</div>
                  <div className="text-[15px] font-bold text-[#1a1a1a]">{money(Number(n.valor_atualizado ?? n.valor_original ?? 0))}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {aberta && (
        <PainelNegociacao
          neg={aberta}
          nomeLoja={nomeLoja(aberta)}
          responsaveis={responsaveis}
          onClose={() => setAberta(null)}
          onSalvo={(atual) => { setLista((l) => l.map((x) => (x.id === atual.id ? { ...x, ...atual } : x))); setAberta({ ...aberta, ...atual }); }}
        />
      )}
    </div>
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
      ? Number(f.valor_atualizado) - Number(f.valor_aprovado)
      : num(f.economia);
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
    setSalvando(false);
    onSalvo({ ...f, ...patch });
  }

  async function adicionarObs() {
    if (!novaObs.trim()) return;
    setAddingObs(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("negociacao_interacoes").insert({
      negociacao_id: neg.id, tipo: "observacao", conteudo: novaObs.trim(), origem: "sistema", quem: user?.id ?? null,
    });
    setNovaObs("");
    setAddingObs(false);
    carregarInteracoes();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full max-w-[560px] h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-linha px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-[18px] font-bold text-[#1a1a1a]">{f.fornecedor_nome || "Negociação"}</div>
            <div className="text-[12px] text-[#6c757d]">{nomeLoja}{f.tipo ? ` · ${f.tipo}` : ""}</div>
          </div>
          <button onClick={onClose} className="text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Controle */}
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
              <Campo label="Responsável">
                <div className="input-padrao w-full bg-off text-[#6c757d]">{f.responsavel_id ? (responsaveis[f.responsavel_id] ?? "—") : "—"}</div>
              </Campo>
              <div />
              <Campo label="Início"><input type="date" value={f.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Próximo contato"><input type="date" value={f.proximo_contato ?? ""} onChange={(e) => set("proximo_contato", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Data limite"><input type="date" value={f.data_limite ?? ""} onChange={(e) => set("data_limite", e.target.value)} className="input-padrao w-full" /></Campo>
            </div>
            <Campo label="Motivo da negociação">
              <textarea value={f.motivo ?? ""} onChange={(e) => set("motivo", e.target.value)} rows={2} className="input-padrao w-full resize-none" />
            </Campo>
          </Secao>

          {/* Financeiro */}
          <Secao titulo="Financeiro">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor original"><div className="input-padrao w-full bg-off text-[#6c757d]">{money(Number(f.valor_original ?? 0))}</div></Campo>
              <CampoNum label="Juros" v={f.juros} on={(v) => set("juros", v)} />
              <CampoNum label="Multa" v={f.multa} on={(v) => set("multa", v)} />
              <CampoNum label="Correção monetária" v={f.correcao_monetaria} on={(v) => set("correcao_monetaria", v)} />
              <CampoNum label="Valor atualizado da dívida" v={f.valor_atualizado} on={(v) => set("valor_atualizado", v)} />
              <CampoNum label="Valor negociado" v={f.valor_negociado} on={(v) => set("valor_negociado", v)} />
              <CampoNum label="Valor aprovado" v={f.valor_aprovado} on={(v) => set("valor_aprovado", v)} />
              <Campo label="Economia obtida">
                <div className="input-padrao w-full bg-ok-bg text-ok font-semibold">
                  {f.valor_atualizado != null && f.valor_aprovado != null && f.valor_atualizado !== "" && f.valor_aprovado !== ""
                    ? money(Number(f.valor_atualizado) - Number(f.valor_aprovado)) : "—"}
                </div>
              </Campo>
            </div>
          </Secao>

          {/* Fornecedor */}
          <Secao titulo="Contato do fornecedor">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Pessoa responsável"><input value={f.fornecedor_responsavel ?? ""} onChange={(e) => set("fornecedor_responsavel", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Contato"><input value={f.fornecedor_contato ?? ""} onChange={(e) => set("fornecedor_contato", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="E-mail"><input value={f.fornecedor_email ?? ""} onChange={(e) => set("fornecedor_email", e.target.value)} className="input-padrao w-full" /></Campo>
              <Campo label="Telefone"><input value={f.fornecedor_telefone ?? ""} onChange={(e) => set("fornecedor_telefone", e.target.value)} className="input-padrao w-full" /></Campo>
            </div>
          </Secao>

          <button onClick={salvar} disabled={salvando} className="btn-primario w-full disabled:opacity-50">
            {salvando ? "Salvando..." : "Salvar negociação"}
          </button>

          {/* Histórico de interações */}
          <Secao titulo="Histórico">
            <div className="flex gap-2 mb-3">
              <input value={novaObs} onChange={(e) => setNovaObs(e.target.value)} placeholder="Registrar observação, ligação, e-mail..." className="input-padrao flex-1" />
              <button onClick={adicionarObs} disabled={addingObs || !novaObs.trim()} className="btn-secundario disabled:opacity-40">Adicionar</button>
            </div>
            {interacoes === null ? (
              <div className="text-[12px] text-[#adb5bd]">Carregando...</div>
            ) : interacoes.length === 0 ? (
              <div className="text-[12px] text-[#adb5bd]">Nenhuma interação registrada ainda.</div>
            ) : (
              <div className="space-y-2">
                {interacoes.map((it) => (
                  <div key={it.id} className="border border-linha rounded-lg px-3 py-2">
                    <div className="text-[12.5px] text-[#1a1a1a]">{it.conteudo}</div>
                    <div className="text-[10.5px] text-[#adb5bd] mt-0.5">{new Date(it.em).toLocaleString("pt-BR")} · {it.tipo}{it.origem ? ` · ${it.origem}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </Secao>
        </div>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-[#1a1a1a] mb-3 pb-1.5 border-b border-linha">{titulo}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] text-[#adb5bd] font-medium mb-1">{label}</div>
      {children}
    </label>
  );
}
function CampoNum({ label, v, on }: { label: string; v: any; on: (v: string) => void }) {
  return (
    <Campo label={label}>
      <input type="number" step="0.01" value={v ?? ""} onChange={(e) => on(e.target.value)} className="input-padrao w-full font-mono" />
    </Campo>
  );
}
