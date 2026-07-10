import { createClient } from "@/lib/supabase/server";
import LancamentosClient from "./lancamentos-client";
import { obterPeriodoAtual, formatarPeriodo, estaAtrasada } from "@/lib/date-utils";
import { money } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LancamentosPage() {
  const supabase = createClient();
  const { ano, mes } = obterPeriodoAtual();
  const diaAtual = new Date().getDate();

  const [{ data }, { data: mesAtualDetalhado }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("id, ano, mes, valor, situacao, comprovante_url, comprovante_drive_url, contas!inner ( tipo, dia_vencimento, fornecedor_nome, lojas ( codigo, coban ) )")
      .eq("ano", ano)
      .order("mes", { ascending: false }),
    supabase
      .from("lancamentos")
      .select("id, valor, situacao, contas!inner ( dia_vencimento, fornecedor_nome )")
      .eq("ano", ano).eq("mes", mes),
  ]);

  const itens = (data ?? []) as any[];
  const totalLancado = itens.reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const lancados = itens.filter((l) => l.situacao === "lancado");
  const contestados = itens.filter((l) => l.situacao === "contestado");
  const totalLancados = lancados.reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const totalContestados = contestados.reduce((s, l) => s + Number(l.valor ?? 0), 0);

  const mesAtual = (mesAtualDetalhado ?? []) as any[];
  const venceHoje = mesAtual.filter((l) => l.contas?.dia_vencimento === diaAtual && (l.situacao === "pendente" || l.situacao === "lancado"));
  const amanha = mesAtual.filter((l) => l.contas?.dia_vencimento === diaAtual + 1 && (l.situacao === "pendente" || l.situacao === "lancado"));
  const proximos7 = mesAtual.filter((l) => {
    const dv = l.contas?.dia_vencimento;
    return dv != null && dv >= diaAtual && dv <= diaAtual + 7 && (l.situacao === "pendente" || l.situacao === "lancado");
  });
  const atrasadas = mesAtual.filter((l) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano));
  const somaValor = (arr: any[]) => arr.reduce((s, l) => s + Number(l.valor ?? 0), 0);

  const totalPago = mesAtual.filter((l) => l.situacao === "pago").reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const totalAVencerMes = somaValor(mesAtual.filter((l) => (l.situacao === "pendente" || l.situacao === "lancado") && !estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano) && l.contas?.dia_vencimento !== diaAtual));
  const totalHojeMes = somaValor(venceHoje);
  const totalAtrasadoMes = somaValor(atrasadas);
  const totalResumoMes = totalPago + totalAVencerMes + totalHojeMes + totalAtrasadoMes || 1;

  const porFornecedor: Record<string, number> = {};
  itens.forEach((l: any) => {
    const f = l.contas?.fornecedor_nome ?? "Não identificado";
    porFornecedor[f] = (porFornecedor[f] ?? 0) + Number(l.valor ?? 0);
  });
  const topFornecedores = Object.entries(porFornecedor).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalTodosFornecedores = Object.values(porFornecedor).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px] w-full">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#1a1a1a]">Lançamentos</h1>
        <p className="text-[14px] text-[#6c757d] mt-1">Todos os valores lançados em {ano}, mês a mês.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
        <div className="min-w-0">
          <LancamentosClient
            itens={itens}
            ano={ano}
            resumo={{
              totalLancado, totalLancados, pctLancados: Math.round((totalLancados / (totalLancado || 1)) * 1000) / 10,
              totalContestados, pctContestados: Math.round((totalContestados / (totalLancado || 1)) * 1000) / 10,
              quantidade: itens.length,
              venceHojeQtd: venceHoje.length, venceHojeValor: somaValor(venceHoje),
            }}
          />
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Resumo do mês</h3>
              <Link href="/relatorios" className="text-[11.5px] font-semibold text-info hover:underline">Ver relatório</Link>
            </div>
            <p className="text-[11.5px] text-[#6c757d] mb-3.5">{formatarPeriodo(mes, ano)}</p>
            <div className="text-[20px] font-bold text-[#1a1a1a] leading-none mb-4">{money(totalPago + totalAVencerMes + totalHojeMes + totalAtrasadoMes)}</div>
            <div className="flex items-center gap-4">
              <DonutQuadruplo pago={totalPago} aVencer={totalAVencerMes} hoje={totalHojeMes} atrasado={totalAtrasadoMes} total={totalResumoMes} />
              <div className="flex-1 space-y-1.5 text-[11.5px]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ok" />Pagas <b className="ml-auto font-mono">{money(totalPago)}</b></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#FFC107" }} />A vencer <b className="ml-auto font-mono">{money(totalAVencerMes)}</b></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-info" />Hoje <b className="ml-auto font-mono">{money(totalHojeMes)}</b></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-alerr" />Atrasadas <b className="ml-auto font-mono">{money(totalAtrasadoMes)}</b></div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Próximos vencimentos</h3>
              <Link href="/alertas" className="text-[11.5px] font-semibold text-info hover:underline">Ver todos</Link>
            </div>
            <div className="space-y-3 text-[12.5px]">
              <LinhaVenc emoji="🔴" label="Vence hoje" valor={money(somaValor(venceHoje))} qtd={venceHoje.length} />
              <LinhaVenc emoji="🟠" label="Amanhã" valor={money(somaValor(amanha))} qtd={amanha.length} />
              <LinhaVenc emoji="🟡" label="Próximos 7 dias" valor={money(somaValor(proximos7))} qtd={proximos7.length} />
              <LinhaVenc emoji="🔴" label="Atrasadas" valor={money(somaValor(atrasadas))} qtd={atrasadas.length} />
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
                    <div className="text-[10.5px] text-[#adb5bd]">{Math.round((valor / totalTodosFornecedores) * 100)}%</div>
                  </div>
                </div>
              ))}
              {topFornecedores.length === 0 && <div className="text-[12.5px] text-[#adb5bd]">Sem lançamentos com valor.</div>}
            </div>
            <Link href="/fornecedores" className="block text-center mt-4 pt-3 border-t border-linha2 text-[12px] font-semibold text-info hover:underline">Ver todos os fornecedores</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinhaVenc({ emoji, label, valor, qtd }: { emoji: string; label: string; valor: string; qtd: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span>{emoji}</span>
      <div className="min-w-0">
        <div className="font-semibold text-[#1a1a1a]">{label}</div>
        <div className="text-[11px] text-[#6c757d] font-mono">{valor}</div>
      </div>
      <span className="ml-auto font-bold text-[#1a1a1a] bg-[#f1f3f5] rounded-full px-2 py-0.5 text-[11px] shrink-0">{qtd}</span>
    </div>
  );
}

function DonutQuadruplo({ pago, aVencer, hoje, atrasado, total }: { pago: number; aVencer: number; hoje: number; atrasado: number; total: number }) {
  const raio = 28, circ = 2 * Math.PI * raio;
  const partes = [
    { v: pago, cor: "#2E7D57" },
    { v: aVencer, cor: "#FFC107" },
    { v: hoje, cor: "#2196f3" },
    { v: atrasado, cor: "#f44336" },
  ];
  let acumulado = 0;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={raio} fill="none" stroke="#f1f3f5" strokeWidth="9" />
      {partes.map((p, i) => {
        const pct = p.v / total;
        const offset = circ * (1 - pct);
        const rot = acumulado * 360 - 90;
        acumulado += pct;
        return pct > 0 ? (
          <circle key={i} cx="36" cy="36" r={raio} fill="none" stroke={p.cor} strokeWidth="9"
            strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(${rot} 36 36)`} />
        ) : null;
      })}
    </svg>
  );
}
