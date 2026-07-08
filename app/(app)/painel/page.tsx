import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import { TIPOS } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ANO = 2026;
const MES_ATUAL = 7;

export default async function PainelPage() {
  const supabase = createClient();

  const { data: contas } = await supabase
    .from("contas")
    .select("id, tipo, status, origem")
    .eq("situacao_cadastro", "aprovada");

  const { data: lancJul } = await supabase
    .from("lancamentos")
    .select("conta_id, situacao, contas!inner(tipo)")
    .eq("ano", ANO)
    .eq("mes", MES_ATUAL);

  const { data: lojasEncerradas } = await supabase
    .from("lojas")
    .select("codigo, coban, empresa, cidade, uf, encerrada_em, motivo_encerramento")
    .eq("status", "encerrada")
    .order("encerrada_em", { ascending: false })
    .limit(6);

  const { count: totalLojasEncerradas } = await supabase
    .from("lojas")
    .select("id", { count: "exact", head: true })
    .eq("status", "encerrada");

  const tipos = Object.keys(TIPOS);
  const porTipo = tipos.map((t) => {
    const doTipo = (contas ?? []).filter((c) => c.tipo === t && c.status === "ativo");
    const ativas = doTipo.length;
    const mapear = doTipo.filter((c) => c.origem === "a_definir").length;
    const lanc = (lancJul ?? []).filter((l: any) => l.contas?.tipo === t);
    const aberto = lanc.filter((l) => l.situacao === "pendente").length;
    const lancado = lanc.filter((l) => l.situacao === "lancado").length;
    const pago = lanc.filter((l) => l.situacao === "pago").length;
    return { t, ativas, mapear, aberto, lancado, pago };
  });

  const totAtivas = porTipo.reduce((s, x) => s + x.ativas, 0);
  const totAberto = porTipo.reduce((s, x) => s + x.aberto, 0);
  const totMapear = porTipo.reduce((s, x) => s + x.mapear, 0);
  const totLancado = porTipo.reduce((s, x) => s + x.lancado, 0);

  return (
    <>
      <Topbar eyebrow="Operação" title="Painel" />
      <div className="px-8 py-7 max-w-[1180px] w-full">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
          <Kpi label="Contas ativas" value={totAtivas} sub="em todas as lojas e quiosques" />
          <Kpi label="A lançar em julho" value={totAberto} sub="faturas ainda não lançadas" hl />
          <Kpi label="Aguardando pagamento" value={totLancado} sub="lançadas no SIP" tag="fila" tagCls="bg-amb-bg text-amb" />
          <Kpi label="Origem a mapear" value={totMapear} sub="sem caminho de recebimento" tag="atenção" tagCls="bg-alerr-bg text-alerr" />
          <Link href="/lojas?status=encerrada">
            <Kpi label="Lojas encerradas" value={totalLojasEncerradas ?? 0} sub="clique para ver a lista" tag="fechadas" tagCls="bg-alerr-bg text-alerr" />
          </Link>
        </div>

        <div className="flex items-baseline gap-3 mb-3.5 mt-6">
          <h2 className="font-disp text-[15px] font-semibold">Situação por tipo de conta</h2>
          <span className="text-xs text-txt-3">julho / 2026</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {porTipo.map(({ t, ativas, mapear, aberto, lancado, pago }) => {
            const T = TIPOS[t];
            const feito = lancado + pago;
            const pFeito = ativas ? (feito / ativas) * 100 : 0;
            const pMap = ativas ? (mapear / ativas) * 100 : 0;
            return (
              <Link href={`/contas?tipo=${t}`} key={t}
                className="card p-4 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.05)] transition block">
                <div className="flex items-center gap-3 mb-3.5">
                  <div className="w-[34px] h-[34px] rounded-[9px] grid place-items-center font-disp font-semibold text-white text-sm"
                    style={{ background: T.c }}>{T.n.slice(0, 2)}</div>
                  <div>
                    <div className="font-disp font-semibold text-[13.5px]">{T.n}</div>
                    <div className="text-[11px] text-txt-3">{ativas} contas ativas</div>
                  </div>
                </div>
                <div className="font-disp text-[28px] font-semibold tracking-tight">
                  {aberto}<span className="text-xs text-txt-3 font-body font-normal"> a lançar</span>
                </div>
                <div className="h-1.5 rounded-md bg-linha2 my-3 overflow-hidden flex">
                  <i className="block h-full" style={{ width: `${pFeito}%`, background: T.c }} />
                  <i className="block h-full bg-alerr" style={{ width: `${pMap}%` }} />
                </div>
                <div className="flex gap-4 text-[11.5px] text-txt-2">
                  <div><span className="inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-[1px]" style={{ background: T.c }} />Lançadas <b className="font-mono text-txt">{feito}</b></div>
                  <div><span className="inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-[1px] bg-alerr" />A mapear <b className="font-mono text-txt">{mapear}</b></div>
                </div>
              </Link>
            );
          })}
        </div>

        {(lojasEncerradas ?? []).length > 0 && (
          <>
            <div className="flex items-baseline gap-3 mb-3.5 mt-6">
              <h2 className="font-disp text-[15px] font-semibold">Lojas encerradas recentemente</h2>
              <Link href="/lojas?status=encerrada" className="text-xs text-petroleo hover:underline">ver todas</Link>
            </div>
            <div className="card overflow-hidden">
              <ul>
                {(lojasEncerradas ?? []).map((l: any, i: number) => (
                  <li key={i} className="flex items-center gap-3.5 px-[18px] py-3 border-b border-linha2 last:border-0 text-[13px]">
                    <div className="w-7 h-7 rounded-lg bg-alerr-bg text-alerr grid place-items-center text-[11px] font-semibold font-disp shrink-0">
                      {l.coban?.slice(0, 2) ?? "—"}
                    </div>
                    <div className="min-w-0">
                      <b className="font-semibold">{l.codigo}</b>
                      <small className="block text-txt-3 text-[11px] mt-0.5 truncate">
                        {[l.empresa, l.cidade && l.uf ? `${l.cidade}/${l.uf}` : null].filter(Boolean).join(" · ") || "sem dados adicionais"}
                      </small>
                    </div>
                    <span className="ml-auto text-[11px] text-txt-3 font-mono shrink-0">
                      {l.encerrada_em ? new Date(l.encerrada_em).toLocaleDateString("pt-br") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, sub, hl, tag, tagCls }: {
  label: string; value: number; sub: string; hl?: boolean; tag?: string; tagCls?: string;
}) {
  return (
    <div className={`rounded-[14px] p-4 px-[18px] relative overflow-hidden border ${hl ? "bg-ebano border-ebano" : "bg-white border-linha"}`}>
      {tag && <span className={`badge absolute top-3.5 right-3.5 font-mono !text-[10px] ${tagCls}`}>{tag}</span>}
      <div className={`text-[11.5px] font-medium ${hl ? "text-white/70" : "text-txt-2"}`}>{label}</div>
      <div className={`font-disp text-[34px] font-semibold leading-none mt-2 tracking-tight ${hl ? "text-amarelo" : "text-txt"}`}>{value}</div>
      <div className={`text-[11.5px] mt-1.5 ${hl ? "text-white/40" : "text-txt-3"}`}>{sub}</div>
    </div>
  );
}
