import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilAtual } from "@/lib/auth-usuario";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";
import { baixarArquivoDoDrive } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Relê o PDF já anexado a um lançamento.
 *
 * Existe porque nem todo boleto entra com a linha digitável: PDF ruim, foto
 * torta, leitura que falhou no dia. Sem o código, quem vai pagar tem que
 * abrir o arquivo e digitar à mão — e é aí que nasce erro de dígito.
 *
 * Só COMPLETA o que está faltando. Nunca sobrescreve valor ou código que já
 * estavam preenchidos: se alguém corrigiu na mão, a correção manual vale
 * mais que uma releitura automática.
 */

/** O id do arquivo dentro de um link de visualização do Drive. */
function idDoLinkDrive(url: string): string | null {
  return url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
    ?? null;
}

export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  if (!["admin", "gestor", "operador"].includes(perfil.papel)) {
    return NextResponse.json({ error: "Sem permissão para reprocessar." }, { status: 403 });
  }

  const { lancamentoId } = await req.json().catch(() => ({}));
  if (!lancamentoId) return NextResponse.json({ error: "Informe o lançamento." }, { status: 400 });

  const leitura = createClient();
  const { data: lanc } = await leitura
    .from("lancamentos")
    .select("id, valor, codigo_barras, comprovante_url, comprovante_drive_url")
    .eq("id", lancamentoId)
    .maybeSingle();

  if (!lanc) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });

  // ---- acha o arquivo: primeiro o que está no nosso storage, depois o Drive ----
  let buffer: Buffer | null = null;
  let nome = "boleto.pdf";

  if (lanc.comprovante_url) {
    const { data: arquivo } = await leitura.storage.from("boletos").download(lanc.comprovante_url);
    if (arquivo) {
      buffer = Buffer.from(await arquivo.arrayBuffer());
      nome = lanc.comprovante_url.split("/").pop() ?? nome;
    }
  }

  if (!buffer && lanc.comprovante_drive_url) {
    const fileId = idDoLinkDrive(lanc.comprovante_drive_url);
    if (fileId) {
      try { buffer = await baixarArquivoDoDrive(fileId); } catch { /* segue pro erro abaixo */ }
    }
  }

  if (!buffer) {
    return NextResponse.json({
      error: "Esse lançamento não tem PDF anexado — não há o que reler. Anexe o boleto primeiro.",
    }, { status: 422 });
  }

  // ---- relê ----
  let extraido;
  try {
    extraido = await extrairDadosBoleto(buffer, nome, "application/pdf");
  } catch (err: any) {
    return NextResponse.json({ error: `Não consegui ler o arquivo: ${err?.message ?? "erro"}` }, { status: 502 });
  }

  // ---- só completa o que falta ----
  const novoCodigo = !lanc.codigo_barras && extraido.codigo_barras ? extraido.codigo_barras : null;
  const novoValor = lanc.valor == null && extraido.valor != null ? extraido.valor : null;

  if (!novoCodigo && novoValor == null) {
    return NextResponse.json({
      ok: true, alterou: false,
      mensagem: lanc.codigo_barras
        ? "Esse lançamento já tem código de barras — nada a completar."
        : "Reli o arquivo, mas não encontrei linha digitável nele. Pode ser uma nota sem boleto anexo.",
      codigoLido: extraido.codigo_barras,
      formatoValido: extraido.formato_codigo_valido,
    });
  }

  const db = createAdminClient();
  const mudancas: any = {};
  if (novoCodigo) mudancas.codigo_barras = novoCodigo;
  if (novoValor != null) mudancas.valor = novoValor;

  await db.from("lancamentos").update(mudancas).eq("id", lanc.id);

  await db.from("lancamento_historico").insert({
    lancamento_id: lanc.id,
    acao: "releitura_pdf",
    de: "—", para: novoCodigo ? "código de barras preenchido" : "valor preenchido",
    quem: perfil.id, em: new Date().toISOString(),
    valor_anterior: lanc.valor, valor_novo: novoValor ?? lanc.valor,
    comentario: "Releitura do PDF anexado, para completar o que faltava.",
  });

  return NextResponse.json({
    ok: true, alterou: true,
    codigoBarras: novoCodigo,
    valor: novoValor,
    // linha digitável tem 47 ou 48 dígitos; se não fechar, quem paga precisa conferir
    formatoValido: extraido.formato_codigo_valido,
    fechaMatematicamente: extraido.codigo_barras_fecha_matematicamente,
  });
}
