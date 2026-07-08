import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { money } from "@/lib/format";
import { obterPeriodoAtual } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function CentrosDeCustoPage() {
  const supabase = createClient();
  const { ano } = obterPeriodoAtual();

  const { data } = await supabase
    .from("lancamentos")
    .select("valor, contas!inner ( loja_id, lojas ( codigo, coban ) )")
    .eq("ano", ano)
    .not("valor", "is", null);

  const porLoja: Record<string, { codigo: string; coban: string; total: number; qtd: number }> = {};
  (data ?? []).forEach((l: any) => {
    const lj = l.contas?.lojas;
    const id = l.contas?.loja_id;
    if (!lj || !id) return;
    if (!porLoja[id]) porLoja[id] = { codigo: lj.codigo, coban: lj.coban, total: 0, qtd: 0 };
    porLoja[id].total += Number(l.valor);
    porLoja[id].qtd += 1;
  });

  const ranking = Object.values(porLoja).sort((a, b) => b.total - a.total).slice(0, 40);
  const totalGeral = ranking.reduce((s, x) => s + x.total, 0);

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Centros de custo</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Gasto acumulado de {ano} por loja, com base nos lançamentos reais</p>
      </div>
      <div className="px-8 pb-8 max-w-[900px]">
        <div className="card overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f1f3f5] h-12">
                <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Loja</th>
                <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Lançamentos</th>
                <th className="text-right text-[12px] font-semibold text-[#1a1a1a] px-4">Total {ano}</th>
                <th className="text-right text-[12px] font-semibold text-[#1a1a1a] px-4">% do total</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={i} className="h-12 border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa]">
                  <td className="px-4 text-[13px] font-medium">
                    <Link href="/lojas" className="hover:text-info">{r.codigo}</Link>
                    <small className="block text-[#adb5bd] text-[11px] font-mono">{r.coban}</small>
                  </td>
                  <td className="px-4 text-[13px] font-mono text-[#6c757d]">{r.qtd}</td>
                  <td className="px-4 text-[13px] font-mono font-semibold text-right">{money(r.total)}</td>
                  <td className="px-4 text-[12px] text-[#adb5bd] text-right">{totalGeral ? ((r.total / totalGeral) * 100).toFixed(1) : "0"}%</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-[#adb5bd]">Sem lançamentos com valor em {ano}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
