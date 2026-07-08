"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Loja } from "@/lib/loja-types";
import { TIPOS, ORIGENS } from "@/lib/types";

const COBANS = ["MG", "MS", "SP", "QUIOSQUE", "CORP"];
const TIPO_PDVS = ["PE", "OP", "QQ", "AC", "PT"];

function StatusBadge({ status }: { status: string }) {
  if (status === "encerrada") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  if (status === "inativo") return <span className="badge bg-[#EEE] text-[#777]">Inativa</span>;
  return <span className="badge bg-ok-bg text-ok">Ativa</span>;
}

export default function LojasClient({ lojas: lojasIniciais, statusInicial }: { lojas: Loja[]; statusInicial?: string }) {
  const [lojas, setLojas] = useState(lojasIniciais);
  const [fCoban, setFCoban] = useState("todos");
  const [fStatus, setFStatus] = useState(statusInicial ?? "todos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<Loja | null>(null);
  const [criando, setCriando] = useState(false);

  const filtradas = useMemo(() => {
    return lojas.filter((l) => {
      const cb = fCoban === "todos" || l.coban === fCoban;
      const st = fStatus === "todos" || l.status === fStatus;
      const q = busca === "" ||
        l.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        (l.cidade ?? "").toLowerCase().includes(busca.toLowerCase()) ||
        (l.empresa ?? "").toLowerCase().includes(busca.toLowerCase());
      return cb && st && q;
    });
  }, [lojas, fCoban, fStatus, busca]);

  function atualizarNaLista(loja: Loja) {
    setLojas((ls) => (ls.some((l) => l.id === loja.id) ? ls.map((l) => (l.id === loja.id ? loja : l)) : [loja, ...ls]));
    setAberta(loja);
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

      <div className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Loja", "Praça", "Setor", "Empresa", "Cidade/UF", "Status"].map((h) => (
                <th key={h} className="text-left text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold px-4 py-3 border-b border-linha bg-off">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.id} onClick={() => setAberta(l)} className="cursor-pointer hover:bg-[#FBFAF7] transition">
                <td className="px-4 py-3 border-b border-linha2 text-[13px]"><b className="font-semibold">{l.codigo}</b></td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px] font-mono">{l.coban}</td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]">{l.setor ?? "—"}</td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]">{l.empresa ?? "—"}</td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]">{l.cidade ? `${l.cidade}${l.uf ? "/" + l.uf : ""}` : "—"}</td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]"><StatusBadge status={l.status} /></td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-txt-3">Nenhuma loja com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {aberta && <LojaDrawer loja={aberta} onClose={() => setAberta(null)} onSalvar={atualizarNaLista} />}
      {criando && (
        <NovaLojaDrawer
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

function CamposInstitucionais({ form, set }: { form: FormInst; set: <K extends keyof FormInst>(k: K, v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <LabeledInput label="Setor" value={form.setor} onChange={(v) => set("setor", v)} placeholder="Varejo, Administrativo..." />
      <LabeledInput label="Empresa" value={form.empresa} onChange={(v) => set("empresa", v)} placeholder="Grupo Potencial..." />
      <LabeledInput label="CNPJ" value={form.cnpj} onChange={(v) => set("cnpj", v)} mono />
      <LabeledInput label="Contrato" value={form.contrato} onChange={(v) => set("contrato", v)} />
      <LabeledInput label="Cidade" value={form.cidade} onChange={(v) => set("cidade", v)} />
      <LabeledInput label="UF" value={form.uf} onChange={(v) => set("uf", v)} />
      <LabeledInput label="Endereço" value={form.endereco} onChange={(v) => set("endereco", v)} full />
      <LabeledInput label="Responsável" value={form.responsavel} onChange={(v) => set("responsavel", v)} />
      <LabeledInput label="Contato" value={form.contato} onChange={(v) => set("contato", v)} mono />
    </div>
  );
}

/* ---------------- criar loja nova ---------------- */
function NovaLojaDrawer({ onClose, onCriada }: { onClose: () => void; onCriada: (l: Loja) => void }) {
  const supabase = createClient();
  const [codigo, setCodigo] = useState("");
  const [coban, setCoban] = useState("MG");
  const [tipoPdv, setTipoPdv] = useState("PE");
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
      codigo: codigo.trim(), coban, tipo_pdv: tipoPdv,
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
            <button onClick={() => onCriada(criada)} className="float-right bg-[#242424] text-[#bbb] w-[30px] h-[30px] rounded-lg text-base">×</button>
            <div className="text-[10px] tracking-[2px] uppercase text-amarelo font-semibold">Loja criada</div>
            <h3 className="font-disp text-[19px] font-semibold mt-1.5">{criada.codigo}</h3>
          </div>
          <div className="px-6 py-5">
            <div className="text-[12.5px] text-txt-2 mb-4 leading-snug">
              Agora vincule as contas de consumo dela, água, energia, telefone e o que mais precisar.
            </div>
            <ContasVinculadas loja={criada} />
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
          <button onClick={onClose} className="float-right bg-[#242424] text-[#bbb] w-[30px] h-[30px] rounded-lg text-base">×</button>
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
            <CamposInstitucionais form={form} set={set} />
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
function LojaDrawer({ loja, onClose, onSalvar }: { loja: Loja; onClose: () => void; onSalvar: (l: Loja) => void }) {
  const supabase = createClient();
  const [form, setForm] = useState<FormInst>({
    setor: loja.setor ?? "", empresa: loja.empresa ?? "", cnpj: loja.cnpj ?? "",
    contrato: loja.contrato ?? "", endereco: loja.endereco ?? "", cidade: loja.cidade ?? "",
    uf: loja.uf ?? "", responsavel: loja.responsavel ?? "", contato: loja.contato ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [motivo, setMotivo] = useState("");

  function set<K extends keyof FormInst>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function salvar() {
    setSalvando(true);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]));
    const { error } = await supabase.from("lojas").update(payload).eq("id", loja.id);
    setSalvando(false);
    if (error) { setAviso("Sem permissão para salvar."); return; }
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

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-ebano/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[460px] max-w-[94vw] bg-off border-l border-linha z-50 overflow-y-auto">
        <div className="bg-ebano text-white px-6 pt-5 pb-5">
          <button onClick={onClose} className="float-right bg-[#242424] text-[#bbb] w-[30px] h-[30px] rounded-lg text-base">×</button>
          <div className="text-[10px] tracking-[2px] uppercase text-amarelo font-semibold">{loja.coban}{loja.tipo_pdv ? ` · ${loja.tipo_pdv}` : ""}</div>
          <h3 className="font-disp text-[19px] font-semibold mt-1.5">{loja.codigo}</h3>
        </div>

        <div className="px-6 py-5">
          {loja.status === "encerrada" && (
            <div className="mb-4 text-[12px] text-alerr bg-alerr-bg rounded-lg px-3 py-2.5 leading-snug">
              <b className="block font-semibold mb-0.5">Loja encerrada</b>
              {loja.motivo_encerramento ?? "Sem motivo registrado."}
            </div>
          )}

          <div className="card p-4 mb-4">
            <div className="font-disp text-[13px] font-semibold mb-3.5">Dados institucionais</div>
            <CamposInstitucionais form={form} set={set} />
            <button onClick={salvar} disabled={salvando}
              className="w-full mt-4 bg-amarelo text-ebano rounded-[9px] py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar dados"}
            </button>
            {aviso && <div className="mt-2.5 text-[11.5px] text-txt-2">{aviso}</div>}
          </div>

          <ContasVinculadas loja={loja} />

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
  origem: string; status: string;
};

function ContasVinculadas({ loja }: { loja: Loja }) {
  const supabase = createClient();
  const [contas, setContas] = useState<ContaResumo[] | null>(null);
  const [addAberto, setAddAberto] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("contas")
      .select("id, tipo, fornecedor_nome, dia_vencimento, origem, status")
      .eq("loja_id", loja.id)
      .order("tipo");
    setContas((data ?? []) as ContaResumo[]);
  }

  useEffect(() => { carregar(); }, [loja.id]);

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

      {contas && contas.map((c) => {
        const T = TIPOS[c.tipo];
        return (
          <div key={c.id} className="flex items-center gap-2.5 py-2 border-b border-linha2 last:border-0 text-[13px]">
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: T?.c }} />
            <b className="font-medium">{T?.n ?? c.tipo}</b>
            <span className="text-txt-3">{c.fornecedor_nome ?? "sem fornecedor"}</span>
            <span className="ml-auto text-[11px] text-txt-3 font-mono">{c.dia_vencimento ? `dia ${c.dia_vencimento}` : "—"}</span>
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
        <LabeledInput label="Fornecedor" value={fornecedor} onChange={setFornecedor} placeholder="SABESP, CEMIG..." />
        <LabeledInput label="Identificador" value={identificador} onChange={setIdentificador} mono />
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
