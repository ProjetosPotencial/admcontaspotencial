import { createClient } from "@/lib/supabase/server";
import AprovacoesClient from "./aprovacoes-client";
import { obterPeriodoSelecionado } from "@/lib/periodo";
import { podeAcessar, SemPermissao } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  if (!(await podeAcessar("/aprovacoes"))) return <SemPermissao modulo="Aprovações" />;

  const supabase = createClient();
  const { ano, mes } = obterPeriodoSelecionado();

  const [{ data }, { data: resumoRaw }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("id, valor, situacao, comprovante_url, comprovante_drive_url, codigo_barras, contas!inner ( tipo, fornecedor_nome, eh_rateio, lojas ( codigo, coban, cidade, uf, empresas ( nome ) ) )")
      .eq("ano", ano).eq("mes", mes).eq("situacao", "lancado")
      .limit(50),
    supabase.from("lancamentos").select("valor, situacao").eq("ano", ano).eq("mes", mes).in("situacao", ["aprovado", "pago", "contestado"]),
  ]);

  const resumo = (resumoRaw ?? []).reduce(
    (acc, l: any) => {
      const key = l.situacao === "pago" ? "aprovado" : l.situacao; // pago já passou pela aprovação
      acc[key as "aprovado" | "contestado"].qtd += 1;
      acc[key as "aprovado" | "contestado"].total += Number(l.valor ?? 0);
      return acc;
    },
    { aprovado: { qtd: 0, total: 0 }, contestado: { qtd: 0, total: 0 } }
  );

  return <AprovacoesClient itens={(data ?? []) as any[]} resumoMes={resumo} />;
}
