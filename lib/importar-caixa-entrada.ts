import { createAdminClient } from "@/lib/supabase/admin";
import { listarArquivosNaPasta, baixarArquivoDoDrive } from "@/lib/google-drive";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";

// tira acento, deixa minúsculo, tira espaço duplicado - pra comparar nome
// de arquivo com código de loja sem depender de escrita idêntica
function normalizar(texto: string): string {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function importarCaixaEntradaDrive() {
  const pastaId = process.env.GOOGLE_DRIVE_INBOX_FOLDER_ID;
  if (!pastaId) {
    return { ok: false as const, error: "GOOGLE_DRIVE_INBOX_FOLDER_ID não configurado." };
  }

  const supabase = createAdminClient();

  const [arquivos, { data: jaImportados }, { data: lojas }] = await Promise.all([
    listarArquivosNaPasta(pastaId),
    supabase.from("caixa_entrada_boletos").select("drive_file_id"),
    supabase.from("lojas").select("id, codigo").eq("status", "ativo"),
  ]);

  const idsJaImportados = new Set((jaImportados ?? []).map((r) => r.drive_file_id));
  const novos = arquivos.filter((a) => !idsJaImportados.has(a.id));

  if (novos.length === 0) {
    return { ok: true as const, novos: 0, mensagem: "Nenhum arquivo novo na pasta." };
  }

  const lojasNormalizadas = (lojas ?? []).map((l) => ({ id: l.id, codigo: l.codigo, norm: normalizar(l.codigo) }));

  let processados = 0;
  const erros: string[] = [];

  for (const arquivo of novos) {
    try {
      const buffer = await baixarArquivoDoDrive(arquivo.id);
      const extraido = await extrairDadosBoleto(buffer, arquivo.name, arquivo.mimeType);

      // tenta casar a loja pelo NOME DO ARQUIVO primeiro (mais confiável,
      // já que quem colocou o arquivo lá geralmente nomeia com a loja),
      // e só depois pelo que a IA leu dentro do documento.
      const nomeNorm = normalizar(arquivo.name);
      let lojaEncontrada = lojasNormalizadas.find((l) => nomeNorm.includes(l.norm));
      let confianca: "alta" | "media" | "baixa" = lojaEncontrada ? "alta" : "baixa";

      if (!lojaEncontrada && extraido.loja_mencionada) {
        const menorNorm = normalizar(extraido.loja_mencionada);
        lojaEncontrada = lojasNormalizadas.find((l) => menorNorm.includes(l.norm) || l.norm.includes(menorNorm));
        if (lojaEncontrada) confianca = "media";
      }

      // se achou a loja e também sabe o tipo, tenta achar a conta exata
      let contaId: string | null = null;
      if (lojaEncontrada && extraido.tipo_conta) {
        const { data: conta } = await supabase
          .from("contas")
          .select("id")
          .eq("loja_id", lojaEncontrada.id)
          .eq("tipo", extraido.tipo_conta)
          .eq("status", "ativo")
          .maybeSingle();
        if (conta) contaId = conta.id;
        else confianca = confianca === "alta" ? "media" : confianca;
      }

      await supabase.from("caixa_entrada_boletos").insert({
        drive_file_id: arquivo.id,
        nome_arquivo: arquivo.name,
        drive_web_view_link: arquivo.webViewLink,
        valor_detectado: extraido.valor,
        codigo_barras_detectado: extraido.codigo_barras,
        tipo_detectado: extraido.tipo_conta,
        loja_sugerida_id: lojaEncontrada?.id ?? null,
        loja_sugerida_texto: lojaEncontrada?.codigo ?? extraido.loja_mencionada ?? null,
        conta_sugerida_id: contaId,
        confianca: extraido.parece_documento_valido ? confianca : "baixa",
        observacao: extraido.parece_documento_valido ? null : "O arquivo não parece um boleto/fatura de verdade.",
      });
      processados++;
    } catch (err: any) {
      erros.push(`${arquivo.name}: ${err?.message ?? "erro desconhecido"}`);
    }
  }

  return { ok: true as const, novos: processados, erros: erros.length > 0 ? erros : undefined };
}
