import { createClient } from "@/lib/supabase/server";
import FornecedoresClient from "./fornecedores-client";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("fornecedores")
    .select("id, nome, tipo_padrao, portal_padrao")
    .order("nome");

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Fornecedores</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">{(data ?? []).length} fornecedores cadastrados a partir das contas lançadas</p>
      </div>
      <div className="px-8 pb-8 max-w-[900px]">
        <FornecedoresClient fornecedores={(data ?? []) as any[]} />
      </div>
    </>
  );
}
