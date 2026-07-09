import { google } from "googleapis";

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
 * PASTA_RAIZ / {ano} / {mês} / {loja} - {tipo}.{extensão}
 * Devolve o link de visualização do arquivo no Drive.
 */
export async function enviarBoletoParaDrive(params: {
  arquivo: Buffer;
  nomeArquivo: string;
  mimeType: string;
  ano: number;
  mes: string; // nome do mes, ex "Julho"
  loja: string;
  tipo: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const raizId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!raizId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID não configurado.");
  }
  const drive = getDrive();

  const pastaAno = await garantirPasta(String(params.ano), raizId);
  const pastaMes = await garantirPasta(params.mes, pastaAno);

  const { Readable } = await import("stream");
  const stream = Readable.from(params.arquivo);

  const resultado = await drive.files.create({
    requestBody: {
      name: `${params.loja} - ${params.tipo}${extensaoDoNome(params.nomeArquivo)}`,
      parents: [pastaMes],
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
