"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIPOS, ORIGENS, type Conta, type Lancamento } from "@/lib/types";
import { money, MES } from "@/lib/format";
import { StatusBadge } from "@/components/badges";

export default function ContasClient({ contas }: { contas: Conta[] }) {
  const params = useSearchParams();
  const [fTipo, setFTipo] = useState<string>(params.get("tipo") ?? "todos");
  const [fCoban, setFCoban] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<Conta | null>(null);

  const filtradas = useMemo(() => {
    return contas.filter((c) => {
      const t = fTipo === "todos" || c.tipo === fTipo;
      const cb = fCoban === "todos" || c.lojas?.coban === fCoban;
      const st = fStatus === "todos" || c.status === fStatus;
      const q =
        busca === "" ||
        (c.lojas?.codigo ?? "").toLowerCase().includes(busca.toLowerCase()) ||
        (c.fornecedor_nome ?? "").toLowerCase().includes(busca.toLowerCase());
      return t && cb && st && q;
    });
  }, [contas, fTipo, fCoban, fStatus, busca]);

  const chips = ["todos", ...Object.keys(TIPOS)];

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {chips.map((t) => (
          <button key={t} onClick={() => setFTipo(t)}
            className={`px-3 py-[7px] rounded-full text-[12.5px] font-medium border transition ${
              fTipo === t ? "bg-ebano text-white border-ebano" : "bg-white text-txt-2 border-linha hover:border-txt-3"
            }`}>
            {t === "todos" ? "Todos os tipos" : TIPOS[t].n}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja ou fornecedor"
            className="border border-linha bg-white px-3 py-2 rounded-[9px] text-[12.5px] w-52 focus:outline-none focus:ring-2 focus:ring-amarelo" />
          <select value={fCoban} onChange={(e) => setFCoban(e.target.value)}
            className="border border-linha bg-white px-3 py-2 rounded-[9px] text-[12.5px] text-txt-2">
            <option value="todos">Todas as praças</option>
            <option>MG</option><option>MS</option><option>SP</option>
            <option value="QUIOSQUE">Quiosque</option><option value="CORP">Corporativo</option>
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
            className="border border-linha bg-white px-3 py-2 rounded-[9px] text-[12.5px] text-txt-2">
            <option value="todos">Ativas e inativas</option>
            <option value="ativo">Só ativas</option><option value="inativo">Só inativas</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Loja", "Tipo", "Fornecedor", "Venc.", "Origem", "Status"].map((h) => (
                <th key={h} className="text-left text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold px-4 py-3 border-b border-linha bg-off">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.id} onClick={() => setAberta(c)} className="cursor-pointer hover:bg-[#FBFAF7] transition">
                <td className="px-4 py-3 border-b border-linha2 text-[13px]">
                  <b className="font-semibold">{c.lojas?.codigo ?? "—"}</b>
                  <small className="block text-txt-3 text-[11px] font-mono mt-0.5">{c.lojas?.coban}</small>
                </td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]">
                  <span className="inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-[1px]" style={{ background: TIPOS[c.tipo]?.c }} />
                  {TIPOS[c.tipo]?.n}
                </td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]">
                  {c.fornecedor_nome ?? "—"}
                  {c.eh_rateio && <span className="text-[10px] font-mono text-amb border border-amb rounded px-1 ml-1.5">RATEIO</span>}
                </td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px] font-mono">{c.dia_vencimento ? `dia ${c.dia_vencimento}` : "—"}</td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]"><span className="badge bg-[#EAF0F1] text-petroleo !font-medium">{ORIGENS[c.origem]}</span></td>
                <td className="px-4 py-3 border-b border-linha2 text-[13px]"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-txt-3">Nenhuma conta com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {aberta && <ContaDrawer conta={aberta} onClose={() => setAberta(null)} />}
    </>
  );
}

function ContaDrawer({ conta, onClose }: { conta: Conta; onClose: () => void }) {
  const supabase = createClient();
  const T = TIPOS[conta.tipo];
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [login, setLogin] = useState<string | null>(null);
  const [senha, setSenha] = useState<string | null>(null);
  const [revelando, setRevelando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("lancamentos").select("ano, mes, valor, situacao")
      .eq("conta_id", conta.id).eq("ano", 2026)
      .then(({ data }) => setLancs((data ?? []) as Lancamento[]));
    supabase.from("credenciais_login").select("login").eq("conta_id", conta.id).maybeSingle()
      .then(({ data }) => setLogin((data as any)?.login ?? "não cadastrado"));
  }, [conta.id]);

  async function revelar() {
    setRevelando(true);
    const { data, error } = await supabase.rpc("credencial_ler", {
      p_conta_id: conta.id, p_motivo: "consulta de fatura",
    });
    setRevelando(false);
    if (error) { setAviso("Sem permissão ou credencial não encontrada."); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setLogin(row?.login ?? login);
    setSenha(row?.senha ?? "(vazia)");
    setAviso("Acesso registrado no log de auditoria.");
  }

  const valores = lancs.filter((l) => l.valor != null).map((l) => Number(l.valor));
  const maxv = Math.max(...valores, 1);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-ebano/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[440px] max-w-[94vw] bg-off border-l border-linha z-50 overflow-y-auto">
        <div className="bg-ebano text-white px-6 pt-5 pb-5">
          <button onClick={onClose} className="float-right bg-[#242424] text-[#bbb] w-[30px] h-[30px] rounded-lg text-base">×</button>
          <div className="text-[10px] tracking-[2px] uppercase text-amarelo font-semibold">{T?.n}{conta.eh_rateio ? " · rateio" : ""}</div>
          <h3 className="font-disp text-[19px] font-semibold mt-1.5">{conta.lojas?.codigo}</h3>
          <div className="text-[#9d9b95] text-[12.5px] font-mono">{conta.lojas?.coban} · {conta.fornecedor_nome}</div>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mb-5">
            <Field label="Vencimento" value={conta.dia_vencimento ? `Todo dia ${conta.dia_vencimento}` : "não definido"} />
            <Field label="Origem" value={ORIGENS[conta.origem]} />
            <Field label="Identificador" value={conta.identificador ?? "—"} mono />
            <Field label="Rateio" value={conta.eh_rateio ? "Dividir antes de lançar" : "Conta integral"} />
          </div>

          {/* cofre */}
          <div className="card p-4 mb-4">
            <div className="flex items-center gap-2 font-disp text-[13px] font-semibold mb-3.5">
              Cofre de acesso
              <span className="ml-auto text-[10px] font-mono text-petroleo bg-[#EAF0F1] px-2 py-0.5 rounded-full">portal do fornecedor</span>
            </div>
            <div className="flex items-center gap-2.5 py-2 border-b border-linha2">
              <span className="text-[11px] text-txt-3 w-14">Login</span>
              <span className="font-mono text-[13px]">{login ?? "..."}</span>
            </div>
            <div className="flex items-center gap-2.5 py-2">
              <span className="text-[11px] text-txt-3 w-14">Senha</span>
              <span className="font-mono text-[13px]" style={{ color: senha ? "#1B6E7E" : undefined }}>{senha ?? "•••••••••"}</span>
              {!senha && (
                <button onClick={revelar} disabled={revelando}
                  className="ml-auto bg-ebano text-white text-[11.5px] px-3 py-1.5 rounded-lg font-medium hover:bg-ebano-2 flex items-center gap-1.5">
                  {revelando ? "..." : "Revelar"}
                </button>
              )}
            </div>
            {aviso && (
              <div className="mt-3 text-[11px] text-amb bg-amb-bg rounded-lg px-3 py-2 leading-snug">{aviso}</div>
            )}
          </div>

          {/* histórico */}
          <div className="card p-4 mb-4">
            <div className="flex items-center gap-2 font-disp text-[13px] font-semibold mb-3.5">
              Lançamentos 2026
              <span className="ml-auto text-[10px] font-mono text-petroleo bg-[#EAF0F1] px-2 py-0.5 rounded-full">{valores.length} meses</span>
            </div>
            <div className="flex items-stretch gap-1 h-[86px]">
              {Array.from({ length: 12 }).map((_, mi) => {
                const l = lancs.find((x) => x.mes === mi + 1);
                const v = l?.valor != null ? Number(l.valor) : null;
                const h = v != null ? Math.max((v / maxv) * 100, 4) : 4;
                const now = mi === 6;
                const bg = v == null ? "#E7E5DF" : now ? "#FFB600" : "#1B6E7E";
                return (
                  <div key={mi} className="flex-1 flex flex-col" title={`${MES[mi]}: ${money(v)}`}>
                    <div className="flex-1 flex items-end">
                      <i className="w-full rounded-t-[3px]" style={{ height: `${h}%`, minHeight: 3, background: bg, display: "block" }} />
                    </div>
                    <span className="text-[9px] text-txt-3 font-mono text-center mt-1.5">{MES[mi][0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold mb-0.5">{label}</div>
      <div className={`text-[13.5px] font-medium ${mono ? "font-mono !font-normal" : ""}`}>{value}</div>
    </div>
  );
}
