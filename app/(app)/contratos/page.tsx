import { createClient } from "@/lib/supabase/server";
import ContratosClient from "./contratos-client";

export const dynamic = "force-dynamic";

export default async function ContratosPage({ searchParams }: { searchParams: { loja?: string } }) {
  const supabase = createClient();
  const [{ data: contratos }, { data: lojas }, { data: empresas }] = await Promise.all([
    supabase
      .from("contratos")
      .select("id, numero, loja_id, empresa_id, tipo, data_inicio, data_fim, valor, status, observacoes, lojas ( codigo ), empresas ( nome )")
      .order("created_at", { ascending: false }),
    supabase.from("lojas").select("id, codigo").order("codigo"),
    supabase.from("empresas").select("id, nome").eq("ativa", true).order("nome"),
  ]);

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Contratos</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Contratos de aluguel, prestação de serviço e afins, ligados a loja e empresa</p>
      </div>
      <div className="px-8 pb-8 max-w-[1100px]">
        <ContratosClient contratos={(contratos ?? []) as any[]} lojas={lojas ?? []} empresas={empresas ?? []} buscaInicial={searchParams.loja ?? ""} />
      </div>
    </>
  );
}
