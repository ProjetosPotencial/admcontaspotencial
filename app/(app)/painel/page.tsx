import { createClient } from "@/lib/supabase/server";
import TipoIcon from "@/components/tipo-icon";
import { TIPOS } from "@/lib/types";
import { formatarPeriodo, estaAtrasada, variacaoPct, contaValidaNoPeriodo } from "@/lib/date-utils";
import { obterPeriodoSelecionado } from "@/lib/periodo";
import { money, MES } from "@/lib/format";
import VencimentosProximosClient from "./vencimentos-proximos-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function PainelPage() {
  const supabase = createClient();
  const { ano, mes, mesAnterior, anoAnterior, ehPeriodoAtual } = obterPeriodoSelecionado();

  const { data: { session } } = await supabase.auth.getSession();

  const [
    { data: perfil },
    { data: contas },
    { data: lancamentos },
    { data: lancamentosDetalhados },
    { data: lancamentosAno },
    { data: lojasEncerradas },
    { count: totalLojasFechadas },
    { data: metricaAnterior },
  ] = await Promise.all([
    supabase.from("perfis").select("nome").eq("id", session?.user.id ?? "").maybeSingle(),
    supabase.from("contas").select("id, tipo, status, origem, dia_vencimento, data_encerramento").eq("situacao_cadastro", "aprovada"),
    supabase.from("lancamentos").select("conta_id, situacao, contas!inner(tipo, dia_vencimento)").eq("ano", ano).eq("mes", mes),
    supabase.from("lancamentos")
      .select("id, valor, situacao, contas!inner ( id, tipo, dia_vencimento, fornecedor_nome, lojas ( codigo ) )")
      .eq("ano", ano).eq("mes", mes).eq("situacao", "pendente"),
    supabase.from("lancamentos")
      .select("mes, valor, situacao, contas!inner ( fornecedor_nome )")
      .eq("ano", ano).not("valor", "is", null),
    supabase.from("lojas").select("codigo, coban, empresa, cidade, uf, encerrada_em").eq("status", "encerrada").order("encerrada_em", { ascending: false }).limit(5),
    supabase.from("lojas").select("id", { count: "exact", head: true }).eq("status", "encerrada"),
    supabase.from("metricas_mensais").select("contas_ativas, a_lancar, aguardando_pagamento, origem_a_mapear").eq("ano", anoAnterior).eq("mes", mesAnterior).maybeSingle(),
  ]);

  const nome = perfil?.nome?.split(" ")[0] ?? "";
  const diaAtual = new Date().getDate();

  // --- métricas por tipo (cards de baixo) ---
  const tipos = Object.keys(TIPOS);
  const porTipo = tipos.map((t) => {
    const doTipo = (contas ?? []).filter((c) => c.tipo === t && c.status !== "inativo" && contaValidaNoPeriodo(c.status, c.data_encerramento, ano, mes));
    const ativas = doTipo.length;
    const mapear = doTipo.filter((c) => c.origem === "a_definir").length;
    const lanc = (lancamentos ?? []).filter((l: any) => l.contas?.tipo === t);
    const atrasadas = lanc.filter((l: any) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano)).length;
    const pagas = lanc.filter((l) => l.situacao === "pago").length;
    const aguardando = lanc.filter((l) => l.situacao === "lancado" || l.situacao === "aprovado").length;
    const aLancar = lanc.filter((l) => l.situacao === "pendente").length;
    return { t, ativas, mapear, atrasadas, pagas, aguardando, aLancar };
  });

  const totAtivas = porTipo.reduce((s, x) => s + x.ativas, 0);
  const totAberto = porTipo.reduce((s, x) => s + x.aLancar, 0);
  const totLancado = porTipo.reduce((s, x) => s + x.aguardando, 0);
  const totMapear = porTipo.reduce((s, x) => s + x.mapear, 0);

  // --- alertas importantes ---
  const totAtrasadas = porTipo.reduce((s, x) => s + x.atrasadas, 0);
  const aprovacoesPendentes = (lancamentos ?? []).filter((l) => l.situacao === "lancado").length;
  const pagamentosComFalha = (lancamentos ?? []).filter((l) => l.situacao === "contestado").length;

  // --- evolução mensal (soma real de lançamentos com valor, mês a mês do ano) ---
  const evolucaoPorMes = Array.from({ length: 12 }, (_, i) => {
    const total = (lancamentosAno ?? []).filter((l) => l.mes === i + 1).reduce((s, l) => s + Number(l.valor ?? 0), 0);
    return { mes: i + 1, total };
  }).filter((m) => m.mes <= mes); // só até o mês atual, não mostra futuro vazio
  const maxEvolucao = Math.max(...evolucaoPorMes.map((m) => m.total), 1);
  const totalMesAtual = evolucaoPorMes.find((m) => m.mes === mes)?.total ?? 0;
  const totalMesAnteriorReal = evolucaoPorMes.find((m) => m.mes === mesAnterior)?.total ?? null;
  const variacaoEvolucao = totalMesAnteriorReal ? variacaoPct(totalMesAtual, totalMesAnteriorReal) : null;

  // --- top fornecedores (por valor, dentro do mês atual) ---
  const porFornecedor: Record<string, number> = {};
  (lancamentosAno ?? []).filter((l) => l.mes === mes).forEach((l: any) => {
    const nomeF = l.contas?.fornecedor_nome ?? "Não identificado";
    porFornecedor[nomeF] = (porFornecedor[nomeF] ?? 0) + Number(l.valor ?? 0);
  });
  const topFornecedores = Object.entries(porFornecedor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalFornecedores = Object.values(porFornecedor).reduce((s, v) => s + v, 0) || 1;

  // --- resumo financeiro do mês ---
  const lancMesAtual = (lancamentosAno ?? []).filter((l) => l.mes === mes);
  const totalAPagar = lancMesAtual.reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const totalPago = lancMesAtual.filter((l) => l.situacao === "pago").reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const totalPendente = totalAPagar - totalPago;
  const pctPago = totalAPagar > 0 ? Math.round((totalPago / totalAPagar) * 1000) / 10 : 0;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px] w-full">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#1a1a1a]">👋 {saudacao()}{nome ? `, ${nome}` : ""}!</h1>
        <p className="text-[14px] text-[#6c757d] mt-1">
          {ehPeriodoAtual ? "Aqui está o resumo da sua gestão financeira." : `Você está vendo o histórico de ${formatarPeriodo(mes, ano)}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <KpiCard icon="doc" cor="#c9922a" value={totAtivas} label="Contas ativas" variacao={variacaoPct(totAtivas, metricaAnterior?.contas_ativas ?? null)} />
            <KpiCard icon="calendar" cor="#c9922a" value={totAberto} label={`A lançar em ${formatarPeriodo(mes, ano).split("/")[0].toLowerCase()}`} variacao={variacaoPct(totAberto, metricaAnterior?.a_lancar ?? null)} />
            <KpiCard icon="hourglass" cor="#B23B3B" value={totLancado} label="Aguardando pagamento" variacao={variacaoPct(totLancado, metricaAnterior?.aguardando_pagamento ?? null)} />
            <KpiCard icon="pin" cor="#2E7D57" value={totMapear} label="Origem a mapear" variacao={variacaoPct(totMapear, metricaAnterior?.origem_a_mapear ?? null)} />
          </div>

          {ehPeriodoAtual && (
            <div className="mb-6">
              <VencimentosProximosClient itens={(lancamentosDetalhados ?? []) as any[]} diaAtual={diaAtual} />
            </div>
          )}

          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[18px] font-bold text-[#1a1a1a]">Situação por tipo de conta</h2>
              <p className="text-[13px] text-[#6c757d] mt-0.5">Visão geral do status das contas por categoria</p>
            </div>
            <Link href="/contas" className="text-[12.5px] font-semibold text-info hover:underline">Ver todas as contas</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            {porTipo.map(({ t, ativas, mapear, pagas, aguardando, aLancar, atrasadas }) => {
              const T = TIPOS[t];
              const base = ativas || 1;
              const pctPagas = Math.round((pagas / base) * 100);
              return (
                <div key={t} className="bg-white border border-linha rounded-xl p-5 shadow-leve hover:shadow-media transition">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: T.bg }}>
                      <TipoIcon tipo={t} size={18} color={T.c} />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#1a1a1a] leading-tight">{T.n}</div>
                      <div className="text-[11.5px] text-[#6c757d]">{ativas} contas</div>
                    </div>
                    <Link href={`/contas?tipo=${t}`} className="ml-auto text-[#adb5bd] hover:text-[#1a1a1a]">
                      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex-1 h-1.5 rounded-full bg-[#f1f3f5] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pctPagas, 100)}%`, background: T.c }} />
                    </div>
                    <span className="text-[11.5px] font-semibold shrink-0">{pctPagas}%</span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-[#6c757d]">
                    <span>Pagas <b className="text-[#1a1a1a]">{pagas}</b></span>
                    <span>Aguardando <b className="text-[#1a1a1a]">{aguardando}</b></span>
                    <span>A lançar <b className="text-[#1a1a1a]">{aLancar}</b></span>
                    {atrasadas > 0 && <span className="text-alerr font-semibold ml-auto">{atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>}
                  </div>
                  {mapear > 0 && <div className="mt-2 text-[10.5px] text-alerr font-medium">{mapear} sem origem mapeada</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl p-5 border border-amarelo/30" style={{ background: "#FFF8E8" }}>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="text-lg">⚠️</span>
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Alertas importantes</h3>
            </div>
            <div className="space-y-2.5">
              <LinhaAlerta emoji="⚠️" label="Contas atrasadas" valor={totAtrasadas} href="/alertas" />
              <LinhaAlerta emoji="🔔" label="Aprovações pendentes" valor={aprovacoesPendentes} href="/aprovacoes" />
              <LinhaAlerta emoji="⛔" label="Pagamentos com falha" valor={pagamentosComFalha} href="/pagamentos" />
              <LinhaAlerta emoji="📍" label="Origem não mapeada" valor={totMapear} href="/alertas" />
            </div>
            <Link href="/alertas" className="block text-center mt-4 text-[12.5px] font-bold text-amarelo-dark hover:underline">
              Ver todos os alertas →
            </Link>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Lojas fechadas</h3>
              <Link href="/lojas?status=encerrada" className="text-[11.5px] font-semibold text-info hover:underline">Ver todas</Link>
            </div>
            <div className="text-[26px] font-bold text-[#1a1a1a] leading-none mt-2 mb-3">{totalLojasFechadas ?? 0}</div>
            {(lojasEncerradas ?? []).length > 0 ? (
              <ul className="space-y-2.5">
                {(lojasEncerradas ?? []).map((l: any, i: number) => (
                  <li key={i} className="flex items-center gap-2.5 text-[12.5px]">
                    <div className="w-7 h-7 rounded-lg bg-alerr-bg text-alerr grid place-items-center text-[10px] font-bold shrink-0">{l.coban?.slice(0, 2) ?? "—"}</div>
                    <div className="min-w-0 flex-1">
                      <b className="font-semibold block truncate">{l.codigo}</b>
                    </div>
                    <span className="text-[10.5px] text-[#adb5bd] font-mono shrink-0">{l.encerrada_em ? new Date(l.encerrada_em).toLocaleDateString("pt-br") : "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-[#adb5bd]">Nenhuma loja fechada ainda.</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Evolução mensal</h3>
            <div className="text-[22px] font-bold text-[#1a1a1a] leading-none">{money(totalMesAtual)}</div>
            <div className="text-[11.5px] text-[#6c757d] mt-1 mb-4">
              Total em {formatarPeriodo(mes, ano).split("/")[0]}
              {variacaoEvolucao !== null && (
                <span className={variacaoEvolucao >= 0 ? "text-ok font-semibold ml-1.5" : "text-alerr font-semibold ml-1.5"}>
                  {variacaoEvolucao >= 0 ? "↑" : "↓"} {Math.abs(variacaoEvolucao)}% vs {MES[mesAnterior - 1]}
                </span>
              )}
            </div>
            <div className="flex items-end gap-1.5 h-[90px]">
              {evolucaoPorMes.map((m) => (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5" title={`${MES[m.mes - 1]}: ${money(m.total)}`}>
                  <div className="w-full flex items-end h-[70px]">
                    <div className="w-full rounded-t" style={{ height: `${Math.max((m.total / maxEvolucao) * 100, 3)}%`, background: m.mes === mes ? "#FFC107" : "#FFE9A8" }} />
                  </div>
                  <span className="text-[9.5px] text-[#adb5bd] font-mono">{MES[m.mes - 1]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Top fornecedores</h3>
            <div className="space-y-3">
              {topFornecedores.map(([nomeF, valor]) => (
                <div key={nomeF} className="flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-[#1a1a1a] truncate max-w-[130px]">{nomeF}</span>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold">{money(valor)}</div>
                    <div className="text-[10.5px] text-[#adb5bd]">{Math.round((valor / totalFornecedores) * 100)}%</div>
                  </div>
                </div>
              ))}
              {topFornecedores.length === 0 && <div className="text-[12.5px] text-[#adb5bd]">Sem lançamentos com valor este mês.</div>}
            </div>
            <Link href="/fornecedores" className="block text-center mt-4 pt-3 border-t border-linha2 text-[12px] font-semibold text-info hover:underline">Ver todos</Link>
          </div>

          <div className="card p-5">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-1">Resumo financeiro</h3>
            <p className="text-[11.5px] text-[#6c757d] mb-4">{formatarPeriodo(mes, ano)}</p>
            <div className="flex items-center gap-4">
              <Donut pct={pctPago} />
              <div className="flex-1 space-y-2 text-[12.5px]">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-ok" />Pago <b className="ml-auto font-mono">{money(totalPago)}</b></div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FFC107" }} />Pendente <b className="ml-auto font-mono">{money(totalPendente)}</b></div>
              </div>
            </div>
            <Link href="/relatorios" className="block text-center mt-4 pt-3 border-t border-linha2 text-[12px] font-semibold text-info hover:underline">Ver relatório completo</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinhaAlerta({ emoji, label, valor, href }: { emoji: string; label: string; valor: number; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-[12.5px] hover:opacity-70 transition">
      <span>{emoji}</span>
      <span className="text-[#5c4a1f] font-medium">{label}</span>
      <span className="ml-auto font-bold text-[#1a1a1a] bg-white/70 rounded-full px-2 py-0.5 text-[11px]">{valor}</span>
    </Link>
  );
}

function Donut({ pct }: { pct: number }) {
  const raio = 30, circ = 2 * Math.PI * raio;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90">
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#FFE9A8" strokeWidth="10" />
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#2E7D57" strokeWidth="10" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x="38" y="42" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1a1a1a" transform="rotate(90 38 38)">{pct}%</text>
    </svg>
  );
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  doc: <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  calendar: <><rect x="3.5" y="5" width="15" height="13.5" rx="2" /><path d="M3.5 9.5h15M7 3v3.5M15 3v3.5" /></>,
  hourglass: <><path d="M6 3.5h10M6 18.5h10M6.5 3.5c0 4 3 4.5 3 6.5s-3 2.5-3 6.5M15.5 3.5c0 4-3 4.5-3 6.5s3 2.5 3 6.5" /></>,
  pin: <><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></>,
};

function KpiCard({ icon, cor, value, label, variacao }: { icon: string; cor: string; value: number; label: string; variacao: number | null }) {
  return (
    <div className="relative bg-white border border-linha rounded-xl p-5 shadow-leve overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-full grid place-items-center" style={{ background: "#fdf3e3" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#c9922a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{KPI_ICONS[icon]}</svg>
        </div>
        <svg width="44" height="18" viewBox="0 0 46 20" fill="none" className="mt-1 opacity-80">
          <path d="M1 14c4-2 6 4 10 2s5-9 9-7 6 8 10 5 5-10 9-8" stroke={cor} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <div className="text-[12.5px] text-gray-500 font-medium">{label}</div>
      <div className="text-[26px] font-bold text-gray-900 leading-none mt-1">{value}</div>
      {variacao !== null ? (
        <div className={`text-[11.5px] font-medium mt-2 flex items-center gap-1 ${variacao > 0 ? "text-ok" : variacao < 0 ? "text-alerr" : "text-[#adb5bd]"}`}>
          {variacao >= 0 ? "↑" : "↓"} {Math.abs(variacao)}% <span className="text-[#adb5bd] font-normal">vs mês anterior</span>
        </div>
      ) : (
        <div className="text-[10.5px] text-[#bbb] font-normal mt-2">sem dado do mês anterior ainda</div>
      )}
    </div>
  );
}
