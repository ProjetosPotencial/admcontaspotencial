import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import LojasClient from "./lojas-client";
import type { Loja } from "@/lib/loja-types";

export const dynamic = "force-dynamic";

export default async function LojasPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient();
  const [{ data }, { data: empresas }] = await Promise.all([
    supabase
      .from("lojas")
      .select("id, codigo, coban, tipo_pdv, setor, empresa, empresa_id, cnpj, contrato, endereco, cidade, uf, responsavel, contato, status, encerrada_em, motivo_encerramento")
      .order("codigo"),
    supabase.from("empresas").select("id, nome").eq("ativa", true).order("nome"),
  ]);

  return (
    <>
      <Topbar title="Lojas" />
      <div className="px-4 sm:px-8 py-5 sm:py-7 max-w-[1180px] w-full">
        <LojasClient lojas={(data ?? []) as Loja[]} statusInicial={searchParams.status} empresas={empresas ?? []} />
      </div>
    </>
  );
}
