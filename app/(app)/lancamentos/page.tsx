import { createClient } from "@/lib/supabase/server";
import LancamentosClient from "./lancamentos-client";

export const dynamic = "force-dynamic";

export default async function LancamentosPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("id, ano, mes, valor, situacao, contas!inner ( tipo, fornecedor_nome, lojas ( codigo, coban ) )")
    .eq("ano", 2026)
    .order("mes", { ascending: false })
    .limit(500);

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Lançamentos</h1>
        <p className="text-[14px] text-[#666] mt-2.5">Todos os valores lançados em 2026, mês a mês</p>
      </div>
      <div className="px-8 pb-8 max-w-[1100px]">
        <LancamentosClient itens={(data ?? []) as any[]} />
      </div>
    </>
  );
}
