import { google } from "googleapis";

// Autentica com uma conta de serviço do Google (não é login pessoal). A conta
// de serviço precisa ter sido convidada como membro do Drive Compartilhado
// (não de uma pasta comum — contas de serviço não têm cota própria fora de
// um Drive Compartilhado, e a criação de arquivo falha silenciosamente
// mesmo com a permissão de Editor numa pasta comum).
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Credenciais do Google Drive não configuradas (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).");
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

function getDrive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

/**
 * Garante que uma subpasta com esse nome exista dentro de "paiId".
 * Se já existir, reaproveita; se não, cria. Devolve o ID da pasta.
 *
 * supportsAllDrives + includeItemsFromAllDrives são obrigatórios aqui:
 * sem eles, a API do Drive simplesmente ignora Drives Compartilhados nas
 * buscas e nas criações, como se não existissem.
 */
async function garantirPasta(nome: string, paiId: string): Promise<string> {
  const drive = getDrive();
  const busca = await drive.files.list({
    q: `name='${nome.replace(/'/g, "\\'")}' and '${paiId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  if (busca.data.files && busca.data.files.length > 0) {
    return busca.data.files[0].id!;
  }
  const nova = await drive.files.create({
    requestBody: { name: nome, mimeType: "application/vnd.google-apps.folder", parents: [paiId] },
    fields: "id",
    supportsAllDrives: true,
  });
  return nova.data.id!;
}

/**
 * Envia um boleto para o Drive, organizado como:
 * PASTA_RAIZ / {ano} / {mês} / {loja} - {tipo}.{extensão}
 * Devolve o link de visualização do arquivo no Drive.
 *
 * GOOGLE_DRIVE_FOLDER_ID precisa ser o ID de uma pasta dentro de um Drive
 * Compartilhado (ou o próprio Drive Compartilhado). Uma pasta comum dentro
 * de "Meu Drive" NÃO funciona pra criação de arquivo por conta de serviço.
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
    supportsAllDrives: true,
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
