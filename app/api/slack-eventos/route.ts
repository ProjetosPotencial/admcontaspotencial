import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { assinaturaSlackValida } from "@/lib/slack-arquivos";
import { enfileirarArquivoSlack, processarItemFila } from "@/lib/slack-fila";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Entrada de arquivos pelo Slack.
 *
 * A loja posta o boleto no canal, o Slack manda o evento aqui, e o arquivo
 * entra na Caixa de Entrada já lido pela IA - mesmo destino dos arquivos que
 * chegam pela pasta do Drive, só que na hora em vez de esperar o cron.
 *
 * O Slack corta a conexão em 3 segundos e reenvia o evento até 3 vezes. Ler
 * um PDF leva bem mais que isso, então aqui a gente só enfileira e responde
 * 200 na mesma hora; a leitura roda no waitUntil, depois da resposta.
 */
export async function POST(req: NextRequest) {
  // precisa do corpo CRU: a assinatura é calculada sobre os bytes exatos,
  // e um JSON.parse + stringify mudaria espaçamento e invalidaria o HMAC.
  const corpoCru = await req.text();

  if (!assinaturaSlackValida(corpoCru, req.headers.get("x-slack-signature"), req.headers.get("x-slack-request-timestamp"))) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let evento: any;
  try {
    evento = JSON.parse(corpoCru);
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  // Handshake de quando se cadastra a URL no painel do Slack.
  if (evento.type === "url_verification") {
    return NextResponse.json({ challenge: evento.challenge });
  }

  // Reenvio por timeout: já estamos processando, não enfileira de novo.
  if (req.headers.get("x-slack-retry-num")) {
    return NextResponse.json({ ok: true });
  }

  if (evento.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const e = evento.event ?? {};

  // Só arquivo compartilhado interessa. O bot também escuta as próprias
  // mensagens de resposta na thread; ignorar bot_id evita esse laço.
  if (e.type !== "file_shared" || e.bot_id) {
    return NextResponse.json({ ok: true });
  }

  // Canal dedicado: qualquer outro canal onde o bot esteja é ignorado de
  // propósito, pra ninguém gerar lançamento sem querer ao compartilhar um PDF.
  const canalPermitido = process.env.SLACK_CANAL_BOLETOS;
  if (canalPermitido && e.channel_id !== canalPermitido) {
    return NextResponse.json({ ok: true, ignorado: "fora do canal de boletos" });
  }

  try {
    const item = await enfileirarArquivoSlack({
      fileId: e.file_id ?? e.file?.id,
      canal: e.channel_id ?? null,
      threadTs: e.event_ts ?? null,
      usuarioId: e.user_id ?? null,
    });

    // Já responde ao Slack; a leitura continua rodando em background.
    if (item) waitUntil(processarItemFila(item));
  } catch (err: any) {
    // Devolve 200 mesmo assim: com erro o Slack reenvia o evento 3 vezes
    // seguidas, e se o problema for a nossa ponta isso só multiplica a falha.
    console.error("[slack-eventos]", err?.message ?? err);
  }

  return NextResponse.json({ ok: true });
}
