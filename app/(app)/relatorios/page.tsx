import { createClient } from "@/lib/supabase/server";
import { obterPeriodoAtual, formatarPeriodo } from "@/lib/date-utils";
import RelatoriosClient from "./relatorios-client";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const supabase = createClient();
  const { ano } = obterPeriodoAtual();

  const [{ data: lancamentos }, { data: centrosCusto }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("ano, mes, valor, situacao, contas!inner ( tipo, fornecedor_nome, lojas ( codigo, coban ) )")
      .eq("ano", ano),
    supabase
      .from("lancamentos")
      .select("valor, contas!inner ( loja_id, lojas ( codigo, coban ) )")
      .eq("ano", ano)
      .not("valor", "is", null),
  ]);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8">
      <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Relatórios</h1>
      <p className="text-[14px] text-[#6c757d] mt-2.5">Exportações reais de {formatarPeriodo(1, ano).split("/")[1]}, prontas para baixar em CSV</p>
      <div className="max-w-[700px] mt-6">
        <RelatoriosClient
          lancamentos={(lancamentos ?? []) as any[]}
          centrosCusto={(centrosCusto ?? []) as any[]}
          ano={ano}
        />
      </div>
    </div>
  );
}
