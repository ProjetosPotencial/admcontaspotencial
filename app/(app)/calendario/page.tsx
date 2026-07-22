import { createClient } from "@/lib/supabase/server";
import { TIPOS } from "@/lib/types";
import { podeAcessar, SemPermissao } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  if (!(await podeAcessar("/calendario"))) return <SemPermissao modulo="Calendário" />;
  const supabase = createClient();
  const { data } = await supabase
    .from("contas")
    .select("tipo, dia_vencimento, fornecedor_nome, lojas ( codigo )")
    .eq("situacao_cadastro", "aprovada")
    .eq("status", "ativo")
    .not("dia_vencimento", "is", null);

  const porDia: Record<number, any[]> = {};
  (data ?? []).forEach((c: any) => {
    const d = c.dia_vencimento;
    if (!porDia[d]) porDia[d] = [];
    porDia[d].push(c);
  });

  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Calendário</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Vencimentos recorrentes das contas ativas, por dia do mês</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[1100px]">
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {dias.map((d) => {
            const itens = porDia[d] ?? [];
            const hojeMarcador = d === diaAtual;
            return (
              <div key={d} className={`card p-3 min-h-[92px] ${hojeMarcador ? "border-amarelo border-2" : ""}`}>
                <div className={`text-[13px] font-bold ${hojeMarcador ? "text-amarelo" : "text-[#1a1a1a]"}`}>{d}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {itens.slice(0, 4).map((c, i) => (
                    <span key={i} title={`${TIPOS[c.tipo]?.n} · ${c.lojas?.codigo}`} className="w-2 h-2 rounded-full" style={{ background: TIPOS[c.tipo]?.c }} />
                  ))}
                  {itens.length > 4 && <span className="text-[9px] text-[#adb5bd]">+{itens.length - 4}</span>}
                </div>
                {itens.length > 0 && <div className="text-[10px] text-[#adb5bd] mt-1">{itens.length} conta{itens.length > 1 ? "s" : ""}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
