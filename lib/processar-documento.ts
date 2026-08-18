import type { SupabaseClient } from "@supabase/supabase-js";
import { extrairDadosBoleto, type ExtracaoBoleto } from "@/lib/extrair-boleto";
import { lerNomeArquivo, casarLoja, normalizar, type LojaBusca } from "@/lib/ler-nome-arquivo";

/**
 * "Arquivo solto vira card na Caixa de Entrada."
 *
 * Essa era a primeira metade do laço de importarCaixaEntradaDrive. Virou
 * função própria porque agora existem DUAS portas de entrada para o mesmo
 * funil - a pasta do Google Drive (cron diário) e o Slack (na hora em que a
 * loja sobe o arquivo no canal). As duas leem o documento pela mesma IA,
 * casam a loja pelas mesmas regras e gravam o mesmo tipo de card, então a
 * lógica mora aqui e não duplicada em cada porta.
 *
 * O fluxo de chamado do GLPI (NF + boleto agrupados num card só) continua
 * dentro do importador do Drive: é outra história, com outra chave de dedup.
 */

export type ResultadoCard = {
  /** o que a IA entendeu que o documento é */
  classe: "boleto" | "nota_fiscal";
  extraido: ExtracaoBoleto;
  /** código da loja que casou, quando casou */
  lojaCodigo: string | null;
  tipo: string | null;
  confianca: "alta" | "media" | "baixa";
  observacao: string | null;
  competencia: { ano: number | null; mes: number | null };
};

export type ParamsCard = {
  supabase: SupabaseClient;
  /** identidade da ORIGEM do arquivo; vira drive_file_id, a chave única de dedup */
  fonteId: string;
  nomeArquivo: string;
  /** link pra abrir o documento na hora da revisão */
  link: string | null;
  buffer: Buffer;
  mimeType: string;
  lojas: LojaBusca[];
  /** colunas a mais gravadas junto (origem_entrada, slack_*, requerente...) */
  extras?: Record<string, any>;
};

/**
 * Lê o documento, decide se é boleto ou nota fiscal e grava o card.
 * Deixa o erro subir pra quem chamou decidir o que fazer: o Drive acumula
 * numa lista de erros da rodada, o Slack responde na thread de quem enviou.
 */
export async function criarCardDeDocumento(params: ParamsCard): Promise<ResultadoCard> {
  const { supabase, fonteId, nomeArquivo, link, buffer, mimeType, lojas, extras = {} } = params;

  const extraido = await extrairDadosBoleto(buffer, nomeArquivo, mimeType);

  // Nota fiscal: não casa loja (é custo de empresa, não de loja). Guarda
  // fornecedor/CNPJ/número/emissão pra revisão e lançamento posterior.
  if (extraido.classe_documento === "nota_fiscal") {
    const confiancaNF: "media" | "baixa" =
      extraido.fornecedor && extraido.valor && extraido.data_emissao ? "media" : "baixa";

    const avisoDup = await avisoNotaDuplicada(supabase, extraido);
    const confianca = extraido.parece_documento_valido ? confiancaNF : "baixa";
    const observacao =
      avisoDup ?? (extraido.parece_documento_valido ? null : "O arquivo não parece um documento fiscal de verdade.");

    await supabase.from("caixa_entrada_boletos").insert({
      drive_file_id: fonteId,
      nome_arquivo: nomeArquivo,
      drive_web_view_link: link,
      classe_documento: "nota_fiscal",
      valor_detectado: extraido.valor,
      tipo_detectado: extraido.tipo_conta,
      fornecedor_detectado: extraido.fornecedor,
      cnpj_detectado: extraido.cnpj,
      destinatario_detectado: extraido.destinatario,
      destinatario_cnpj_detectado: extraido.destinatario_cnpj,
      chave_acesso: extraido.chave_acesso,
      numero_documento_detectado: extraido.numero_documento,
      codigo_barras_detectado: extraido.codigo_barras,
      emissao_ano: extraido.data_emissao?.ano ?? null,
      emissao_mes: extraido.data_emissao?.mes ?? null,
      emissao_dia: extraido.data_emissao?.dia ?? null,
      duplicada: !!avisoDup,
      confianca,
      observacao,
      ...extras,
    });

    return {
      classe: "nota_fiscal",
      extraido,
      lojaCodigo: null,
      tipo: extraido.tipo_conta,
      confianca,
      observacao,
      competencia: { ano: null, mes: null },
    };
  }

  // tenta casar a loja pelo NOME DO ARQUIVO primeiro (mais confiável,
  // já que quem colocou o arquivo lá geralmente nomeia com a loja),
  // e só depois pelo que a IA leu dentro do documento.
  // lê o nome do arquivo: tipo, competência e o texto que sobra pra loja
  const leitura = lerNomeArquivo(nomeArquivo);
  const casado = casarLoja(leitura.textoLoja, lojas);

  let lojaEncontrada: { id: string; codigo: string } | undefined =
    casado ? { id: casado.loja.id, codigo: casado.loja.codigo } : undefined;
  let confianca: "alta" | "media" | "baixa" = casado ? casado.confianca : "baixa";

  if (!lojaEncontrada && extraido.loja_mencionada) {
    const menorNorm = normalizar(extraido.loja_mencionada);
    const achada = lojas
      .map((l) => ({ loja: l, norm: normalizar(l.codigo) }))
      .find((c) => c.norm && (menorNorm.includes(c.norm) || c.norm.includes(menorNorm)));
    if (achada) {
      lojaEncontrada = { id: achada.loja.id, codigo: achada.loja.codigo };
      confianca = "media";
    }
  }

  // se achou a loja e também sabe o tipo, tenta achar a conta exata
  const tipo = leitura.tipo ?? extraido.tipo_conta;
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

  const confiancaFinal = extraido.parece_documento_valido ? confianca : "baixa";
  const observacao = extraido.parece_documento_valido ? null : "O arquivo não parece um boleto/fatura de verdade.";

  await supabase.from("caixa_entrada_boletos").insert({
    drive_file_id: fonteId,
    nome_arquivo: nomeArquivo,
    drive_web_view_link: link,
    classe_documento: "boleto",
    valor_detectado: extraido.valor,
    codigo_barras_detectado: extraido.codigo_barras,
    // o nome do arquivo é mais confiável que a leitura do PDF pro tipo
    tipo_detectado: tipo,
    competencia_ano: leitura.ano,
    competencia_mes: leitura.mes,
    loja_sugerida_id: lojaEncontrada?.id ?? null,
    loja_sugerida_texto: lojaEncontrada?.codigo ?? extraido.loja_mencionada ?? null,
    conta_sugerida_id: contaId,
    confianca: confiancaFinal,
    observacao,
    ...extras,
  });

  return {
    classe: "boleto",
    extraido,
    lojaCodigo: lojaEncontrada?.codigo ?? null,
    tipo,
    confianca: confiancaFinal,
    observacao,
    competencia: { ano: leitura.ano, mes: leitura.mes },
  };
}

/**
 * Já processamos essa MESMA nota antes (número + CNPJ/fornecedor)?
 * O drive_file_id já barra o mesmo arquivo; aqui pegamos a mesma NF
 * reenviada como outro arquivo. Avisa quando e por quem foi lançada.
 */
async function avisoNotaDuplicada(supabase: SupabaseClient, extraido: ExtracaoBoleto): Promise<string | null> {
  if (!extraido.numero_documento || !(extraido.cnpj || extraido.fornecedor)) return null;

  let dq = supabase
    .from("caixa_entrada_boletos")
    .select("status, revisado_em, revisado_por")
    .eq("classe_documento", "nota_fiscal")
    .eq("numero_documento_detectado", extraido.numero_documento);
  dq = extraido.cnpj ? dq.eq("cnpj_detectado", extraido.cnpj) : dq.eq("fornecedor_detectado", extraido.fornecedor);

  const { data: dups } = await dq.order("revisado_em", { ascending: false, nullsFirst: false });
  const anterior = (dups ?? []).find((d: any) => d.status === "confirmado") ?? (dups ?? [])[0];
  if (!anterior) return null;

  let quem = "outro usuário";
  if (anterior.revisado_por) {
    const { data: p } = await supabase.from("perfis").select("nome").eq("id", anterior.revisado_por).maybeSingle();
    quem = p?.nome ?? quem;
  }
  const quando = anterior.revisado_em
    ? new Date(anterior.revisado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "data anterior";

  return anterior.status === "confirmado"
    ? `Atenção: NF nº ${extraido.numero_documento} já foi lançada em ${quando} por ${quem}.`
    : `Atenção: NF nº ${extraido.numero_documento} já está na caixa (importada em ${quando}).`;
}