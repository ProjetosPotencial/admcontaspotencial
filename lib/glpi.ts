/**
 * Integração leve com a API REST (v1) do GLPI, só pra enriquecer os chamados
 * de compra com dados que só existem no GLPI — principalmente o REQUERENTE.
 *
 * Credenciais SEMPRE de variáveis de ambiente (nunca no código):
 *   GLPI_API_URL     ex: https://www.sigapotencial.com.br/api.php/v1
 *   GLPI_APP_TOKEN   token da aplicação (Configurar > Geral > API)
 *   GLPI_USER_TOKEN  token de uma conta de serviço (Chaves de acesso remoto)
 *
 * Fluxo v1: initSession (pega Session-Token) -> consulta -> killSession.
 */

function baseUrl(): string | null {
  const u = process.env.GLPI_API_URL;
  if (!u) return null;
  return u.replace(/\/+$/, ""); // sem barra no fim
}

async function iniciarSessao(): Promise<{ sessionToken: string; appToken: string; url: string } | null> {
  const url = baseUrl();
  const appToken = process.env.GLPI_APP_TOKEN;
  const userToken = process.env.GLPI_USER_TOKEN;
  if (!url || !appToken || !userToken) return null; // GLPI não configurado -> silencioso

  const r = await fetch(`${url}/initSession`, {
    headers: {
      "Content-Type": "application/json",
      "App-Token": appToken,
      "Authorization": `user_token ${userToken}`,
    },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const sessionToken = j?.session_token;
  return sessionToken ? { sessionToken, appToken, url } : null;
}

async function encerrarSessao(s: { sessionToken: string; appToken: string; url: string }) {
  try {
    await fetch(`${s.url}/killSession`, {
      headers: { "Content-Type": "application/json", "App-Token": s.appToken, "Session-Token": s.sessionToken },
    });
  } catch { /* ignora */ }
}

export type DadosChamadoGLPI = {
  requerente: string | null;
  titulo: string | null;
};

/**
 * Busca dados de um chamado (ticket) pelo número. Devolve null se o GLPI não
 * estiver configurado, se a sessão falhar, ou se o ticket não existir — nunca
 * lança, pra não derrubar a importação por causa do enriquecimento.
 */
export async function buscarDadosChamado(numero: string): Promise<DadosChamadoGLPI | null> {
  const s = await iniciarSessao();
  if (!s) return null;
  try {
    // dados básicos do ticket (título)
    const rTicket = await fetch(`${s.url}/Ticket/${encodeURIComponent(numero)}`, {
      headers: { "Content-Type": "application/json", "App-Token": s.appToken, "Session-Token": s.sessionToken },
    });
    const ticket = rTicket.ok ? await rTicket.json().catch(() => null) : null;
    const titulo = ticket?.name ?? null;

    // requerente: vínculo Ticket_User com type=1 (Requerente)
    let requerente: string | null = null;
    const rUsers = await fetch(`${s.url}/Ticket/${encodeURIComponent(numero)}/Ticket_User`, {
      headers: { "Content-Type": "application/json", "App-Token": s.appToken, "Session-Token": s.sessionToken },
    });
    if (rUsers.ok) {
      const vinculos = await rUsers.json().catch(() => []);
      const req = Array.isArray(vinculos) ? vinculos.find((v: any) => Number(v.type) === 1) : null;
      if (req?.users_id) {
        const rUser = await fetch(`${s.url}/User/${req.users_id}`, {
          headers: { "Content-Type": "application/json", "App-Token": s.appToken, "Session-Token": s.sessionToken },
        });
        if (rUser.ok) {
          const u = await rUser.json().catch(() => null);
          // nome amigável: realname + firstname, senão o login
          const nome = [u?.realname, u?.firstname].filter(Boolean).join(" ").trim();
          requerente = nome || u?.name || null;
        }
      }
    }

    return { requerente, titulo };
  } catch {
    return null;
  } finally {
    await encerrarSessao(s);
  }
}

/**
 * Teste de diagnóstico da conexão com o GLPI (para a tela de Configurações).
 * Diferente do fluxo normal, aqui capturamos o ERRO real de cada etapa:
 * variáveis, initSession (autenticação) e leitura da sessão. Nunca lança.
 */
export async function testarConexaoGLPI() {
  const checks: { nome: string; ok: boolean; detalhe: string }[] = [];
  const url = baseUrl();
  const appToken = process.env.GLPI_APP_TOKEN;
  const userToken = process.env.GLPI_USER_TOKEN;

  checks.push({ nome: "GLPI_API_URL", ok: !!url, detalhe: url ?? "FALTANDO" });
  checks.push({ nome: "GLPI_APP_TOKEN", ok: !!appToken, detalhe: appToken ? "configurada" : "FALTANDO" });
  checks.push({ nome: "GLPI_USER_TOKEN", ok: !!userToken, detalhe: userToken ? "configurada" : "FALTANDO" });
  if (!url || !appToken || !userToken) return { ok: false, checks };

  // 1) initSession — autenticação com App-Token + User-Token
  let sessionToken: string | null = null;
  try {
    const r = await fetch(`${url}/initSession`, {
      headers: { "Content-Type": "application/json", "App-Token": appToken, "Authorization": `user_token ${userToken}` },
    });
    const txt = await r.text();
    let body: any = null; try { body = JSON.parse(txt); } catch { /* texto puro */ }
    if (r.ok && body?.session_token) {
      sessionToken = body.session_token;
      checks.push({ nome: "Autenticação (initSession)", ok: true, detalhe: "Sessão iniciada com sucesso" });
    } else {
      // erros v1 vêm como ["ERROR_CODE","mensagem"]
      const msg = Array.isArray(body) ? body.filter(Boolean).join(" — ") : (body?.[1] || txt || `HTTP ${r.status}`);
      checks.push({ nome: "Autenticação (initSession)", ok: false, detalhe: `HTTP ${r.status}: ${String(msg).slice(0, 200)}` });
      return { ok: false, checks };
    }
  } catch (err: any) {
    checks.push({ nome: "Autenticação (initSession)", ok: false, detalhe: err?.message ?? "erro de rede" });
    return { ok: false, checks };
  }

  // 2) leitura da sessão — confirma que dá pra consultar de verdade
  try {
    const r = await fetch(`${url}/getFullSession`, {
      headers: { "Content-Type": "application/json", "App-Token": appToken, "Session-Token": sessionToken! },
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const nome = j?.session?.glpifriendlyname || j?.session?.glpiname || "usuário de serviço";
      checks.push({ nome: "Leitura da sessão", ok: true, detalhe: `Conectado como ${nome}` });
    } else {
      checks.push({ nome: "Leitura da sessão", ok: false, detalhe: `HTTP ${r.status}` });
    }
  } catch (err: any) {
    checks.push({ nome: "Leitura da sessão", ok: false, detalhe: err?.message ?? "erro" });
  }

  try { await fetch(`${url}/killSession`, { headers: { "App-Token": appToken, "Session-Token": sessionToken! } }); } catch { /* ignora */ }

  return { ok: checks.every((c) => c.ok), checks };
}
