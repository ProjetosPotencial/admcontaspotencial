import { createClient } from "@/lib/supabase/server";
import { formatarPeriodo } from "@/lib/date-utils";
import { obterPeriodoSelecionado } from "@/lib/periodo";
import RelatoriosClient from "./relatorios-client";
import Comparativos from "./comparativos";
import { podeAcessar, SemPermissao } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  if (!(await podeAcessar("/relatorios"))) return <SemPermissao modulo="Relatórios" />;

  const supabase = createClient();
  const { ano } = obterPeriodoSelecionado();

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
      <p className="text-[14px] text-[#6c757d] mt-2.5">Comparativos por praça, fornecedor e evolução do consumo em {ano}</p>

      <div className="mt-6">
        <Comparativos lancamentos={(lancamentos ?? []) as any[]} ano={ano} />
      </div>

      <h2 className="text-[18px] font-bold text-[#1a1a1a] mt-8">Exportações</h2>
      <p className="text-[13px] text-[#6c757d] mt-1">Baixe os dados completos em CSV para trabalhar em planilha</p>
      <div className="max-w-[700px] mt-4">
        <RelatoriosClient
          lancamentos={(lancamentos ?? []) as any[]}
          centrosCusto={(centrosCusto ?? []) as any[]}
          ano={ano}
        />
      </div>
    </div>
  );
}