import { createClient } from "@/lib/supabase/server";
import AprovacoesClient from "./aprovacoes-client";
import { obterPeriodoAtual } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  const supabase = createClient();
  const { ano, mes } = obterPeriodoAtual();
  const { data } = await supabase
    .from("lancamentos")
    .select("id, valor, situacao, comprovante_url, comprovante_drive_url, contas!inner ( tipo, fornecedor_nome, eh_rateio, lojas ( codigo, coban, cidade, uf ) )")
    .eq("ano", ano)
    .eq("mes", mes)
    .eq("situacao", "lancado")
    .limit(50);

  return <AprovacoesClient itens={(data ?? []) as any[]} />;
}
