import { createClient } from "@/lib/supabase/server";
import { TIPOS } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { money } from "@/lib/format";
import { obterPeriodoAtual } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function PagamentosPage() {
  const supabase = createClient();
  const { ano } = obterPeriodoAtual();
  const { data } = await supabase
    .from("lancamentos")
    .select("id, ano, mes, valor, situacao, aprovado_em, contas!inner ( tipo, fornecedor_nome, lojas ( codigo, coban ) )")
    .in("situacao", ["aprovado", "pago"])
    .eq("ano", ano)
    .order("aprovado_em", { ascending: false })
    .limit(200);

  const itens = (data ?? []) as any[];
  const prontosPagar = itens.filter((i) => i.situacao === "aprovado");
  const pagos = itens.filter((i) => i.situacao === "pago");
  const totalPronto = prontosPagar.reduce((s, i) => s + (i.valor ?? 0), 0);

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Pagamentos</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Lançamentos já aprovados, prontos para pagar ou já pagos</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[1000px] space-y-8">
        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a]">Prontos para pagamento</h2>
            <span className="text-[13px] text-[#adb5bd]">{prontosPagar.length} · {money(totalPronto)}</span>
          </div>
          <div className="card divide-y divide-[#f1f3f5]">
            {prontosPagar.map((i) => {
              const T = TIPOS[i.contas.tipo];
              return (
                <div key={i.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                  <TipoIcon tipo={i.contas.tipo} size={16} color={T?.c} />
                  <b className="font-semibold">{i.contas.lojas?.codigo}</b>
                  <span className="text-[#6c757d]">{i.contas.fornecedor_nome ?? "—"}</span>
                  <span className="ml-auto font-mono font-semibold">{money(i.valor)}</span>
                  <span className="badge bg-info-bg text-info">Aprovado</span>
                </div>
              );
            })}
            {prontosPagar.length === 0 && <div className="text-center py-10 text-[#adb5bd] text-[13px]">Nada aprovado aguardando pagamento agora.</div>}
          </div>
        </section>

        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-[16px] font-semibold text-[#1a1a1a]">Pagos</h2>
            <span className="text-[13px] text-[#adb5bd]">{pagos.length}</span>
          </div>
          <div className="card divide-y divide-[#f1f3f5]">
            {pagos.map((i) => {
              const T = TIPOS[i.contas.tipo];
              return (
                <div key={i.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                  <TipoIcon tipo={i.contas.tipo} size={16} color={T?.c} />
                  <b className="font-semibold">{i.contas.lojas?.codigo}</b>
                  <span className="text-[#6c757d]">{i.contas.fornecedor_nome ?? "—"}</span>
                  <span className="ml-auto font-mono font-semibold">{money(i.valor)}</span>
                  <span className="badge bg-ok-bg text-ok">Pago</span>
                </div>
              );
            })}
            {pagos.length === 0 && <div className="text-center py-10 text-[#adb5bd] text-[13px]">Nenhum pagamento registrado ainda em {ano}.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
