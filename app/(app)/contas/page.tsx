import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import ContasClient from "./contas-client";
import type { Conta } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("contas")
    .select("id, tipo, fornecedor_nome, identificador, dia_vencimento, origem, cnpj_cpf, insc_cod_mat, portal_link, eh_rateio, rateio_divisor, observacoes, status, lojas ( codigo, coban )")
    .eq("situacao_cadastro", "aprovada")
    .order("tipo");

  const contas = (data ?? []) as unknown as Conta[];

  return (
    <>
      <Topbar eyebrow="Operação" title="Contas de consumo" />
      <div className="px-8 py-7 max-w-[1180px] w-full">
        <ContasClient contas={contas} />
      </div>
    </>
  );
}
