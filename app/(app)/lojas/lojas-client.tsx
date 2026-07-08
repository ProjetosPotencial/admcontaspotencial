"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Loja } from "@/lib/loja-types";

const COBANS = ["MG", "MS", "SP", "QUIOSQUE", "CORP"];

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
    setLojas((ls) => ls.map((l) => (l.id === loja.id ? loja : l)));
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
        <span className="ml-auto text-[12px] text-txt-3">{filtradas.length} de {lojas.length} lojas</span>
      </div>

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
    </>
  );
}

function LojaDrawer({ loja, onClose, onSalvar }: { loja: Loja; onClose: () => void; onSalvar: (l: Loja) => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    setor: loja.setor ?? "", empresa: loja.empresa ?? "", cnpj: loja.cnpj ?? "",
    contrato: loja.contrato ?? "", endereco: loja.endereco ?? "", cidade: loja.cidade ?? "",
    uf: loja.uf ?? "", responsavel: loja.responsavel ?? "", contato: loja.contato ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [motivo, setMotivo] = useState("");

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

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
            <button onClick={salvar} disabled={salvando}
              className="w-full mt-4 bg-amarelo text-ebano rounded-[9px] py-2.5 text-[12.5px] font-semibold disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar dados"}
            </button>
            {aviso && <div className="mt-2.5 text-[11.5px] text-txt-2">{aviso}</div>}
          </div>

          {loja.status !== "encerrada" && (
            <div className="card p-4">
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
