import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilAtual } from "@/lib/auth-usuario";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

/** Só os dígitos: a comparação não pode depender de pontos e espaços. */
const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Anexa (ou substitui) o boleto de um grupo.
 *
 * Substituir nunca apaga: a versão anterior fica na tabela, marcada como
 * inativa, com quem trocou e por quê. É o "manter versão anterior" da
 * especificação — e é o que permite responder, meses depois, por que o
 * pagamento saiu com um código diferente do que foi aprovado.
 *
 * O documento fica no GRUPO. As contas das lojas leem dele em vez de terem
 * cópia própria — um boleto, um lugar para atualizar.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  if (!["admin", "gestor", "operador"].includes(perfil.papel)) {
    return NextResponse.json({ error: "Sem permissão para anexar documentos." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  const grupoId = String(form?.get("grupoId") ?? "");
  const motivo = String(form?.get("motivo") ?? "").trim();
  const lerComIa = String(form?.get("lerComIa") ?? "") === "1";

  if (!grupoId) return NextResponse.json({ error: "Informe o grupo." }, { status: 400 });
  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Envie o boleto." }, { status: 400 });
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json({ error: "Aceito apenas PDF, JPG ou PNG." }, { status: 415 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: `O arquivo tem ${Math.round(arquivo.size / 1024 / 1024)} MB. O limite é 10 MB.` }, { status: 413 });
  }

  const db = createAdminClient();

  const { data: grupo } = await db
    .from("conta_grupos")
    .select("id, nome, ano, mes, valor_total, documento_atual_id")
    .eq("id", grupoId).maybeSingle();
  if (!grupo) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });

  // Substituir exige motivo. É a diferença entre corrigir e rasurar.
  const substituindo = !!grupo.documento_atual_id;
  if (substituindo && motivo.length < 3) {
    return NextResponse.json({ error: "Esse grupo já tem boleto. Descreva o motivo da substituição." }, { status: 400 });
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  // ---- lê o boleto pra preencher código e valor, se pedirem ----
  let codigoBarras: string | null = (form?.get("codigoBarras") as string) || null;
  let linhaDigitavel: string | null = (form?.get("linhaDigitavel") as string) || null;
  let valorLido: number | null = null;
  let vencimentoLido: string | null = null;

  if (lerComIa && !codigoBarras) {
    try {
      const lido = await extrairDadosBoleto(buffer, arquivo.name, arquivo.type);
      codigoBarras = lido.codigo_barras;
      linhaDigitavel = lido.codigo_barras;
      valorLido = lido.valor;
    } catch {
      // leitura é conveniência: falhar aqui não impede anexar o documento
    }
  }

  // ---- duplicidade entre GRUPOS ----
  const cod = digitos(codigoBarras);
  if (cod.length >= 20) {
    const { data: existentes } = await db
      .from("conta_grupo_documentos")
      .select("grupo_id, codigo_barras, conta_grupos ( nome, ano, mes )")
      .eq("ativo", true)
      .neq("grupo_id", grupoId);

    const conflito = (existentes ?? []).find((d: any) => digitos(d.codigo_barras) === cod);
    if (conflito) {
      const g: any = conflito.conta_grupos;
      const quando = g ? `${String(g.mes).padStart(2, "0")}/${g.ano}` : "";
      return NextResponse.json({
        error: `Este boleto já está vinculado ao Grupo ${g?.nome ?? "outro"}${quando ? ` — ${quando}` : ""}.`,
      }, { status: 409 });
    }
  }

  // ---- sobe o arquivo ----
  const ext = arquivo.name.split(".").pop() ?? "pdf";
  const versao = substituindo ? await proximaVersao(db, grupoId) : 1;
  const caminho = `grupos/${grupoId}/v${versao}.${ext}`;

  const { error: erroUpload } = await db.storage.from("boletos")
    .upload(caminho, buffer, { contentType: arquivo.type, upsert: true });
  if (erroUpload) {
    return NextResponse.json({ error: "Não foi possível guardar o arquivo." }, { status: 500 });
  }

  // ---- a versão anterior sai de cena, mas fica ----
  if (substituindo) {
    await db.from("conta_grupo_documentos")
      .update({ ativo: false, motivo_substituicao: motivo })
      .eq("grupo_id", grupoId).eq("ativo", true);
  }

  const vencimento = (form?.get("vencimento") as string) || vencimentoLido || null;
  const valorForm = form?.get("valor") ? Number(String(form.get("valor")).replace(",", ".")) : null;

  const { data: doc, error: erroDoc } = await db.from("conta_grupo_documentos").insert({
    grupo_id: grupoId,
    arquivo_url: caminho,
    nome_arquivo: arquivo.name,
    mime_type: arquivo.type,
    tamanho: arquivo.size,
    codigo_barras: codigoBarras,
    linha_digitavel: linhaDigitavel,
    valor: valorForm ?? valorLido ?? grupo.valor_total,
    vencimento,
    versao,
    ativo: true,
    enviado_por: perfil.id,
  }).select("id").single();

  if (erroDoc || !doc) {
    return NextResponse.json({ error: "Não foi possível registrar o documento." }, { status: 500 });
  }

  await db.from("conta_grupos").update({
    documento_atual_id: doc.id,
    codigo_barras: codigoBarras,
    linha_digitavel: linhaDigitavel,
    ...(vencimento ? { vencimento } : {}),
  }).eq("id", grupoId);

  // ---- histórico: o upload e o vínculo são eventos distintos ----
  const { count } = await db.from("conta_grupo_itens")
    .select("id", { count: "exact", head: true })
    .eq("grupo_id", grupoId).eq("ativo", true);

  await db.from("conta_grupo_historico").insert([
    {
      grupo_id: grupoId,
      acao: substituindo ? "documento_substituido" : "documento_enviado",
      descricao: substituindo
        ? `Boleto substituído por ${arquivo.name} (versão ${versao}). Motivo: ${motivo}`
        : `Upload do boleto ${arquivo.name}`,
      quem: perfil.id,
    },
    {
      grupo_id: grupoId,
      acao: "documento_vinculado",
      descricao: `Documento vinculado a ${count ?? 0} ${count === 1 ? "loja" : "lojas"}`,
      quem: null,   // ação do sistema, não de pessoa
    },
  ]);

  return NextResponse.json({
    ok: true,
    documentoId: doc.id,
    versao,
    codigoBarras,
    lojas: count ?? 0,
    substituiu: substituindo,
  });
}

async function proximaVersao(db: any, grupoId: string): Promise<number> {
  const { data } = await db.from("conta_grupo_documentos")
    .select("versao").eq("grupo_id", grupoId)
    .order("versao", { ascending: false }).limit(1).maybeSingle();
  return (data?.versao ?? 0) + 1;
}
