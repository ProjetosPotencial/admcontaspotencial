export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { baixarArquivoDoDrive } from "@/lib/google-drive";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";

// Relê as NF/boletos dos CHAMADOS que ficaram pendentes na Caixa de Entrada
// (a leitura por IA falhava antes; agora funciona). Usa os PDFs que já estão
// registrados no chamado (chamado_file_ids), sem depender de reimportar.
//
// Fluxo:
//  1. Pega os chamados pendentes que têm arquivos registrados;
//  2. Rebaixa cada PDF pelo id e relê pela IA;
//  3. Completa NF (fornecedor, cnpj, nº, emissão, chave) e boleto (valor, código);
//  4. Se leu algo útil, atualiza o card e tira a pendência;
//  5. Se não, mantém pendente pra nova tentativa.

export async function POST() {
  const supabase = createClient();

  // 1: chamados pendentes com arquivos registrados
  const { data: chamados, error } = await supabase
    .from("caixa_entrada_boletos")
    .select("id, chamado_numero, chamado_file_ids, fornecedor_detectado, valor_detectado, codigo_barras_detectado, status, classe_documento")
    .eq("status", "pendente")
    .eq("classe_documento", "chamado")
    .not("chamado_file_ids", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let relidos = 0, completados = 0, semSucesso = 0, falhas = 0;
  const detalhes: any[] = [];

  for (const ch of chamados ?? []) {
    const ids = String(ch.chamado_file_ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) { semSucesso++; continue; }

    try {
      let nf: any = null, boleto: any = null;
      for (const fileId of ids) {
        try {
          const buf = await baixarArquivoDoDrive(fileId);
          const ex = await extrairDadosBoleto(buf, "documento.pdf", "application/pdf");
          if (!nf && ex.classe_documento === "nota_fiscal") nf = ex;
          else if (!boleto && (ex.codigo_barras || ex.classe_documento === "boleto")) boleto = ex;
          else if (!nf && (ex.fornecedor || ex.numero_documento)) nf = ex;
        } catch { /* um PDF ruim não derruba o chamado */ }
      }
      relidos++;

      // 3 + 4: se leu algo útil, completa o card (sem apagar o que já existia)
      const leuAlgo = !!(nf?.fornecedor || nf?.numero_documento || boleto?.codigo_barras || boleto?.valor || nf?.valor);
      if (leuAlgo) {
        const patch: any = {};
        if (nf?.fornecedor) patch.fornecedor_detectado = nf.fornecedor;
        if (nf?.cnpj) patch.cnpj_detectado = nf.cnpj;
        if (nf?.destinatario) patch.destinatario_detectado = nf.destinatario;
        if (nf?.destinatario_cnpj) patch.destinatario_cnpj_detectado = nf.destinatario_cnpj;
        if (nf?.chave_acesso) patch.chave_acesso = nf.chave_acesso;
        if (nf?.numero_documento) patch.numero_documento_detectado = nf.numero_documento;
        if (nf?.data_emissao) {
          patch.emissao_ano = nf.data_emissao.ano;
          patch.emissao_mes = nf.data_emissao.mes;
          patch.emissao_dia = nf.data_emissao.dia;
        }
        if (boleto?.codigo_barras) patch.codigo_barras_detectado = boleto.codigo_barras;
        const valor = boleto?.valor ?? nf?.valor ?? null;
        if (valor != null) patch.valor_detectado = valor;
        // tem NF e (boleto ou não precisa) → sai da pendência
        const temNf = !!(nf?.fornecedor || nf?.numero_documento);
        patch.confianca = temNf ? "media" : "baixa";
        patch.observacao = temNf ? null : "Pendente de conferência: leitura parcial.";
        await supabase.from("caixa_entrada_boletos").update(patch).eq("id", ch.id);
        completados++;
        detalhes.push({ id: ch.id, chamado: ch.chamado_numero, resultado: "completado" });
      } else {
        semSucesso++;
        detalhes.push({ id: ch.id, chamado: ch.chamado_numero, resultado: "sem_leitura" });
      }
    } catch (e: any) {
      falhas++;
      detalhes.push({ id: ch.id, chamado: ch.chamado_numero, resultado: "erro", motivo: e?.message ?? "erro" });
    }
  }

  return NextResponse.json({
    ok: true,
    candidatos: (chamados ?? []).length,
    relidos,
    completados,
    sem_leitura: semSucesso,
    falhas,
    detalhes,
  });
}
