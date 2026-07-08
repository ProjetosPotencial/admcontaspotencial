import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import AprovacoesClient from "./aprovacoes-client";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("id, valor, situacao, contas!inner ( tipo, fornecedor_nome, eh_rateio, lojas ( codigo, coban ) )")
    .eq("ano", 2026)
    .eq("mes", 7)
    .eq("situacao", "lancado")
    .limit(50);

  return (
    <>
      <Topbar eyebrow="Operação" title="Aprovações" />
      <div className="px-8 py-7 max-w-[1180px] w-full">
        <AprovacoesClient itens={(data ?? []) as any[]} />
      </div>
    </>
  );
}
