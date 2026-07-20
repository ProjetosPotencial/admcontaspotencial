import { createClient } from "@/lib/supabase/server";
import EmpresasClient from "./empresas-client";
import type { Empresa } from "@/lib/empresa-types";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const supabase = createClient();
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nome, razao_social, cnpj, observacoes, ativa")
    .order("nome");

  const { data: lojasPorEmpresa } = await supabase
    .from("lojas")
    .select("empresa_id")
    .not("empresa_id", "is", null);

  const contagem: Record<string, number> = {};
  (lojasPorEmpresa ?? []).forEach((l: any) => {
    contagem[l.empresa_id] = (contagem[l.empresa_id] ?? 0) + 1;
  });

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Empresas</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">As empresas do grupo que possuem lojas ou contratos vinculados</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[900px]">
        <EmpresasClient empresas={(empresas ?? []) as Empresa[]} contagemLojas={contagem} />
      </div>
    </>
  );
}
