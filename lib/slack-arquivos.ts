import crypto from "crypto";

/**
 * Conversa com a API do Slack no sentido ENTRADA: valida que o evento veio
 * mesmo do Slack, baixa o arquivo que a loja postou e responde na thread.
 *
 * O aviso diário/semanal (lib/slack-resumo.ts) é o sentido contrário e usa
 * webhook, que não serve aqui: baixar arquivo e responder em thread exigem
 * um bot token de verdade (xoxb-).
 */

const API = "https://slack.com/api";

function botToken(): string {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error("SLACK_BOT_TOKEN não configurado.");
  return t;
}

/**
 * Confere a assinatura do Slack (v0 = HMAC-SHA256 sobre "v0:timestamp:corpo").
 *
 * Sem isso a rota seria pública: qualquer um que descobrisse a URL poderia
 * mandar um JSON forjado e criar lançamento. Recusa também eventos com mais
 * de 5 minutos, que é a janela recomendada contra replay.
 */
export function assinaturaSlackValida(corpoCru: string, assinatura: string | null, timestamp: string | null): boolean {
  const segredo = process.env.SLACK_SIGNING_SECRET;
  if (!segredo || !assinatura || !timestamp) return false;

  const idade = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(idade) || idade > 60 * 5) return false;

  const esperada = "v0=" + crypto.createHmac("sha256", segredo).update(`v0:${timestamp}:${corpoCru}`).digest("hex");

  // timingSafeEqual estoura se os tamanhos diferirem, daí a checagem antes
  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(assinatura, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type ArquivoSlack = {
  id: string;
  name: string;
  mimetype: string;
  url_private_download: string;
  size: number;
  user?: string;
};

/** Detalhes do arquivo. O evento file_shared só traz o id, o resto vem daqui. */
export async function obterArquivo(fileId: string): Promise<ArquivoSlack> {
  const resp = await fetch(`${API}/files.info?file=${encodeURIComponent(fileId)}`, {
    headers: { authorization: `Bearer ${botToken()}` },
  });
  const json: any = await resp.json();
  if (!json.ok) throw new Error(`files.info falhou: ${json.error ?? "erro desconhecido"}`);

  const f = json.file ?? {};
  return {
    id: f.id,
    name: f.name ?? "sem-nome",
    mimetype: f.mimetype ?? "application/octet-stream",
    url_private_download: f.url_private_download ?? f.url_private,
    size: f.size ?? 0,
    user: f.user,
  };
}

/**
 * Baixa os bytes do arquivo. A URL é privada: sem o header de autorização o
 * Slack devolve uma página HTML de login em vez do PDF - por isso a checagem
 * do content-type, senão a IA receberia HTML e diria "documento ilegível".
 */
export async function baixarArquivoDoSlack(url: string): Promise<Buffer> {
  const resp = await fetch(url, { headers: { authorization: `Bearer ${botToken()}` } });
  if (!resp.ok) throw new Error(`download falhou (HTTP ${resp.status}).`);

  const tipo = resp.headers.get("content-type") ?? "";
  if (tipo.includes("text/html")) {
    throw new Error("o Slack devolveu HTML no lugar do arquivo — confira o escopo files:read do bot.");
  }
  return Buffer.from(await resp.arrayBuffer());
}

/** Nome de quem postou, pra gravar como requerente do card. */
export async function nomeDoUsuario(userId: string): Promise<string | null> {
  try {
    const resp = await fetch(`${API}/users.info?user=${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${botToken()}` },
    });
    const json: any = await resp.json();
    if (!json.ok) return null;
    const u = json.user ?? {};
    return u.profile?.real_name || u.real_name || u.name || null;
  } catch {
    return null;
  }
}

/** Responde na thread do arquivo, pra quem enviou saber o que foi lido. */
export async function responderNaThread(canal: string, threadTs: string | undefined, texto: string): Promise<void> {
  try {
    await fetch(`${API}/chat.postMessage`, {
      method: "POST",
      headers: { authorization: `Bearer ${botToken()}`, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: canal, thread_ts: threadTs, text: texto, unfurl_links: false }),
    });
  } catch {
    // avisar é cortesia: se falhar, o card já está na Caixa de Entrada do
    // mesmo jeito e não faz sentido derrubar o processamento por causa disso.
  }
}

/** Teste de diagnóstico, no mesmo formato dos outros botões de Configurações. */
export async function testarConexaoSlackEntrada() {
  const checks: { nome: string; ok: boolean; detalhe: string }[] = [];

  for (const e of ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "SLACK_CANAL_BOLETOS"]) {
    checks.push({ nome: e, ok: !!process.env[e], detalhe: process.env[e] ? "configurada" : "FALTANDO" });
  }

  if (!process.env.SLACK_BOT_TOKEN) return { ok: false, checks };

  try {
    const resp = await fetch(`${API}/auth.test`, { headers: { authorization: `Bearer ${botToken()}` } });
    const json: any = await resp.json();
    checks.push({
      nome: "Autenticação do bot",
      ok: !!json.ok,
      detalhe: json.ok ? `Conectado como ${json.user} em ${json.team}` : `falhou: ${json.error}`,
    });
  } catch (err: any) {
    checks.push({ nome: "Autenticação do bot", ok: false, detalhe: err?.message ?? "erro desconhecido" });
  }

  return { ok: checks.every((c) => c.ok), checks };
}
