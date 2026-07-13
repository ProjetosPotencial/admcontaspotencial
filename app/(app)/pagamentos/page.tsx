import { createClient } from "@/lib/supabase/server";
import PagamentosClient from "./pagamentos-client";
import { obterPeriodoAtual, estaAtrasada } from "@/lib/date-utils";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PagamentosPage() {
  const supabase = createClient();
  const { ano, mes } = obterPeriodoAtual();
  const diaAtual = new Date().getDate();

  const { data } = await supabase
    .from("lancamentos")
    .select("id, ano, mes, valor, situacao, aprovado_em, pago_em, forma_pagamento, contas!inner ( tipo, fornecedor_nome, dia_vencimento, lojas ( codigo, coban ) )")
    .in("situacao", ["aprovado", "pago"])
    .eq("ano", ano)
    .order("aprovado_em", { ascending: false })
    .limit(300);

  const itens = (data ?? []) as any[];
  const prontosPagar = itens.filter((i) => i.situacao === "aprovado" && i.mes === mes);
  const pagosMes = itens.filter((i) => i.situacao === "pago" && i.mes === mes);
  const totalPagoMes = pagosMes.reduce((s, i) => s + Number(i.valor ?? 0), 0);
  const totalAguardando = prontosPagar.reduce((s, i) => s + Number(i.valor ?? 0), 0);

  const vencendo7 = prontosPagar.filter((i) => {
    const dv = i.contas?.dia_vencimento;
    return dv != null && dv >= diaAtual && dv <= diaAtual + 7;
  });
  const vencidos = prontosPagar.filter((i) => estaAtrasada("aprovado", i.contas?.dia_vencimento, mes, ano) || (i.contas?.dia_vencimento != null && i.contas.dia_vencimento < diaAtual));
  const totalVencido = vencidos.reduce((s, i) => s + Number(i.valor ?? 0), 0);

  const totalGeral = totalPagoMes + totalAguardando || 1;
  const porForma: Record<string, number> = {};
  pagosMes.forEach((i) => { const f = i.forma_pagamento ?? "não informado"; porForma[f] = (porForma[f] ?? 0) + Number(i.valor ?? 0); });
  const totalFormas = Object.values(porForma).reduce((s, v) => s + v, 0) || 1;

  const LABEL_FORMA: Record<string, string> = { pix: "PIX", boleto: "Boleto", debito: "Débito", transferencia: "Transferência", "não informado": "Não informado" };
  const COR_FORMA: Record<string, string> = { pix: "#2E7D57", boleto: "#1976d2", debito: "#c9922a", transferencia: "#6B5B95", "não informado": "#adb5bd" };

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Pagamentos</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Acompanhe pagamentos aprovados, pendentes e realizados.</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[1400px]">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
          <div className="min-w-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiMini label="Total pagos (mês)" value={money(totalPagoMes)} cor="#2E7D57" bg="#E4F1EA" />
              <KpiMini label="Aguardando pagamento" value={money(totalAguardando)} sub={`${prontosPagar.length} lançamentos`} cor="#1976d2" bg="#e3f2fd" />
              <KpiMini label="Vencendo em 7 dias" value={money(vencendo7.reduce((s, i) => s + Number(i.valor ?? 0), 0))} sub={`${vencendo7.length} lançamentos`} cor="#c9922a" bg="#fdf3e3" />
              <KpiMini label="Vencidos" value={money(totalVencido)} sub={`${vencidos.length} lançamentos`} cor="#B23B3B" bg="#F7E4E2" />
            </div>
            <PagamentosClient prontosPagar={prontosPagar} pagos={itens.filter((i) => i.situacao === "pago")} />
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-1">Resumo financeiro</h3>
              <p className="text-[11.5px] text-[#6c757d] mb-4">Julho/2026</p>
              <div className="flex items-center gap-4">
                <Donut pago={totalPagoMes} total={totalGeral} />
                <div className="flex-1 space-y-1.5 text-[12px]">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-ok" />Pago <b className="ml-auto font-mono">{money(totalPagoMes)}</b></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FFC107" }} />Aguardando <b className="ml-auto font-mono">{money(totalAguardando)}</b></div>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Pagamentos por forma</h3>
              {Object.keys(porForma).length > 0 ? (
                <div className="space-y-2.5">
                  {Object.entries(porForma).sort((a, b) => b[1] - a[1]).map(([forma, valor]) => (
                    <div key={forma} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COR_FORMA[forma] }} />
                      <span className="text-[#1a1a1a]">{LABEL_FORMA[forma] ?? forma}</span>
                      <span className="ml-auto font-mono font-semibold">{money(valor)}</span>
                      <span className="text-[10.5px] text-[#adb5bd] w-9 text-right">{Math.round((valor / totalFormas) * 100)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-[#adb5bd]">Nenhum pagamento registrado ainda este mês.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Donut({ pago, total }: { pago: number; total: number }) {
  const raio = 30, circ = 2 * Math.PI * raio;
  const pct = total > 0 ? pago / total : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90">
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#FFE9A8" strokeWidth="10" />
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#2E7D57" strokeWidth="10" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x="38" y="42" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1a1a1a" transform="rotate(90 38 38)">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

function KpiMini({ label, value, sub, cor, bg }: { label: string; value: string | number; sub?: string; cor: string; bg: string }) {
  return (
    <div className="bg-white border border-linha rounded-xl p-4 shadow-leve">
      <div className="w-9 h-9 rounded-full grid place-items-center mb-2.5" style={{ background: bg }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
      </div>
      <div className="text-[11.5px] text-[#6c757d] font-medium">{label}</div>
      <div className="text-[15px] sm:text-[19px] font-bold text-[#1a1a1a] leading-none mt-1 truncate">{value}</div>
      {sub && <div className="text-[10.5px] text-[#adb5bd] mt-1.5">{sub}</div>}
    </div>
  );
}
