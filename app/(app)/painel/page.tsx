import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import TipoIcon from "@/components/tipo-icon";
import { TIPOS } from "@/lib/types";
import { obterPeriodoAtual, formatarPeriodo, estaAtrasada, variacaoPct } from "@/lib/date-utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const supabase = createClient();

  // Obtém o período atual dinamicamente
  const { ano, mes, mesAnterior, anoAnterior } = obterPeriodoAtual();

  const [
    { data: contas },
    { data: lancamentos },
    { data: lojasEncerradas },
    { count: totalLojasEncerradas },
    { data: metricaAnterior },
  ] = await Promise.all([
    supabase
      .from("contas")
      .select("id, tipo, status, origem, dia_vencimento")
      .eq("situacao_cadastro", "aprovada"),
    supabase
      .from("lancamentos")
      .select("conta_id, situacao, contas!inner(tipo, dia_vencimento)")
      .eq("ano", ano)
      .eq("mes", mes),
    supabase
      .from("lojas")
      .select("codigo, coban, empresa, cidade, uf, encerrada_em")
      .eq("status", "encerrada")
      .order("encerrada_em", { ascending: false })
      .limit(6),
    supabase
      .from("lojas")
      .select("id", { count: "exact", head: true })
      .eq("status", "encerrada"),
    supabase
      .from("metricas_mensais")
      .select("contas_ativas, a_lancar, aguardando_pagamento, origem_a_mapear")
      .eq("ano", anoAnterior)
      .eq("mes", mesAnterior)
      .maybeSingle(),
  ]);

  // Calcula métricas por tipo de conta
  const tipos = Object.keys(TIPOS);
  const porTipo = tipos.map((t) => {
    const doTipo = (contas ?? []).filter((c) => c.tipo === t && c.status === "ativo");
    const ativas = doTipo.length;
    const mapear = doTipo.filter((c) => c.origem === "a_definir").length;
    const lanc = (lancamentos ?? []).filter((l: any) => l.contas?.tipo === t);
    const atrasadas = lanc.filter((l: any) =>
      estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano)
    ).length;
    const pagas = lanc.filter((l) => l.situacao === "pago").length;
    const aguardando = lanc.filter((l) => l.situacao === "lancado" || l.situacao === "aprovado").length;
    const aLancar = lanc.filter((l) => l.situacao === "pendente").length;
    const abertoTotal = lanc.filter((l) => l.situacao === "pendente").length;
    const lancadoTotal = lanc.filter((l) => l.situacao === "lancado").length;
    const aberto = abertoTotal - lanc.filter((l: any) =>
      l.situacao === "pendente" && estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano)
    ).length;
    const lancado = lancadoTotal - lanc.filter((l: any) =>
      l.situacao === "lancado" && estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano)
    ).length;
    return { t, ativas, mapear, aberto: Math.max(aberto, 0), lancado: Math.max(lancado, 0), atrasadas, pagas, aguardando, aLancar };
  });

  const totAtivas = porTipo.reduce((s, x) => s + x.ativas, 0);
  const totAberto = porTipo.reduce((s, x) => s + x.aberto, 0);
  const totLancado = porTipo.reduce((s, x) => s + x.lancado, 0);
  const totMapear = porTipo.reduce((s, x) => s + x.mapear, 0);

  return (
    <>
      <Topbar title="Painel" />
      <div className="px-8 py-8 max-w-[1240px] w-full">
        {/* KPIs - grid 4 colunas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KpiCard icon="doc" value={totAtivas} label="Contas ativas" variacao={variacaoPct(totAtivas, metricaAnterior?.contas_ativas ?? null)} />
          <KpiCard icon="calendar" value={totAberto} label={`A lançar em ${formatarPeriodo(mes, ano).split("/")[0].toLowerCase()}`} variacao={variacaoPct(totAberto, metricaAnterior?.a_lancar ?? null)} />
          <KpiCard icon="hourglass" value={totLancado} label="Aguardando pagamento" variacao={variacaoPct(totLancado, metricaAnterior?.aguardando_pagamento ?? null)} />
          <KpiCard icon="pin" value={totMapear} label="Origem a mapear" variacao={variacaoPct(totMapear, metricaAnterior?.origem_a_mapear ?? null)} />
        </div>

        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[#1a1a1a]">Situação por tipo de conta</h2>
            <p className="text-[13px] text-[#6c757d] mt-0.5">Visão geral do status das contas por categoria</p>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-txt border border-linha rounded-lg px-3.5 py-2 bg-white">
            Exibir todas
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#6c757d" strokeWidth="1.6"><path d="M6 8l4 4 4-4" /></svg>
          </div>
        </div>

        {/* grid de cards de tipo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {porTipo.map(({ t, ativas, mapear, pagas, aguardando, aLancar, atrasadas }) => {
            const T = TIPOS[t];
            const base = ativas || 1;
            const pctPagas = Math.round((pagas / base) * 100);
            return (
              <div key={t} className="bg-white border border-linha rounded-xl p-6 shadow-leve hover:shadow-media transition flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full grid place-items-center shrink-0" style={{ background: T.bg }}>
                    <TipoIcon tipo={t} size={22} color={T.c} />
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-[#1a1a1a] leading-tight">{T.n}</div>
                    <div className="text-[12px] text-[#6c757d]">Total de contas</div>
                  </div>
                </div>

                <div className="text-[26px] font-bold text-[#1a1a1a] leading-none mb-3">{ativas}</div>

                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex-1 h-1.5 rounded-full bg-[#f1f3f5] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pctPagas, 100)}%`, background: T.c }} />
                  </div>
                  <span className="text-[12px] font-semibold text-[#1a1a1a] shrink-0">{pctPagas}%</span>
                </div>

                <div className="space-y-2 flex-1">
                  <LinhaLegenda cor="#2196f3" label="Pagas" valor={pagas} base={base} />
                  <LinhaLegenda cor="#FFC107" label="Aguardando" valor={aguardando} base={base} />
                  <LinhaLegenda cor="#f44336" label="A Lançar" valor={aLancar} base={base} extra={atrasadas > 0 ? `${atrasadas} atrasada${atrasadas > 1 ? "s" : ""}` : undefined} />
                </div>

                {mapear > 0 && (
                  <div className="mt-3 text-[11px] text-alerr font-medium">{mapear} sem origem mapeada</div>
                )}

                <Link href={`/contas?tipo=${t}`}
                  className="mt-4 pt-4 border-t border-linha2 flex items-center justify-between text-[13px] font-semibold text-txt hover:text-amarelo-dark transition">
                  Ver detalhes
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
                </Link>
              </div>
            );
          })}
        </div>

        {(lojasEncerradas ?? []).length > 0 && (
          <>
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-[20px] font-semibold text-[#1a1a1a]">Lojas encerradas recentemente</h2>
              <Link href="/lojas?status=encerrada" className="text-xs text-[#1976d2] hover:underline">ver todas</Link>
            </div>
            <div className="card overflow-hidden">
              <ul>
                {(lojasEncerradas ?? []).map((l: any, i: number) => (
                  <li key={i} className="flex items-center gap-3.5 px-5 py-3 border-b border-linha2 last:border-0 text-[13px]">
                    <div className="w-8 h-8 rounded-lg bg-alerr-bg text-alerr grid place-items-center text-[11px] font-bold shrink-0">
                      {l.coban?.slice(0, 2) ?? "—"}
                    </div>
                    <div className="min-w-0">
                      <b className="font-semibold">{l.codigo}</b>
                      <small className="block text-[#adb5bd] text-[11px] mt-0.5 truncate">
                        {[l.empresa, l.cidade && l.uf ? `${l.cidade}/${l.uf}` : null].filter(Boolean).join(" · ") || "sem dados adicionais"}
                      </small>
                    </div>
                    <span className="ml-auto text-[11px] text-[#adb5bd] font-mono shrink-0">
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

function LinhaLegenda({ cor, label, valor, base, extra }: { cor: string; label: string; valor: number; base: number; extra?: string }) {
  const pct = Math.round((valor / base) * 100);
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
      <span className="text-[#6c757d] font-medium">{label}</span>
      {extra && <span className="text-[10.5px] text-alerr font-semibold">({extra})</span>}
      <span className="ml-auto text-[#1a1a1a] font-semibold">{valor}</span>
      <span className="text-[#adb5bd] w-9 text-right">({pct}%)</span>
    </div>
  );
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  doc: <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  calendar: <><rect x="3.5" y="5" width="15" height="13.5" rx="2" /><path d="M3.5 9.5h15M7 3v3.5M15 3v3.5" /></>,
  hourglass: <><path d="M6 3.5h10M6 18.5h10M6.5 3.5c0 4 3 4.5 3 6.5s-3 2.5-3 6.5M15.5 3.5c0 4-3 4.5-3 6.5s3 2.5 3 6.5" /></>,
  pin: <><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></>,
};

function KpiCard({ icon, value, label, variacao }: { icon: string; value: number; label: string; variacao: number | null }) {
  return (
    <div className="relative bg-white border border-linha rounded-xl p-6 shadow-leve overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 rounded-full grid place-items-center" style={{ background: "#fdf3e3" }}>
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="#c9922a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{KPI_ICONS[icon]}</svg>
        </div>
        <svg width="46" height="20" viewBox="0 0 46 20" fill="none" className="mt-2 opacity-80">
          <path d="M1 14c4-2 6 4 10 2s5-9 9-7 6 8 10 5 5-10 9-8" stroke="#FFC107" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      <div className="text-3xl font-bold text-gray-900 leading-none mt-1.5">{value}</div>
      {variacao !== null ? (
        <div className={`text-[12.5px] font-medium mt-3 flex items-center gap-1.5 ${variacao > 0 ? "text-ok" : variacao < 0 ? "text-alerr" : "text-[#adb5bd]"}`}>
          {variacao > 0 ? (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14l6-6 4 4 6-7M14 5h6v6" /></svg>
          ) : variacao < 0 ? (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6l6 6 4-4 6 7M14 15h6V9" /></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10h12" /></svg>
          )}
          {Math.abs(variacao)}% {variacao >= 0 ? "acima" : "abaixo"} do mês anterior
        </div>
      ) : (
        <div className="text-[11px] text-[#bbb] font-normal mt-3">sem dado do mês anterior ainda</div>
      )}
    </div>
  );
}
