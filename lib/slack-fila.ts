import { createAdminClient } from "@/lib/supabase/admin";
import { criarCardDeDocumento, type ResultadoCard } from "@/lib/processar-documento";
import { arquivarDocumentoDoSlack } from "@/lib/google-drive";
import { baixarArquivoDoSlack, nomeDoUsuario, obterArquivo, responderNaThread } from "@/lib/slack-arquivos";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";

/**
 * Fila dos arquivos que chegaram pelo Slack.
 *
 * Existe por uma exigência do Slack: ele desiste do evento se a resposta
 * demorar mais de 3 segundos, e reenvia até 3 vezes. Ler um PDF com a IA leva
 * uns 15s. Então a rota só ENFILEIRA (rápido) e confirma; a leitura acontece
 * depois, com waitUntil. Se aquela execução morrer no meio, o item continua
 * "pendente" aqui e o cron diário do Drive recolhe.
 *
 * O índice único em slack_file_id é o que torna o reenvio do Slack inofensivo:
 * a segunda tentativa do mesmo arquivo não cria uma segunda linha.
 */

/** Formatos que a leitura por IA aceita. Vídeo, áudio e planilha não entram. */
const TIPOS_ACEITOS = /^(application\/pdf|image\/(jpeg|png|gif|webp))$/;

/** Teto de tamanho: acima disso a API da Anthropic recusa o documento. */
const TAMANHO_MAXIMO = 20 * 1024 * 1024;

export type ItemFila = {
  id: string;
  slack_file_id: string;
  canal: string | null;
  thread_ts: string | null;
  usuario_id: string | null;
  tentativas: number;
};

/**
 * Registra o arquivo pra ser lido. Não baixa nem lê nada aqui - é chamada de
 * dentro da requisição do evento, que precisa responder em 3 segundos.
 * Devolve o item quando é novo, e null quando o Slack só reenviou algo que
 * já está na fila.
 */
export async function enfileirarArquivoSlack(params: {
  fileId: string;
  canal: string | null;
  threadTs: string | null;
  usuarioId: string | null;
}): Promise<ItemFila | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("slack_fila")
    .insert({
      slack_file_id: params.fileId,
      canal: params.canal,
      thread_ts: params.threadTs,
      usuario_id: params.usuarioId,
    })
    .select("id, slack_file_id, canal, thread_ts, usuario_id, tentativas")
    .maybeSingle();

  // 23505 = violação do índice único: reenvio do mesmo arquivo, ignora.
  if (error) {
    if ((error as any).code === "23505") return null;
    throw new Error(`não consegui enfileirar: ${error.message}`);
  }
  return (data as ItemFila) ?? null;
}

/**
 * Processa um item: baixa do Slack, arquiva no Drive, lê com a IA, cria o
 * card e responde na thread. Cada etapa que falha vira mensagem pra quem
 * enviou - ninguém fica esperando um boleto que nunca entrou.
 */
export async function processarItemFila(item: ItemFila): Promise<void> {
  const supabase = createAdminClient();

  // "Pega" o item: só quem conseguir mudar de pendente pra processando é que
  // segue. Impede que o waitUntil e o cron leiam o mesmo arquivo em paralelo
  // e gerem dois cards.
  const { data: pego } = await supabase
    .from("slack_fila")
    .update({ status: "processando", tentativas: item.tentativas + 1 })
    .eq("id", item.id)
    .eq("status", "pendente")
    .select("id");

  if (!pego || pego.length === 0) return;

  const avisar = (texto: string) =>
    item.canal ? responderNaThread(item.canal, item.thread_ts ?? undefined, texto) : Promise.resolve();

  try {
    const arquivo = await obterArquivo(item.slack_file_id);

    if (!TIPOS_ACEITOS.test(arquivo.mimetype)) {
      await concluir(item.id, "ignorado", `formato não aceito (${arquivo.mimetype})`);
      await avisar(`:no_entry_sign: *${arquivo.name}* não é PDF nem imagem, então não dá pra ler. Manda o boleto em PDF ou foto.`);
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      await concluir(item.id, "ignorado", `arquivo grande demais (${Math.round(arquivo.size / 1024 / 1024)} MB)`);
      await avisar(`:no_entry_sign: *${arquivo.name}* tem mais de 20 MB e não consigo ler. Manda uma versão menor.`);
      return;
    }

    const buffer = await baixarArquivoDoSlack(arquivo.url_private_download);

    // arquiva antes de ler: se a IA falhar, o documento já está guardado e
    // o reprocessamento não depende do arquivo continuar no Slack.
    let link: string | null = null;
    try {
      const guardado = await arquivarDocumentoDoSlack({
        arquivo: buffer,
        nomeArquivo: arquivo.name,
        mimeType: arquivo.mimetype,
        pastaMes: mesAtualBrasil(),
      });
      link = guardado.webViewLink;
    } catch {
      // Drive fora do ar não impede o lançamento: o card entra sem link e a
      // pessoa confere pelo próprio Slack.
    }

    const [{ data: lojas }, requerente] = await Promise.all([
      supabase.from("lojas").select("id, codigo, nome, cidade").eq("status", "ativo"),
      item.usuario_id ? nomeDoUsuario(item.usuario_id) : Promise.resolve(null),
    ]);

    const resultado = await criarCardDeDocumento({
      supabase,
      // prefixo "slack:" mantém a identidade da ORIGEM na chave de dedup, que
      // é compartilhada com os arquivos vindos do Drive.
      fonteId: `slack:${arquivo.id}`,
      nomeArquivo: arquivo.name,
      link,
      buffer,
      mimeType: arquivo.mimetype,
      lojas: (lojas ?? []) as any,
      extras: {
        origem_entrada: "slack",
        slack_canal: item.canal,
        slack_ts: item.thread_ts,
        slack_usuario_id: item.usuario_id,
        requerente,
      },
    });

    await concluir(item.id, "concluido", null);
    await avisar(mensagemDoResultado(resultado, arquivo.name));
  } catch (err: any) {
    const msg = err?.message ?? "erro desconhecido";
    // volta pra "pendente" nas duas primeiras falhas, pro cron tentar de novo;
    // na terceira desiste, pra não ficar batendo num arquivo que nunca vai ler.
    const desistiu = item.tentativas + 1 >= 3;
    await concluir(item.id, desistiu ? "erro" : "pendente", msg);
    if (desistiu) {
      await avisar(`:warning: Não consegui ler esse arquivo depois de 3 tentativas: ${msg}`);
    }
  }
}

async function concluir(id: string, status: string, erro: string | null): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("slack_fila")
    .update({ status, erro, processado_em: status === "pendente" ? null : new Date().toISOString() })
    .eq("id", id);
}

/**
 * Recolhe o que ficou pendente. Chamada pelo cron diário do Drive - é a rede
 * de segurança pra quando o processamento na hora não completou.
 */
export async function processarFilaSlack(opcoes: { limite?: number } = {}): Promise<{ processados: number; erros: string[] }> {
  const supabase = createAdminClient();
  const erros: string[] = [];

  const { data: pendentes } = await supabase
    .from("slack_fila")
    .select("id, slack_file_id, canal, thread_ts, usuario_id, tentativas")
    .eq("status", "pendente")
    .lt("tentativas", 3)
    .order("criado_em", { ascending: true })
    .limit(opcoes.limite ?? 20);

  let processados = 0;
  for (const item of (pendentes ?? []) as ItemFila[]) {
    try {
      await processarItemFila(item);
      processados++;
    } catch (err: any) {
      erros.push(`${item.slack_file_id}: ${err?.message ?? "erro"}`);
    }
  }
  return { processados, erros };
}

/** "2026-08" no fuso de São Paulo — a Vercel roda em UTC. */
function mesAtualBrasil(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" });
  return fmt.format(new Date()).slice(0, 7);
}

/**
 * O retorno pra quem postou. Diz o que foi entendido em vez de só "recebido":
 * é isso que deixa a pessoa perceber na hora que mandou o arquivo errado,
 * em vez de descobrir dias depois na conferência.
 */
function mensagemDoResultado(r: ResultadoCard, nomeArquivo: string): string {
  const url = process.env.APP_URL?.replace(/\/$/, "");
  const linkCaixa = url ? ` <${url}/caixa-entrada|Abrir a Caixa de Entrada>` : "";

  if (!r.extraido.parece_documento_valido) {
    return `:warning: Recebi *${nomeArquivo}*, mas não parece um boleto nem uma nota fiscal. Está na Caixa de Entrada marcado pra revisão manual.${linkCaixa}`;
  }

  const partes: string[] = [];

  if (r.classe === "nota_fiscal") {
    if (r.extraido.numero_documento) partes.push(`NF nº ${r.extraido.numero_documento}`);
    if (r.extraido.fornecedor) partes.push(r.extraido.fornecedor);
  } else {
    if (r.tipo) partes.push(TIPOS[r.tipo]?.n ?? r.tipo);
    if (r.lojaCodigo) partes.push(r.lojaCodigo);
    if (r.extraido.dia_vencimento) partes.push(`vence dia ${r.extraido.dia_vencimento}`);
  }
  if (r.extraido.valor != null) partes.push(money(r.extraido.valor));

  const resumo = partes.length > 0 ? partes.join(" · ") : nomeArquivo;

  // Quando a loja não foi identificada, é melhor dizer isso do que fingir que
  // está tudo certo — alguém vai ter que escolher a loja na mão.
  if (r.classe === "boleto" && !r.lojaCodigo) {
    return `:mag: Li *${resumo}*, mas não identifiquei a loja. Está na Caixa de Entrada esperando alguém escolher.${linkCaixa}`;
  }
  if (r.confianca === "baixa") {
    return `:mag: Li *${resumo}*, mas com pouca certeza. Confere antes de lançar.${linkCaixa}`;
  }
  if (r.observacao) {
    return `:warning: Li *${resumo}*. ${r.observacao}${linkCaixa}`;
  }
  return `:white_check_mark: Li *${resumo}*. Está na Caixa de Entrada aguardando confirmação.${linkCaixa}`;
}
