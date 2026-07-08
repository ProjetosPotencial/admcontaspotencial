import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import ContasClient from "./contas-client";
import type { Conta } from "@/lib/types";
import { obterPeriodoAtual } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const supabase = createClient();
  const { ano, mes } = obterPeriodoAtual();
  const [{ data }, { data: lancAtual }, { data: lojas }] = await Promise.all([
    supabase
      .from("contas")
      .select("id, tipo, fornecedor_nome, identificador, dia_vencimento, origem, cnpj_cpf, insc_cod_mat, portal_link, eh_rateio, rateio_divisor, observacoes, status, loja_id, lojas ( codigo, coban )")
      .eq("situacao_cadastro", "aprovada")
      .order("tipo"),
    supabase
      .from("lancamentos")
      .select("conta_id, situacao")
      .eq("ano", ano)
      .eq("mes", mes),
    supabase
      .from("lojas")
      .select("id, codigo")
      .eq("status", "ativo")
      .order("codigo"),
  ]);

  const contas = (data ?? []) as unknown as Conta[];
  const situacaoPorConta: Record<string, string> = {};
  (lancAtual ?? []).forEach((l: any) => { situacaoPorConta[l.conta_id] = l.situacao; });

  return (
    <>
      <Topbar title="Contas de consumo" />
      <div className="px-8 py-6 max-w-[1240px] w-full">
        <ContasClient contas={contas} situacaoPorConta={situacaoPorConta} lojas={lojas ?? []} />
      </div>
    </>
  );
}
