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

export type CheckSlack = { nome: string; ok: boolean; detalhe: string };

/**
 * Diagnóstico da entrada pelo Slack, no mesmo formato dos outros testes de
 * Configurações. Cobre de propósito a falha mais silenciosa da configuração:
 * o bot não estar no canal. Quando isso acontece o Slack simplesmente não
 * entrega o evento - não dá erro, não aparece nada em lugar nenhum, e o
 * arquivo postado some no vazio.
 */
export async function testarConexaoSlackEntrada(): Promise<{ ok: boolean; checks: CheckSlack[] }> {
  const checks: CheckSlack[] = [];

  for (const e of ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "SLACK_CANAL_BOLETOS"]) {
    checks.push({ nome: e, ok: !!process.env[e], detalhe: process.env[e] ? "configurada" : "FALTANDO" });
  }

  const canal = process.env.SLACK_CANAL_BOLETOS;
  if (canal) {
    // O engano comum é colar o NOME do canal ("#potencialcontas") no lugar
    // do ID. Fica tudo parecendo certo e nenhum arquivo entra.
    const formatoOk = /^[CG][A-Z0-9]{6,}$/.test(canal);
    checks.push({
      nome: "Formato do ID do canal",
      ok: formatoOk,
      detalhe: formatoOk
        ? `${canal} tem cara de ID de canal`
        : `"${canal}" não parece um ID. Tem que ser algo como C0BG38UKUKZ, não o nome do canal.`,
    });
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return { ok: false, checks };
  }

  // auth.test é o jeito barato de validar o token e ainda descobrir COMO QUAL
  // bot ele autentica - mesma ideia do teste do Drive mostrar a conta Google.
  let autenticou = false;
  try {
    const resp = await fetch(`${API}/auth.test`, { headers: { authorization: `Bearer ${botToken()}` } });
    const json: any = await resp.json();
    autenticou = !!json.ok;
    checks.push({
      nome: "Autenticação do bot",
      ok: autenticou,
      detalhe: autenticou
        ? `Conectado como ${json.user} no workspace ${json.team}`
        : `falhou: ${json.error ?? "erro desconhecido"} — confira se o token começa com xoxb- e se o app foi instalado`,
    });
  } catch (err: any) {
    checks.push({ nome: "Autenticação do bot", ok: false, detalhe: err?.message ?? "erro desconhecido" });
  }

  if (autenticou && canal) {
    checks.push(await checarCanal(canal));
  }

  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * O bot enxerga o canal? Em canal privado, "channel_not_found" é o que o
 * Slack devolve pra quem não é membro - é o sintoma de faltar o /invite.
 */
async function checarCanal(canal: string): Promise<CheckSlack> {
  try {
    const resp = await fetch(`${API}/conversations.info?channel=${encodeURIComponent(canal)}`, {
      headers: { authorization: `Bearer ${botToken()}` },
    });
    const json: any = await resp.json();

    if (json.ok) {
      const c = json.channel ?? {};
      const membro = c.is_member !== false;
      return {
        nome: "Bot no canal",
        ok: membro,
        detalhe: membro
          ? `#${c.name} encontrado, bot é membro`
          : `#${c.name} existe, mas o bot NÃO está nele. Rode /invite no canal.`,
      };
    }

    // Sem channels:read/groups:read não dá pra verificar. Não é erro de
    // configuração da entrada de boletos, então não reprova o teste todo.
    if (json.error === "missing_scope") {
      return {
        nome: "Bot no canal",
        ok: true,
        detalhe: "não deu pra verificar (falta o escopo channels:read/groups:read, que é opcional). Confirme na mão que o bot foi convidado.",
      };
    }
    if (json.error === "channel_not_found") {
      return {
        nome: "Bot no canal",
        ok: false,
        detalhe: `o bot não enxerga ${canal}. Ou o ID está errado, ou falta convidar o bot no canal (/invite), ou o canal é privado e falta o escopo groups:history.`,
      };
    }
    return { nome: "Bot no canal", ok: false, detalhe: `falhou: ${json.error}` };
  } catch (err: any) {
    return { nome: "Bot no canal", ok: false, detalhe: err?.message ?? "erro desconhecido" };
  }
}
