import { createClient } from "@/lib/supabase/server";
import AprovacoesClient from "./aprovacoes-client";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("id, valor, situacao, comprovante_url, contas!inner ( tipo, fornecedor_nome, eh_rateio, lojas ( codigo, coban, cidade, uf ) )")
    .eq("ano", 2026)
    .eq("mes", 7)
    .eq("situacao", "lancado")
    .limit(50);

  return <AprovacoesClient itens={(data ?? []) as any[]} />;
}
