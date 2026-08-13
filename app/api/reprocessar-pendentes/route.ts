export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { baixarArquivoDoDrive } from "@/lib/google-drive";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";

// Reprocessa boletos que ficaram INCOMPLETOS na Caixa de Entrada (sem código de
// barras / dados faltando) por causa da API indisponível na época. Agora que a
// API funciona, rebaixa o PDF original pelo drive_file_id, relê e completa os
// dados — sem precisar recadastrar nada.
//
// Fluxo (conforme especificado):
//  1. Identifica os pendentes SEM código de barras;
//  2. Usa os dados já cadastrados (drive_file_id, nome do arquivo);
//  3. Relê pela API;
//  4. Completa/atualiza código de barras e demais campos;
//  5. Se leu o código de barras, atualiza o registro;
//  6. Se não conseguir, mantém como está para nova tentativa.

export async function POST() {
  const supabase = createClient();

  // 1 + 2: pendentes de boleto sem código de barras, que têm o arquivo no Drive
  const { data: pendentes, error } = await supabase
    .from("caixa_entrada_boletos")
    .select("id, drive_file_id, nome_arquivo, codigo_barras_detectado, classe_documento, status")
    .eq("status", "pendente")
    .is("codigo_barras_detectado", null)
    .not("drive_file_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const alvos = (pendentes ?? []).filter(
    (b: any) => b.classe_documento == null || b.classe_documento === "boleto"
  );

  let relidos = 0, completados = 0, semSucesso = 0, falhas = 0;
  const detalhes: any[] = [];

  for (const b of alvos) {
    try {
      // 3: rebaixa o PDF original e relê pela API
      const buffer = await baixarArquivoDoDrive(b.drive_file_id);
      const ex = await extrairDadosBoleto(buffer, b.nome_arquivo ?? "boleto.pdf", "application/pdf");
      relidos++;

      // 4 + 5: se agora leu o código de barras, completa o registro
      if (ex.codigo_barras) {
        const patch: any = { codigo_barras_detectado: ex.codigo_barras };
        // completa os demais campos SÓ se vieram (não apaga o que já existia)
        if (ex.valor != null) patch.valor_detectado = ex.valor;
        if (ex.fornecedor) patch.fornecedor_detectado = ex.fornecedor;
        if (ex.cnpj) patch.cnpj_detectado = ex.cnpj;
        if (ex.numero_documento) patch.numero_documento_detectado = ex.numero_documento;
        if (ex.tipo_conta) patch.tipo_detectado = ex.tipo_conta;
        if (ex.data_emissao) {
          patch.emissao_ano = ex.data_emissao.ano;
          patch.emissao_mes = ex.data_emissao.mes;
          patch.emissao_dia = ex.data_emissao.dia;
        }
        patch.observacao = null; // limpa o aviso antigo de falha
        await supabase.from("caixa_entrada_boletos").update(patch).eq("id", b.id);
        completados++;
        detalhes.push({ id: b.id, arquivo: b.nome_arquivo, resultado: "completado" });
      } else {
        // 6: não achou o código de barras — mantém pendente para nova tentativa
        semSucesso++;
        detalhes.push({ id: b.id, arquivo: b.nome_arquivo, resultado: "sem_codigo_barras" });
      }
    } catch (e: any) {
      falhas++;
      detalhes.push({ id: b.id, arquivo: b.nome_arquivo, resultado: "erro", motivo: e?.message ?? "erro" });
    }
  }

  return NextResponse.json({
    ok: true,
    candidatos: alvos.length,
    relidos,
    completados,
    sem_codigo_barras: semSucesso,
    falhas,
    detalhes,
  });
}
