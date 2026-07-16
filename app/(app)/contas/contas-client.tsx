"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Loja } from "@/lib/loja-types";
import { TIPOS, ORIGENS } from "@/lib/types";
import { CAMPOS_TIPO } from "@/lib/campos-tipo";
import { useDebounce } from "@/lib/hooks/useDebounce";

const COBANS = ["MG", "MS", "SP", "QUIOSQUE", "CORP"];
const TIPO_PDVS = ["PE", "OP", "QQ", "AC", "PT"];

function StatusBadge({ status }: { status: string }) {
  if (status === "encerrada") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  if (status === "inativo") return <span className="badge bg-[#EEE] text-[#777]">Inativa</span>;
  return <span className="badge bg-ok-bg text-ok">Ativa</span>;
}

export default function LojasClient({ lojas: lojasIniciais, statusInicial, empresas }: { lojas: Loja[]; statusInicial?: string; empresas: { id: string; nome: string }[] }) {
  const supabase = createClient();
  const [lojas, setLojas] = useState(lojasIniciais);
  const [fCoban, setFCoban] = useState("todos");
  const [fStatus, setFStatus] = useState(statusInicial ?? "todos");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 250);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);
  const [aberta, setAberta] = useState<Loja | null>(null);
  const [criando, setCriando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [empresaEmLote, setEmpresaEmLote] = useState("");
  const [aplicandoLote, setAplicandoLote] = useState(false);

  const filtradas = useMemo(() => {
    return lojas.filter((l) => {
      const cb = fCoban === "todos" || l.coban === fCoban;
      const st = fStatus === "todos" || l.status === fStatus;
      const q = buscaDebounced === "" ||
        l.codigo.toLowerCase().includes(buscaDebounced.toLowerCase()) ||
        (l.cidade ?? "").toLowerCase().includes(buscaDebounced.toLowerCase()) ||
        (l.empresa ?? "").toLowerCase().includes(buscaDebounced.toLowerCase());
      return cb && st && q;
    });
  }, [lojas, fCoban, fStatus, buscaDebounced]);

  useEffect(() => { setPagina(1); }, [fCoban, fStatus, buscaDebounced]);

  const totalPaginas = Math.max(Math.ceil(filtradas.length / itensPorPagina), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const visiveis = filtradas.slice(inicio, inicio + itensPorPagina);

  function atualizarNaLista(loja: Loja) {
    setLojas((ls) => (ls.some((l) => l.id === loja.id) ? ls.map((l) => (l.id === loja.id ? loja : l)) : [loja, ...ls]));
    setAberta(loja);
  }

  async function aplicarEmpresaEmLote() {
    if (!empresaEmLote || selecionadas.size === 0) return;
    setAplicandoLote(true);
    const ids = Array.from(selecionadas);
    const { error } = await supabase.from("lojas").update({ empresa_id: empresaEmLote }).in("id", ids);
    setAplicandoLote(false);
    if (error) return;
    setLojas((ls) => ls.map((l) => (selecionadas.has(l.id) ? { ...l, empresa_id: empresaEmLote } : l)));
    setSelecionadas(new Set());
    setEmpresaEmLote("");
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja, cidade ou empresa"
          className="border border-linha bg-white px-3 py-2 rounded-[9px] text-[12.5px] w-64 focus:outline-none focus:ring-2 focus:ring-amarelo" />
        <select value={fCoban} onChange={(e) => setFCoban(e.target.value)}
          className="border border-linha bg-white px-3 py-2 rounded-[9px] text-[12.5px] text-txt-2">
          <option value="todos">Todas as praças</option>
          {COBANS.map((c) => <option key={c} value={c}>{c === "CORP" ? "Corporativo" : c}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
          className="border border-linha bg-white px-3 py-2 rounded-[9px] text-[12.5px] text-txt-2">
          <option value="todos">Todos os status</option>
          <option value="ativo">Só ativas</option>
          <option value="inativo">Só inativas</option>
          <option value="encerrada">Só encerradas</option>
        </select>
        <button onClick={() => setCriando(true)}
          className="ml-auto bg-amarelo text-ebano text-[12.5px] font-semibold px-4 py-2 rounded-[9px] hover:brightness-95">
          + Nova loja
        </button>
      </div>
      <div className="text-[12px] text-txt-3 mb-3">{filtradas.length} de {lojas.length} lojas</div>

      {selecionadas.size > 0 && (
        <div className="flex items-center gap-2.5 mb-3 bg-amb-bg border border-amarelo/40 rounded-lg px-4 py-2.5 flex-wrap">
          <span className="text-[12.5px] font-semibold text-[#1a1a1a]">{selecionadas.size} loja{selecionadas.size > 1 ? "s" : ""} selecionada{selecionadas.size > 1 ? "s" : ""}</span>
          <select value={empresaEmLote} onChange={(e) => setEmpresaEmLote(e.target.value)}
            className="border border-linha bg-white px-3 py-1.5 rounded-md text-[12.5px]">
            <option value="">Escolher empresa...</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <button onClick={aplicarEmpresaEmLote} disabled={!empresaEmLote || aplicandoLote}
            className="btn-primario disabled:opacity-50">
            {aplicandoLote ? "Aplicando..." : "Atribuir empresa"}
          </button>
          <button onClick={() => setSelecionadas(new Set())} className="text-[12.5px] text-txt-2 hover:text-txt ml-auto">
            Limpar seleção
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr>
              <th className="px-4 py-3 border-b border-linha bg-off w-10">
                <input type="checkbox"
                  checked={visiveis.length > 0 && visiveis.every((l) => selecionadas.has(l.id))}
                  onChange={(e) => {
                    setSelecionadas((s) => {
                      const novo = new Set(s);
                      visiveis.forEach((l) => e.target.checked ? novo.add(l.id) : novo.delete(l.id));
                      return novo;
                    });
                  }}
                  className="w-4 h-4" />
              </th>
              {["Loja", "Praça", "Setor", "Empresa", "Cidade/UF", "Status"].map((h) => (
                <th key={h} className="text-left text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold px-4 py-3 border-b border-linha bg-off">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.id} className="hover:bg-[#FBFAF7] transition">
                <td className="px-4 py-3 border-b border-linha2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selecionadas.has(l.id)}
                    onChange={(e) => {
                      setSelecionadas((s) => {
                        const novo = new Set(s);
                        e.target.checked ? novo.add(l.id) : novo.delete(l.id);
                        return novo;
                      });
                    }}
                    className="w-4 h-4" />
                </td>
                <td onClick={() => setAberta(l)} className="cursor-pointer px-4 py-3 border-b border-linha2 text-[13px]"><b className="font-semibold">{l.codigo}</b></td>
                <td onClick={() => setAberta(l)} className="cursor-pointer px-4 py-3 border-b border-linha2 text-[13px] font-mono">{l.coban}</td>
                <td onClick={() => setAberta(l)} className="cursor-pointer px-4 py-3 border-b border-linha2 text-[13px]">{l.setor ?? "—"}</td>
                <td onClick={() => setAberta(l)} className="cursor-pointer px-4 py-3 border-b border-linha2 text-[13px]">{empresaNomePorId(l.empresa_id, empresas) ?? l.empresa ?? "—"}</td>
                <td onClick={() => setAberta(l)} className="cursor-pointer px-4 py-3 border-b border-linha2 text-[13px]">{l.cidade ? `${l.cidade}${l.uf ? "/" + l.uf : ""}` : "—"}</td>
                <td onClick={() => setAberta(l)} className="cursor-pointer px-4 py-3 border-b border-linha2 text-[13px]"><StatusBadge status={l.status} /></td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-txt-3">Nenhuma loja com esses filtros.</td></tr>
            )}
          </tbody>
        </table></div>

        {/* paginação real - evita renderizar as ~200 linhas de uma vez */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-linha2 flex-wrap gap-3">
          <span className="text-[12px] text-txt-3">
            Mostrando {filtradas.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + itensPorPagina, filtradas.length)} de {filtradas.length} lojas
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPagina((p) => Math.max(p - 1, 1))} disabled={paginaSegura === 1}
              className="w-8 h-8 rounded-md border border-linha text-txt-3 disabled:opacity-40 hover:bg-off">‹</button>
            <span className="text-[12.5px] text-txt font-semibold px-2">{paginaSegura} / {totalPaginas}</span>
            <button onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))} disabled={paginaSegura === totalPaginas}
              className="w-8 h-8 rounded-md border border-linha text-txt-3 disabled:opacity-40 hover:bg-off">›</button>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-txt-3">
            Por página
            <select value={itensPorPagina} onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPagina(1); }}
              className="border border-linha rounded-md px-2 py-1.5 text-[12.5px]">
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      {aberta && <LojaDrawer loja={aberta} onClose={() => setAberta(null)} onSalvar={atualizarNaLista} empresas={empresas} />}
      {criando && (
        <NovaLojaDrawer
          empresas={empresas}
          onClose={() => setCriando(false)}
          onCriada={(loja) => { atualizarNaLista(loja); setCriando(false); setAberta(loja); }}
        />
      )}
    </>
  );
}

/* ---------------- formulário institucional reutilizado ---------------- */
type FormInst = {
  setor: string; empresa: string; cnpj: string; contrato: string;
  endereco: string; cidade: string; uf: string; responsavel: string; contato: string;
};
const CAMPOS_VAZIOS: FormInst = { setor: "", empresa: "", cnpj: "", contrato: "", endereco: "", cidade: "", uf: "", responsavel: "", contato: "" };

function CamposInstitucionais({ form, set, empresas, empresaId, setEmpresaId }: {
  form: FormInst; set: <K extends keyof FormInst>(k: K, v: string) => void;
  empresas: { id: string; nome: string }[]; empresaId: string; setEmpresaId: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <LabeledInput label="Setor" value={form.setor} onChange={(v) => set("setor", v)} placeholder="Varejo, Administrativo..." />
      <label>
        <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Empresa</div>
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}
          className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
          <option value="">— nenhuma —</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>
      <LabeledInput label="CNPJ" value={form.cnpj} onChange={(v) => set("cnpj", v)} mono />
      <LabeledInput label="Observação de contrato" value={form.contrato} onChange={(v) => set("contrato", v)} placeholder="nota livre, opcional" />
      <LabeledInput label="Cidade" value={form.cidade} onChange={(v) => set("cidade", v)} />
      <LabeledInput label="UF" value={form.uf} onChange={(v) => set("uf", v)} />
      <LabeledInput label="Endereço" value={form.endereco} onChange={(v) => set("endereco", v)} full />
      <LabeledInput label="Responsável" value={form.responsavel} onChange={(v) => set("responsavel", v)} />
      <LabeledInput label="Contato" value={form.contato} onChange={(v) => set("contato", v)} mono />
    </div>
  );
}

/* ---------------- criar loja nova ---------------- */
function NovaLojaDrawer({ onClose, onCriada, empresas }: { onClose: () => void; onCriada: (l: Loja) => void; empresas: { id: string; nome: string }[] }) {
  const supabase = createClient();
  const [codigo, setCodigo] = useState("");
  const [coban, setCoban] = useState("MG");
  const [tipoPdv, setTipoPdv] = useState("PE");
  const [empresaId, setEmpresaId] = useState("");
  const [form, setForm] = useState<FormInst>(CAMPOS_VAZIOS);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<Loja | null>(null);

  function set<K extends keyof FormInst>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function criar() {
    if (!codigo.trim()) { setErro("Informe o código da loja."); return; }
    setSalvando(true);
    setErro(null);
    const payload = {
      codigo: codigo.trim(), coban, tipo_pdv: tipoPdv, empresa_id: empresaId || null,
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()])),
    };
    const { data, error } = await supabase.from("lojas").insert(payload).select().single();
    setSalvando(false);
    if (error) { setErro(error.message.includes("duplicate") ? "Já existe uma loja com esse código." : "Não foi possível criar a loja."); return; }
    setCriada(data as Loja);
  }

  if (criada) {
    return (
      <>
        <div onClick={() => onCriada(criada)} className="fixed inset-0 bg-ebano/40 z-40" />
        <aside className="fixed top-0 right-0 h-screen w-[460px] max-w-[94vw] bg-off border-l border-linha z-50 overflow-y-auto">
          <div className="bg-ebano text-white px-6 pt-5 pb-5">
            <button onClick={() => onCriada(criada)} className="float-right bg-ebano-3 text-[#bbb] w-[30px] h-[30px] rounded-lg text-base">×</button>
            <div className="text-[10px] tracking-[2px] uppercase text-amarelo font-semibold">Loja criada</div>
            <h3 className="font-disp text-[19px] font-semibold mt-1.5">{criada.codigo}</h3>
          </div>
          <div className="px-6 py-5">
            <div className="text-[12.5px] text-txt-2 mb-4 leading-snug">
              Agora vincule as contas de consumo dela (água, energia, telefone...) e, se for o caso, o contrato ligado a ela.
            </div>
            <ContasVinculadas loja={criada} />
            <ContratosVinculados lojaId={criada.id} lojaCodigo={criada.codigo} />
            <button onClick={() => onCriada(criada)}
              className="w-full mt-4 bg-ebano text-white rounded-[9px] py-2.5 text-[12.5px] font-semibold">
              Concluir
            </button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-ebano/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[460px] max-w-[94vw] bg-off border-l border-linha z-50 overflow-y-auto">
        <div className="bg-ebano text-white px-6 pt-5 pb-5">
          <button onClick={onClose} className="float-right bg-ebano-3 text-[#bbb] w-[30px] h-[30px] rounded-lg text-base">×</button>
          <div className="text-[10px] tracking-[2px] uppercase text-amarelo font-semibold">Nova loja</div>
          <h3 className="font-disp text-[19px] font-semibold mt-1.5">Cadastrar loja</h3>
        </div>
        <div className="px-6 py-5">
          <div className="card p-4 mb-4">
            <div className="font-disp text-[13px] font-semibold mb-3.5">Identificação</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <LabeledInput label="Código da loja" value={codigo} onChange={setCodigo} full placeholder="MG 999 PE Nome da Cidade" />
              <label>
                <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Praça</div>
                <select value={coban} onChange={(e) => setCoban(e.target.value)}
                  className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
                  {COBANS.map((c) => <option key={c} value={c}>{c === "CORP" ? "Corporativo" : c}</option>)}
                </select>
              </label>
              <label>
                <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Tipo</div>
                <select value={tipoPdv} onChange={(e) => setTipoPdv(e.target.value)}
                  className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
                  {TIPO_PDVS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="card p-4">
            <div className="font-disp text-[13px] font-semibold mb-3.5">Dados institucionais <span className="text-txt-3 font-normal text-[11px]">(opcional)</span></div>
            <CamposInstitucionais form={form} set={set} empresas={empresas} empresaId={empresaId} setEmpresaId={setEmpresaId} />
          </div>

          {erro && <div className="mt-3 text-[12px] text-alerr bg-alerr-bg rounded-lg px-3 py-2">{erro}</div>}

          <button onClick={criar} disabled={salvando}
            className="w-full mt-4 bg-amarelo text-ebano rounded-[9px] py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
            {salvando ? "Criando..." : "Criar loja e vincular contas"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ---------------- ficha de loja existente ---------------- */
function LojaDrawer({ loja, onClose, onSalvar, empresas }: { loja: Loja; onClose: () => void; onSalvar: (l: Loja) => void; empresas: { id: string; nome: string }[] }) {
  const supabase = createClient();
  const [codigo, setCodigo] = useState(loja.codigo);
  const [coban, setCoban] = useState(loja.coban);
  const [tipoPdv, setTipoPdv] = useState(loja.tipo_pdv ?? "PE");
  const [status, setStatus] = useState<"ativo" | "inativo">(loja.status === "inativo" ? "inativo" : "ativo");
  const [empresaId, setEmpresaId] = useState(loja.empresa_id ?? "");
  const [form, setForm] = useState<FormInst>({
    setor: loja.setor ?? "", empresa: loja.empresa ?? "", cnpj: loja.cnpj ?? "",
    contrato: loja.contrato ?? "", endereco: loja.endereco ?? "", cidade: loja.cidade ?? "",
    uf: loja.uf ?? "", responsavel: loja.responsavel ?? "", contato: loja.contato ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [reativando, setReativando] = useState(false);

  function set<K extends keyof FormInst>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function salvar() {
    if (!codigo.trim()) { setErro("O código da loja não pode ficar em branco."); return; }
    setSalvando(true);
    setErro(null);
    const institucional = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]));
    const payload: Partial<Loja> = { codigo: codigo.trim(), coban, tipo_pdv: tipoPdv, empresa_id: empresaId || null, ...institucional };
    if (loja.status !== "encerrada") payload.status = status;
    const { error } = await supabase.from("lojas").update(payload).eq("id", loja.id);
    setSalvando(false);
    if (error) { setErro(error.message.includes("duplicate") ? "Já existe uma loja com esse código." : "Sem permissão para salvar."); return; }
    onSalvar({ ...loja, ...payload } as Loja);
    setAviso("Dados salvos.");
    setTimeout(() => setAviso(null), 2000);
  }

  async function confirmarEncerramento() {
    if (!motivo.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from("lojas")
      .update({ status: "encerrada", motivo_encerramento: motivo.trim() })
      .eq("id", loja.id);
    setSalvando(false);
    if (error) { setAviso("Sem permissão para encerrar esta loja."); return; }
    onSalvar({ ...loja, status: "encerrada", motivo_encerramento: motivo.trim() });
    setEncerrando(false);
  }

  async function reativar() {
    setReativando(true);
    const { error } = await supabase.from("lojas")
      .update({ status: "ativo", motivo_encerramento: null })
      .eq("id", loja.id);
    setReativando(false);
    if (error) { setAviso("Sem permissão para reativar esta loja."); return; }
    setStatus("ativo");
    onSalvar({ ...loja, status: "ativo", motivo_encerramento: null });
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-ebano/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[460px] max-w-[94vw] bg-off border-l border-linha z-50 overflow-y-auto">
        <div className="bg-ebano text-white px-6 pt-5 pb-5">
          <button onClick={onClose} className="float-right bg-ebano-3 text-[#bbb] w-[30px] h-[30px] rounded-lg text-base">×</button>
          <div className="text-[10px] tracking-[2px] uppercase text-amarelo font-semibold">{loja.coban}{loja.tipo_pdv ? ` · ${loja.tipo_pdv}` : ""}</div>
          <h3 className="font-disp text-[19px] font-semibold mt-1.5">{loja.codigo}</h3>
        </div>

        <div className="px-6 py-5">
          {loja.status === "encerrada" && (
            <div className="mb-4 text-[12px] text-alerr bg-alerr-bg rounded-lg px-3 py-2.5 leading-snug">
              <b className="block font-semibold mb-0.5">Loja encerrada</b>
              {loja.motivo_encerramento ?? "Sem motivo registrado."}
              <button onClick={reativar} disabled={reativando}
                className="block mt-2.5 text-[12px] font-semibold text-alerr underline hover:no-underline disabled:opacity-50">
                {reativando ? "Reativando..." : "Reativar loja"}
              </button>
            </div>
          )}

          <div className="card p-4 mb-4">
            <div className="font-disp text-[13px] font-semibold mb-3.5">Identificação</div>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Código da loja" value={codigo} onChange={setCodigo} full />
              <label>
                <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Praça</div>
                <select value={coban} onChange={(e) => setCoban(e.target.value)}
                  className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
                  {COBANS.map((c) => <option key={c} value={c}>{c === "CORP" ? "Corporativo" : c}</option>)}
                </select>
              </label>
              <label>
                <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Tipo</div>
                <select value={tipoPdv} onChange={(e) => setTipoPdv(e.target.value)}
                  className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
                  {TIPO_PDVS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              {loja.status !== "encerrada" && (
                <label>
                  <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Status</div>
                  <select value={status} onChange={(e) => setStatus(e.target.value as "ativo" | "inativo")}
                    className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
                    <option value="ativo">Ativa</option>
                    <option value="inativo">Inativa</option>
                  </select>
                </label>
              )}
            </div>
          </div>

          <div className="card p-4 mb-4">
            <div className="font-disp text-[13px] font-semibold mb-3.5">Dados institucionais</div>
            <CamposInstitucionais form={form} set={set} empresas={empresas} empresaId={empresaId} setEmpresaId={setEmpresaId} />
            {erro && <div className="mt-3 text-[12px] text-alerr bg-alerr-bg rounded-lg px-3 py-2">{erro}</div>}
            <button onClick={salvar} disabled={salvando}
              className="w-full mt-4 bg-amarelo text-ebano rounded-[9px] py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
            {aviso && <div className="mt-2.5 text-[11.5px] text-txt-2">{aviso}</div>}
          </div>

          <ContasVinculadas loja={loja} />

          <ContratosVinculados lojaId={loja.id} lojaCodigo={loja.codigo} />

          {loja.status !== "encerrada" && (
            <div className="card p-4 mt-4">
              {!encerrando ? (
                <button onClick={() => setEncerrando(true)}
                  className="w-full text-[12.5px] font-semibold text-alerr border border-alerr/30 bg-alerr-bg rounded-[9px] py-2.5 hover:bg-alerr/10 transition">
                  Encerrar loja
                </button>
              ) : (
                <div>
                  <div className="font-disp text-[13px] font-semibold mb-2">Motivo do encerramento</div>
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: loja fechou, contrato encerrado..."
                    className="w-full border border-linha rounded-[9px] px-3 py-2 text-[13px] mb-3 focus:outline-none focus:ring-2 focus:ring-amarelo" rows={3} />
                  <div className="flex gap-2">
                    <button onClick={confirmarEncerramento} disabled={!motivo.trim() || salvando}
                      className="flex-1 bg-alerr text-white rounded-[9px] py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
                      {salvando ? "Encerrando..." : "Confirmar encerramento"}
                    </button>
                    <button onClick={() => { setEncerrando(false); setMotivo(""); }}
                      className="bg-white border border-linha text-txt-2 rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/* ---------------- contas vinculadas (listar + adicionar) ---------------- */
type ContaResumo = {
  id: string; tipo: string; fornecedor_nome: string | null; dia_vencimento: number | null;
  origem: string; status: string; nLanc: number;
};

function ContasVinculadas({ loja }: { loja: Loja }) {
  const supabase = createClient();
  const [contas, setContas] = useState<ContaResumo[] | null>(null);
  const [addAberto, setAddAberto] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const { data } = await supabase.from("contas")
      .select("id, tipo, fornecedor_nome, dia_vencimento, origem, status")
      .eq("loja_id", loja.id)
      .order("tipo");
    const lista = (data ?? []) as Omit<ContaResumo, "nLanc">[];
    // conta quantos lançamentos cada conta tem, pra saber qual duplicata está vazia
    const counts: Record<string, number> = {};
    if (lista.length) {
      const { data: lancs } = await supabase.from("lancamentos")
        .select("conta_id").in("conta_id", lista.map((c) => c.id));
      (lancs ?? []).forEach((l: { conta_id: string }) => {
        counts[l.conta_id] = (counts[l.conta_id] ?? 0) + 1;
      });
    }
    setContas(lista.map((c) => ({ ...c, nLanc: counts[c.id] ?? 0 })));
  }

  useEffect(() => { carregar(); }, [loja.id]);

  async function excluirConta(id: string) {
    setExcluindo(id); setErro(null);
    // remove os lançamentos primeiro (FK), depois a conta
    const del1 = await supabase.from("lancamentos").delete().eq("conta_id", id);
    if (del1.error) { setExcluindo(null); setErro("Não consegui remover os lançamentos da conta."); return; }
    const del2 = await supabase.from("contas").delete().eq("id", id);
    if (del2.error) { setExcluindo(null); setErro("Não consegui remover a conta (verifique suas permissões)."); return; }
    setExcluindo(null); setConfirmar(null);
    carregar();
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 font-disp text-[13px] font-semibold mb-3.5">
        Contas vinculadas
        <span className="ml-auto text-[10px] font-mono text-info bg-info-bg px-2 py-0.5 rounded-full">
          {contas ? contas.length : "..."}
        </span>
      </div>

      {contas && contas.length === 0 && !addAberto && (
        <div className="text-[12.5px] text-txt-3 mb-3">Nenhuma conta vinculada ainda.</div>
      )}

      {erro && <div className="mb-2.5 text-[12px] text-alerr bg-alerr-bg rounded-lg px-3 py-2">{erro}</div>}

      {contas && contas.map((c) => {
        const T = TIPOS[c.tipo];
        const emConfirmacao = confirmar === c.id;
        return (
          <div key={c.id} className="flex items-center gap-2.5 py-2 border-b border-linha2 last:border-0 text-[13px]">
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: T?.c }} />
            <b className="font-medium">{T?.n ?? c.tipo}</b>
            <span className="text-txt-3 truncate">{c.fornecedor_nome ?? "sem fornecedor"}</span>
            <span className="ml-auto text-[11px] text-txt-3 font-mono shrink-0">{c.dia_vencimento ? `dia ${c.dia_vencimento}` : "—"}</span>
            {emConfirmacao ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10.5px] text-txt-3">{c.nLanc > 0 ? `apaga ${c.nLanc} lanç.` : "Excluir?"}</span>
                <button onClick={() => excluirConta(c.id)} disabled={excluindo === c.id}
                  className="text-[11px] font-semibold text-alerr px-1.5 py-0.5 rounded hover:bg-alerr-bg disabled:opacity-50">
                  {excluindo === c.id ? "..." : "Sim"}
                </button>
                <button onClick={() => setConfirmar(null)}
                  className="text-[11px] text-txt-3 px-1.5 py-0.5 rounded hover:bg-linha2">Não</button>
              </div>
            ) : (
              <button onClick={() => { setConfirmar(c.id); setErro(null); }} title="Remover conta"
                className="shrink-0 text-txt-3 hover:text-alerr transition p-1 -mr-1 rounded">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m2 0v10.5A1.5 1.5 0 0112.5 18h-5A1.5 1.5 0 016 16.5V6" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {!addAberto ? (
        <button onClick={() => setAddAberto(true)}
          className="w-full mt-3 text-[12.5px] font-semibold text-info border border-info/30 bg-info-bg rounded-md py-2.5 hover:bg-info/10 transition">
          + Adicionar conta
        </button>
      ) : (
        <NovaContaForm lojaId={loja.id} onCriada={() => { setAddAberto(false); carregar(); }} onCancelar={() => setAddAberto(false)} />
      )}
    </div>
  );
}

function ContratosVinculados({ lojaId, lojaCodigo }: { lojaId: string; lojaCodigo: string }) {
  const supabase = createClient();
  const [contratos, setContratos] = useState<{ id: string; numero: string; status: string; valor: number | null }[] | null>(null);

  useEffect(() => {
    supabase.from("contratos").select("id, numero, status, valor").eq("loja_id", lojaId).order("created_at", { ascending: false })
      .then(({ data }) => setContratos((data ?? []) as any[]));
  }, [lojaId]);

  const STATUS_CLS: Record<string, string> = { ativo: "bg-ok-bg text-ok", encerrado: "bg-alerr-bg text-alerr", suspenso: "bg-amb-bg text-[#c9922a]" };

  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center gap-2 font-disp text-[13px] font-semibold mb-3.5">
        Contratos vinculados
        <span className="ml-auto text-[10px] font-mono text-info bg-info-bg px-2 py-0.5 rounded-full">
          {contratos ? contratos.length : "..."}
        </span>
      </div>
      {contratos && contratos.length === 0 && (
        <div className="text-[12.5px] text-txt-3 mb-3">Nenhum contrato vinculado ainda.</div>
      )}
      {contratos && contratos.map((c) => (
        <div key={c.id} className="flex items-center gap-2.5 py-2 border-b border-linha2 last:border-0 text-[13px]">
          <span className="font-mono font-medium">{c.numero}</span>
          <span className={`badge ${STATUS_CLS[c.status] ?? ""}`}>{c.status}</span>
          <span className="ml-auto text-txt-3 font-mono text-[12px]">{c.valor ? `R$ ${Number(c.valor).toLocaleString("pt-br", { minimumFractionDigits: 2 })}` : "—"}</span>
        </div>
      ))}
      <a href={`/contratos?loja=${encodeURIComponent(lojaCodigo)}`}
        className="block w-full mt-3 text-center text-[12.5px] font-semibold text-info border border-info/30 bg-info-bg rounded-md py-2.5 hover:bg-info/10 transition">
        + Gerenciar contratos em /contratos
      </a>
    </div>
  );
}

function NovaContaForm({ lojaId, onCriada, onCancelar }: { lojaId: string; onCriada: () => void; onCancelar: () => void }) {
  const supabase = createClient();
  const [tipo, setTipo] = useState("agua");
  const [fornecedor, setFornecedor] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [venc, setVenc] = useState("");
  const [origem, setOrigem] = useState("a_definir");
  const [rateio, setRateio] = useState(false);
  const [divisor, setDivisor] = useState("2");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase.from("contas").insert({
      loja_id: lojaId, tipo, fornecedor_nome: fornecedor.trim() || null,
      identificador: identificador.trim() || null,
      dia_vencimento: venc ? Number(venc) : null,
      origem, eh_rateio: rateio, rateio_divisor: rateio ? Number(divisor) : null,
      situacao_cadastro: "aprovada", status: "ativo",
    }).select().single();

    if (error) { setSalvando(false); setErro("Não foi possível salvar a conta."); return; }

    if (login.trim() || senha.trim()) {
      await supabase.rpc("credencial_salvar", {
        p_conta_id: data.id, p_login: login.trim() || null, p_senha: senha.trim() || null,
      });
    }
    setSalvando(false);
    onCriada();
  }

  return (
    <div className="mt-3 pt-3 border-t border-linha2">
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <label>
          <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Tipo</div>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
          </select>
        </label>
        <label>
          <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">Origem</div>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px]">
            {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <LabeledInput label="Fornecedor" value={fornecedor} onChange={setFornecedor} placeholder={CAMPOS_TIPO[tipo]?.placeholderFornecedor} />
        <LabeledInput label={CAMPOS_TIPO[tipo]?.labelIdentificador ?? "Identificador"} value={identificador} onChange={setIdentificador} placeholder={CAMPOS_TIPO[tipo]?.placeholderIdentificador} mono />
        <LabeledInput label="Dia de vencimento" value={venc} onChange={setVenc} placeholder="1-31" />
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" checked={rateio} onChange={(e) => setRateio(e.target.checked)} className="w-4 h-4" />
          <span className="text-[12.5px] text-txt-2">É rateio</span>
          {rateio && (
            <input value={divisor} onChange={(e) => setDivisor(e.target.value)} placeholder="/2"
              className="w-14 border border-linha rounded-[8px] px-2 py-1 text-[12.5px] ml-1" />
          )}
        </label>
        <LabeledInput label="Login do portal" value={login} onChange={setLogin} mono />
        <LabeledInput label="Senha do portal" value={senha} onChange={setSenha} mono />
      </div>
      <div className="text-[10.5px] text-txt-3 mb-2.5 leading-snug">A senha vai direto para o cofre criptografado, nunca fica salva em texto.</div>
      {erro && <div className="mb-2.5 text-[12px] text-alerr bg-alerr-bg rounded-lg px-3 py-2">{erro}</div>}
      <div className="flex gap-2">
        <button onClick={salvar} disabled={salvando}
          className="flex-1 bg-info text-white rounded-md py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
          {salvando ? "Salvando..." : "Adicionar conta"}
        </button>
        <button onClick={onCancelar} className="bg-white border border-linha text-txt-2 rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, mono, full, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; mono?: boolean; full?: boolean; placeholder?: string;
}) {
  return (
    <label className={full ? "col-span-2" : ""}>
      <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full border border-linha rounded-[8px] px-2.5 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amarelo ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

function empresaNomePorId(id: string | null | undefined, empresas: { id: string; nome: string }[]): string | null {
  if (!id) return null;
  return empresas.find((e) => e.id === id)?.nome ?? null;
}
