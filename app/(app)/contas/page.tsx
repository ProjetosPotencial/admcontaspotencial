import { createClient } from "@/lib/supabase/server";
import ContasClient from "./contas-client";
import type { Conta } from "@/lib/types";
import { TIPOS } from "@/lib/types";
import { obterPeriodoAtual, formatarPeriodo, estaAtrasada, variacaoPct } from "@/lib/date-utils";
import { money, MES } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const supabase = createClient();
  const { ano, mes, mesAnterior, anoAnterior } = obterPeriodoAtual();
  const diaAtual = new Date().getDate();

  const [
    { data },
    { data: lancAtual },
    { data: lojas },
    { data: lancDetalhado },
    { data: lancamentosAno },
    { data: metricaAnterior },
  ] = await Promise.all([
    supabase
      .from("contas")
      .select("id, tipo, fornecedor_nome, identificador, dia_vencimento, origem, cnpj_cpf, insc_cod_mat, portal_link, eh_rateio, rateio_divisor, observacoes, status, loja_id, lojas ( codigo, coban )")
      .eq("situacao_cadastro", "aprovada")
      .order("tipo"),
    supabase.from("lancamentos").select("conta_id, situacao").eq("ano", ano).eq("mes", mes),
    supabase.from("lojas").select("id, codigo").eq("status", "ativo").order("codigo"),
    supabase.from("lancamentos")
      .select("id, valor, situacao, contas!inner ( dia_vencimento, origem )")
      .eq("ano", ano).eq("mes", mes),
    supabase.from("lancamentos").select("mes, valor, situacao").eq("ano", ano).not("valor", "is", null),
    supabase.from("metricas_mensais").select("contas_ativas").eq("ano", anoAnterior).eq("mes", mesAnterior).maybeSingle(),
  ]);

  const contas = (data ?? []) as unknown as Conta[];
  const situacaoPorConta: Record<string, string> = {};
  (lancAtual ?? []).forEach((l: any) => { situacaoPorConta[l.conta_id] = l.situacao; });

  const totalCadastradas = contas.filter((c) => c.status === "ativo").length;

  const pendentes = (lancDetalhado ?? []).filter((l: any) => l.situacao === "pendente" || l.situacao === "lancado");
  const venceHoje = pendentes.filter((l: any) => l.contas?.dia_vencimento === diaAtual);
  const proximos7 = pendentes.filter((l: any) => {
    const dv = l.contas?.dia_vencimento;
    return dv != null && dv >= diaAtual && dv <= diaAtual + 7;
  });
  const atrasadas = pendentes.filter((l: any) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano));
  const semOrigem = pendentes.filter((l: any) => l.contas?.origem === "a_definir");

  const somaValor = (arr: any[]) => arr.reduce((s, l) => s + Number(l.valor ?? 0), 0);

  const evolucaoPorMes = Array.from({ length: 12 }, (_, i) => {
    const total = (lancamentosAno ?? []).filter((l) => l.mes === i + 1).reduce((s, l) => s + Number(l.valor ?? 0), 0);
    return { mes: i + 1, total };
  }).filter((m) => m.mes <= mes);
  const maxEvolucao = Math.max(...evolucaoPorMes.map((m) => m.total), 1);
  const totalMesAtual = evolucaoPorMes.find((m) => m.mes === mes)?.total ?? 0;
  const totalMesAnteriorReal = evolucaoPorMes.find((m) => m.mes === mesAnterior)?.total ?? null;
  const variacaoEvolucao = totalMesAnteriorReal ? variacaoPct(totalMesAtual, totalMesAnteriorReal) : null;

  const lancMesAtual = (lancamentosAno ?? []).filter((l) => l.mes === mes);
  const totalPagas = lancMesAtual.filter((l) => l.situacao === "pago").reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const totalAVencer = somaValor(pendentes.filter((l: any) => !estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano)));
  const totalAtrasadasValor = somaValor(atrasadas);
  const totalGeralResumo = totalPagas + totalAVencer + totalAtrasadasValor || 1;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px] w-full">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#1a1a1a]">Contas de consumo</h1>
        <p className="text-[14px] text-[#6c757d] mt-1">Gerencie todas as contas cadastradas e acompanhe vencimentos, pendências e origem.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            <KpiMini icon="doc" cor="#1976d2" bg="#e3f2fd" value={totalCadastradas} label="Contas cadastradas"
              extra={<Variacao v={variacaoPct(totalCadastradas, metricaAnterior?.contas_ativas ?? null)} />} />
            <KpiMini icon="calendar" cor="#c9922a" bg="#fdf3e3" value={venceHoje.length} label="Vence hoje" extra={<span className="text-[11px] font-mono text-[#6c757d]">{money(somaValor(venceHoje))}</span>} />
            <KpiMini icon="calendar" cor="#2E7D57" bg="#E4F1EA" value={proximos7.length} label="Próximos 7 dias" extra={<span className="text-[11px] font-mono text-[#6c757d]">{money(somaValor(proximos7))}</span>} />
            <KpiMini icon="alert" cor="#B23B3B" bg="#F7E4E2" value={atrasadas.length} label="Atrasadas" extra={<span className="text-[11px] font-mono text-[#6c757d]">{money(totalAtrasadasValor)}</span>} />
            <KpiMini icon="pin" cor="#6B5B95" bg="#EDE7F6" value={semOrigem.length} label="Sem origem" extra={<span className="text-[11px] font-mono text-[#6c757d]">{money(somaValor(semOrigem))}</span>} />
          </div>

          <ContasClient contas={contas} situacaoPorConta={situacaoPorConta} lojas={lojas ?? []} ano={ano} mes={mes} />
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Alertas importantes</h3>
              <Link href="/alertas" className="text-[11.5px] font-semibold text-info hover:underline">Ver todos</Link>
            </div>
            <div className="space-y-2.5 text-[12.5px]">
              <LinhaAlerta cor="#B23B3B" label="Vence hoje" valor={venceHoje.length} href="/alertas" />
              <LinhaAlerta cor="#c9922a" label="Próximos 7 dias" valor={proximos7.length} href="/alertas" />
              <LinhaAlerta cor="#B23B3B" label="Atrasadas" valor={atrasadas.length} href="/alertas" />
              <LinhaAlerta cor="#6B5B95" label="Sem origem" valor={semOrigem.length} href="/alertas" />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Resumo financeiro</h3>
              <Link href="/relatorios" className="text-[11.5px] font-semibold text-info hover:underline">Ver relatório</Link>
            </div>
            <p className="text-[11.5px] text-[#6c757d] mb-4">{formatarPeriodo(mes, ano)}</p>
            <div className="text-[20px] font-bold text-[#1a1a1a] leading-none mb-4">{money(totalPagas + totalAVencer + totalAtrasadasValor)}</div>
            <div className="flex items-center gap-4">
              <DonutTriplo pagas={totalPagas} aVencer={totalAVencer} atrasadas={totalAtrasadasValor} total={totalGeralResumo} />
              <div className="flex-1 space-y-2 text-[12px]">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-ok" />Pagas <b className="ml-auto font-mono">{money(totalPagas)}</b></div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FFC107" }} />A vencer <b className="ml-auto font-mono">{money(totalAVencer)}</b></div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-alerr" />Atrasadas <b className="ml-auto font-mono">{money(totalAtrasadasValor)}</b></div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Evolução mensal</h3>
            <div className="text-[20px] font-bold text-[#1a1a1a] leading-none">{money(totalMesAtual)}</div>
            <div className="text-[11px] text-[#6c757d] mt-1 mb-4">
              {variacaoEvolucao !== null && (
                <span className={variacaoEvolucao >= 0 ? "text-ok font-semibold" : "text-alerr font-semibold"}>
                  {variacaoEvolucao >= 0 ? "↑" : "↓"} {Math.abs(variacaoEvolucao)}% vs {MES[mesAnterior - 1]}/{String(anoAnterior).slice(-2)}
                </span>
              )}
            </div>
            <div className="flex items-end gap-1.5 h-[80px]">
              {evolucaoPorMes.map((m) => (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5" title={`${MES[m.mes - 1]}: ${money(m.total)}`}>
                  <div className="w-full flex items-end h-[60px]">
                    <div className="w-full rounded-t" style={{ height: `${Math.max((m.total / maxEvolucao) * 100, 3)}%`, background: m.mes === mes ? "#FFC107" : "#FFE9A8" }} />
                  </div>
                  <span className="text-[9px] text-[#adb5bd] font-mono">{MES[m.mes - 1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Variacao({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[10.5px] text-[#bbb]">sem dado anterior</span>;
  return (
    <span className={`text-[11px] font-semibold ${v >= 0 ? "text-ok" : "text-alerr"}`}>
      {v >= 0 ? "↑" : "↓"} {Math.abs(v)}% vs mês anterior
    </span>
  );
}

function LinhaAlerta({ cor, label, valor, href }: { cor: string; label: string; valor: number; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 hover:opacity-70 transition">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
      <span className="text-[#5c5a54] font-medium">{label}</span>
      <span className="ml-auto font-bold text-[#1a1a1a] bg-[#f1f3f5] rounded-full px-2 py-0.5 text-[11px]">{valor}</span>
    </Link>
  );
}

function DonutTriplo({ pagas, aVencer, atrasadas, total }: { pagas: number; aVencer: number; atrasadas: number; total: number }) {
  const raio = 30, circ = 2 * Math.PI * raio;
  const pPagas = pagas / total, pAVencer = aVencer / total;
  const offPagas = circ * (1 - pPagas);
  const offAVencer = circ * (1 - pAVencer);
  const rotAVencer = pPagas * 360;
  const rotAtrasadas = (pPagas + pAVencer) * 360;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#f1f3f5" strokeWidth="10" />
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#2E7D57" strokeWidth="10" strokeDasharray={circ} strokeDashoffset={offPagas} strokeLinecap="round" transform="rotate(-90 38 38)" />
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#FFC107" strokeWidth="10" strokeDasharray={circ} strokeDashoffset={offAVencer} strokeLinecap="round" transform={`rotate(${rotAVencer - 90} 38 38)`} />
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#f44336" strokeWidth="10" strokeDasharray={circ} strokeDashoffset={circ * (1 - atrasadas / total)} strokeLinecap="round" transform={`rotate(${rotAtrasadas - 90} 38 38)`} />
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  doc: <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  calendar: <><rect x="3.5" y="5" width="15" height="13.5" rx="2" /><path d="M3.5 9.5h15M7 3v3.5M15 3v3.5" /></>,
  alert: <><path d="M10.9 3.6l7.6 13a1 1 0 01-.9 1.5H2.4a1 1 0 01-.9-1.5l7.6-13a1 1 0 011.8 0z" /><path d="M10 8.5v4M10 15.2v.1" /></>,
  pin: <><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></>,
};

function KpiMini({ icon, cor, bg, value, label, extra }: { icon: string; cor: string; bg: string; value: number; label: string; extra?: React.ReactNode }) {
  return (
    <div className="bg-white border border-linha rounded-xl p-4 shadow-leve">
      <div className="w-9 h-9 rounded-full grid place-items-center mb-2.5" style={{ background: bg }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
      </div>
      <div className="text-[11.5px] text-[#6c757d] font-medium truncate">{label}</div>
      <div className="text-[22px] font-bold text-[#1a1a1a] leading-none mt-1">{value}</div>
      <div className="mt-1.5">{extra}</div>
    </div>
  );
}
