import { createClient } from "@/lib/supabase/server";
import CaixaEntradaClient from "./caixa-entrada-client";

export const dynamic = "force-dynamic";

export default async function CaixaEntradaPage() {
  const supabase = createClient();

  const [{ data: pendentes }, { data: lojas }] = await Promise.all([
    supabase
      .from("caixa_entrada_boletos")
      .select("id, nome_arquivo, drive_web_view_link, valor_detectado, codigo_barras_detectado, tipo_detectado, loja_sugerida_id, loja_sugerida_texto, conta_sugerida_id, confianca, status, observacao, importado_em")
      .eq("status", "pendente")
      .order("importado_em", { ascending: false }),
    supabase.from("lojas").select("id, codigo").eq("status", "ativo").order("codigo"),
  ]);

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Caixa de entrada</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Boletos importados de uma pasta do Google Drive, aguardando confirmação antes de virar lançamento.</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[1100px]">
        <CaixaEntradaClient itens={(pendentes ?? []) as any[]} lojas={lojas ?? []} />
      </div>
    </>
  );
}
