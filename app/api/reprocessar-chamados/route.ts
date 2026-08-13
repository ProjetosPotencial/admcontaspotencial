export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { baixarArquivoDoDrive } from "@/lib/google-drive";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";

// Relê as NF dos CHAMADOS que ficaram ILEGÍVEIS na Caixa de Entrada (a leitura
// por IA falhava antes; agora funciona). Processa em LOTE pequeno pra não
// estourar o tempo — clique de novo até zerar. Usa os PDFs já registrados no
// chamado (chamado_file_ids), sem reimportar do Drive.

const LOTE = 8; // quantos chamados por clique (cada um baixa e lê PDFs)

export async function POST() {
  const supabase = createClient();

  // Só os ILEGÍVEIS: pendentes, do tipo chamado, SEM fornecedor lido e COM
  // arquivos registrados. Os que já têm fornecedor/valor não entram (já leram —
  // esses só precisam ser confirmados na tela, não relidos).
  const { data: chamados, error } = await supabase
    .from("caixa_entrada_boletos")
    .select("id, chamado_numero, chamado_file_ids")
    .eq("status", "pendente")
    .eq("classe_documento", "chamado")
    .is("fornecedor_detectado", null)
    .not("chamado_file_ids", "is", null)
    .limit(LOTE);

  if (error) return NextResponse.json({ error: `Erro ao buscar chamados: ${error.message}` }, { status: 500 });

  const alvos = (chamados ?? []).filter((c) => String(c.chamado_file_ids || "").trim().length > 0);

  let relidos = 0, completados = 0, semLeitura = 0, falhas = 0;
  const detalhes: any[] = [];

  for (const ch of alvos) {
    const ids = String(ch.chamado_file_ids).split(",").map((s) => s.trim()).filter(Boolean);
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
        const temNf = !!(nf?.fornecedor || nf?.numero_documento);
        patch.confianca = temNf ? "media" : "baixa";
        patch.observacao = temNf ? null : "Pendente de conferência: leitura parcial.";
        await supabase.from("caixa_entrada_boletos").update(patch).eq("id", ch.id);
        completados++;
        detalhes.push({ chamado: ch.chamado_numero, resultado: "lido", fornecedor: nf?.fornecedor ?? null });
      } else {
        semLeitura++;
        detalhes.push({ chamado: ch.chamado_numero, resultado: "sem_leitura" });
      }
    } catch (e: any) {
      falhas++;
      detalhes.push({ chamado: ch.chamado_numero, resultado: "erro", motivo: e?.message ?? "erro" });
    }
  }

  return NextResponse.json({
    ok: true,
    lote: LOTE,
    candidatos: alvos.length,
    relidos,
    completados,
    sem_leitura: semLeitura,
    falhas,
    detalhes,
  });
}
