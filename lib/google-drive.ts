import { google } from "googleapis";
import { Readable } from "stream";

// Autentica AGINDO COMO a conta real do Google que já tem a pasta no Drive
// pessoal (não uma conta de serviço "robô" — essas não têm cota própria de
// armazenamento fora de um Drive Compartilhado, que só existe em contas
// Google Workspace pagas). O acesso vem de um "refresh token" gerado uma
// vez, através da rota /api/google-auth, autorizado pela conta dona da
// pasta (grupopotencial.ti@gmail.com ou quem for o dono).
function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Credenciais OAuth do Google não configuradas (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI).");
  }
  if (!refreshToken) {
    throw new Error("GOOGLE_OAUTH_REFRESH_TOKEN não configurado ainda. Um admin precisa autorizar uma vez em /api/google-auth.");
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function getDrive() {
  return google.drive({ version: "v3", auth: getOAuthClient() });
}

/**
 * Garante que uma subpasta com esse nome exista dentro de "paiId".
 * Se já existir, reaproveita; se não, cria. Devolve o ID da pasta.
 */
async function garantirPasta(nome: string, paiId: string): Promise<string> {
  const drive = getDrive();
  const busca = await drive.files.list({
    q: `name='${nome.replace(/'/g, "\\'")}' and '${paiId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  if (busca.data.files && busca.data.files.length > 0) {
    return busca.data.files[0].id!;
  }
  const nova = await drive.files.create({
    requestBody: { name: nome, mimeType: "application/vnd.google-apps.folder", parents: [paiId] },
    fields: "id",
  });
  return nova.data.id!;
}

/**
 * Envia um boleto para o Drive, organizado como:
 * PASTA_RAIZ / {ano} / {mês} / {dia} / {empresa} / {loja} / {loja} - {tipo} - {dia}-{mesNumero}-{ano}.{extensão}
 *
 * Empresa aqui é o grupo bancário/correspondente da loja (BB COBAN MG,
 * BRADESCO, etc.), não uma "marca" do Grupo Potencial - é o cadastro de
 * empresa da loja, editável em Lojas. Se a loja não tiver empresa
 * cadastrada, cai numa pasta "Sem empresa" ao invés de travar o envio.
 *
 * Se já existir um boleto do mesmo tipo pra essa loja no MESMO DIA (pasta
 * atual), ele é apagado antes de subir o novo - corrige sem duplicar.
 * Devolve o link de visualização do arquivo no Drive.
 */
export async function enviarBoletoParaDrive(params: {
  arquivo: Buffer;
  nomeArquivo: string;
  mimeType: string;
  ano: number;
  mes: string; // nome do mes, ex "Julho"
  mesNumero: string; // "07"
  dia: string; // "10"
  loja: string;
  tipo: string;
  empresa?: string | null;
}): Promise<{ fileId: string; webViewLink: string }> {
  const raizId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!raizId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID não configurado.");
  }
  const drive = getDrive();

  const pastaAno = await garantirPasta(String(params.ano), raizId);
  const pastaMes = await garantirPasta(params.mes, pastaAno);
  const pastaDia = await garantirPasta(params.dia.padStart(2, "0"), pastaMes);
  const pastaEmpresa = await garantirPasta(params.empresa?.trim() || "Sem empresa", pastaDia);
  const pastaLoja = await garantirPasta(params.loja, pastaEmpresa);

  // apaga qualquer boleto do mesmo tipo já existente na pasta da loja nesse
  // dia, pra corrigir sem duplicar (ex.: relançou duas vezes no mesmo dia).
  const prefixoTipo = `${params.loja} - ${params.tipo} - `;
  const existentes = await drive.files.list({
    q: `'${pastaLoja}' in parents and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  for (const f of existentes.data.files ?? []) {
    if (f.name?.startsWith(prefixoTipo) && f.id) {
      await drive.files.delete({ fileId: f.id }).catch(() => {});
    }
  }

  const stream = Readable.from(params.arquivo);
  const nomeArquivo = `${params.loja} - ${params.tipo} - ${params.dia}-${params.mesNumero}-${params.ano}${extensaoDoNome(params.nomeArquivo)}`;

  const resultado = await drive.files.create({
    requestBody: {
      name: nomeArquivo,
      parents: [pastaLoja],
    },
    media: { mimeType: params.mimeType, body: stream },
    fields: "id, webViewLink",
  });

  return {
    fileId: resultado.data.id!,
    webViewLink: resultado.data.webViewLink ?? `https://drive.google.com/file/d/${resultado.data.id}/view`,
  };
}

function extensaoDoNome(nome: string): string {
  const m = nome.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

/**
 * Lista os arquivos direto dentro de uma pasta (sem entrar em subpastas),
 * usado pra ler a "Caixa de Entrada" de boletos que alguém colocou solto
 * numa pasta do Drive.
 */
export async function listarArquivosNaPasta(pastaId: string): Promise<{ id: string; name: string; webViewLink: string; mimeType: string }[]> {
  const drive = getDrive();
  const resposta = await drive.files.list({
    q: `'${pastaId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: "files(id, name, webViewLink, mimeType)",
    spaces: "drive",
    pageSize: 100,
  });
  return (resposta.data.files ?? []).map((f) => ({
    id: f.id!, name: f.name ?? "sem-nome", webViewLink: f.webViewLink ?? "", mimeType: f.mimeType ?? "application/octet-stream",
  }));
}

/**
 * Baixa os bytes de um arquivo do Drive pelo ID.
 */
export async function baixarArquivoDoDrive(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const resposta = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(resposta.data as ArrayBuffer);
}

/**
 * Lista as SUBPASTAS de uma pasta (usado pra descobrir os chamados do GLPI e,
 * dentro de cada chamado, as pastas de loja).
 */
async function listarSubpastas(paiId: string): Promise<{ id: string; name: string }[]> {
  const drive = getDrive();
  const r = await drive.files.list({
    q: `'${paiId}' in parents and trashed=false and mimeType = 'application/vnd.google-apps.folder'`,
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 100,
  });
  return (r.data.files ?? []).map((f) => ({ id: f.id!, name: f.name ?? "sem-nome" }));
}

export type ChamadoGLPI = {
  pastaId: string;        // id da pasta do chamado (chave de dedup por pasta)
  chamadoNumero: string | null;
  lojaTexto: string | null;   // nome da subpasta de loja, ex "MG 064 PE Ubá II"
  arquivos: { id: string; name: string; webViewLink: string; mimeType: string }[];
};

/**
 * Varre a pasta de entrada procurando a estrutura que o GLPI cria:
 *
 *   <raiz> / Compras / Chamado NNNNN / <LOJA> / {NF, boleto, anexos}
 *
 * O GLPI joga tudo dentro de uma subpasta "Compras", então primeiro descemos
 * nela; ali dentro estão as pastas de chamado. Isso separa o fluxo GLPI do
 * fluxo manual (PDFs soltos na raiz, tratados por listarArquivosNaPasta).
 * Devolve um item por chamado, com número, loja e os arquivos daquele chamado.
 * Se um chamado tiver arquivos soltos (sem subpasta de loja), inclui com
 * lojaTexto=null. O nome da pasta "Compras" pode ser customizado via
 * GLPI_COMPRAS_FOLDER_NAME (padrão "Compras").
 */
/**
 * Junta TODOS os arquivos abaixo de uma pasta, em qualquer profundidade
 * (a própria pasta e todas as subpastas, recursivamente). Um teto de
 * profundidade evita loop caso o Drive devolva algo estranho.
 */
async function coletarArquivosRecursivo(
  pastaId: string,
  profundidade = 0,
): Promise<{ id: string; name: string; webViewLink: string; mimeType: string }[]> {
  if (profundidade > 12) return [];
  const arquivos = await listarArquivosNaPasta(pastaId);
  const subs = await listarSubpastas(pastaId);
  for (const s of subs) {
    arquivos.push(...(await coletarArquivosRecursivo(s.id, profundidade + 1)));
  }
  return arquivos;
}

export async function listarChamadosGLPI(raizId: string): Promise<ChamadoGLPI[]> {
  const nomeCompras = process.env.GLPI_COMPRAS_FOLDER_NAME ?? "Compras";
  const subpastasRaiz = await listarSubpastas(raizId);
  const pastaCompras = subpastasRaiz.find((p) => p.name.trim().toLowerCase() === nomeCompras.toLowerCase());
  if (!pastaCompras) return []; // sem pasta "Compras" ainda, nada de GLPI a processar

  const chamadosPastas = await listarSubpastas(pastaCompras.id);
  const resultado: ChamadoGLPI[] = [];

  for (const pastaChamado of chamadosPastas) {
    const num = pastaChamado.name.match(/(\d{3,})/);
    const chamadoNumero = num ? num[1] : null;

    const subs = await listarSubpastas(pastaChamado.id);

    // arquivos soltos direto no chamado (sem pasta de loja/rótulo)
    const soltos = await listarArquivosNaPasta(pastaChamado.id);
    if (soltos.length > 0) {
      resultado.push({ pastaId: pastaChamado.id, chamadoNumero, lojaTexto: null, arquivos: soltos });
    }

    // cada subpasta de 1º nível (rótulo/loja) vira um agrupamento; recolhe
    // TODOS os arquivos abaixo dela, em qualquer profundidade.
    for (const sub of subs) {
      const arquivos = await coletarArquivosRecursivo(sub.id);
      if (arquivos.length > 0) {
        resultado.push({ pastaId: sub.id, chamadoNumero, lojaTexto: sub.name, arquivos });
      }
    }
  }
  return resultado;
}

/**
 * Teste de diagnóstico da conexão com o Drive. Não faz upload nem varredura:
 * só confirma se as variáveis existem, se a credencial autentica (e COMO QUAL
 * conta), e se as duas pastas (entrada e saída) são acessíveis por ela.
 * Devolve um relatório item a item pra aparecer na tela de Configurações.
 */
export async function testarConexaoDrive() {
  const checks: { nome: string; ok: boolean; detalhe: string }[] = [];

  const envs = [
    "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REDIRECT_URI",
    "GOOGLE_OAUTH_REFRESH_TOKEN", "GOOGLE_DRIVE_INBOX_FOLDER_ID", "GOOGLE_DRIVE_FOLDER_ID",
  ];
  for (const e of envs) {
    checks.push({ nome: e, ok: !!process.env[e], detalhe: process.env[e] ? "configurada" : "FALTANDO" });
  }

  let contaEmail: string | null = null;
  try {
    const drive = getDrive();
    const about = await drive.about.get({ fields: "user(emailAddress,displayName)" });
    contaEmail = about.data.user?.emailAddress ?? null;
    checks.push({ nome: "Autenticação no Drive", ok: true, detalhe: `Conectado como ${contaEmail ?? "conta desconhecida"}` });
  } catch (err: any) {
    const g = err?.response?.data;
    const msg = g?.error ? `${g.error}${g.error_description ? " — " + g.error_description : ""}` : (err?.message ?? "erro desconhecido");
    checks.push({ nome: "Autenticação no Drive", ok: false, detalhe: msg });
    return { ok: false, contaEmail, checks }; // sem autenticar, não dá pra testar as pastas
  }

  for (const [nome, id] of [
    ["Pasta de ENTRADA (varredura)", process.env.GOOGLE_DRIVE_INBOX_FOLDER_ID],
    ["Pasta de SAÍDA (upload)", process.env.GOOGLE_DRIVE_FOLDER_ID],
  ] as const) {
    if (!id) { checks.push({ nome, ok: false, detalhe: "ID não configurado" }); continue; }
    try {
      const drive = getDrive();
      const f = await drive.files.get({ fileId: id, fields: "id,name", supportsAllDrives: true });
      checks.push({ nome, ok: true, detalhe: `"${f.data.name}" acessível` });
    } catch (err: any) {
      checks.push({ nome, ok: false, detalhe: err?.message ?? "não acessível — a pasta pode ser de outra conta Google" });
    }
  }

  return { ok: checks.every((c) => c.ok), contaEmail, checks };
}
