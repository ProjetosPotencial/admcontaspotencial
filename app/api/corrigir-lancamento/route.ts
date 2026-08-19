import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilAtual } from "@/lib/auth-usuario";
import { motivoIncorretoValido } from "@/lib/lancamento-incorreto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Corrige um lançamento feito na empresa/loja errada.
 *
 * Roda no servidor, e não na tela, porque são cinco escritas que precisam
 * andar juntas: marcar o errado, achar/criar a conta certa, criar o
 * lançamento novo, ligar os dois e escrever o histórico dos dois lados. Se
 * isso ficasse no cliente, uma aba fechada no meio deixaria a correção pela
 * metade — com o original já cancelado e nenhum lançamento no lugar certo.
 *
 * O original NUNCA é apagado nem editado no lugar: fica marcado como
 * incorreto e cancelado, apontando para o que o substituiu.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  if (!["admin", "gestor", "operador"].includes(perfil.papel)) {
    return NextResponse.json({ error: "Sem permissão para corrigir lançamentos." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { lancamentoId, lojaCorretaId, motivo } = body ?? {};

  if (!lancamentoId || !lojaCorretaId) {
    return NextResponse.json({ error: "Informe o lançamento e a loja correta." }, { status: 400 });
  }
  if (!motivoIncorretoValido(motivo)) {
    return NextResponse.json({ error: "Descreva o motivo do lançamento incorreto." }, { status: 400 });
  }

  // service role: a correção mexe em duas contas que podem estar em lojas
  // diferentes, e quem corrige nem sempre enxerga as duas pelo RLS.
  const db = createAdminClient();
  const leitura = createClient();

  const { data: original } = await leitura
    .from("lancamentos")
    .select("id, conta_id, ano, mes, valor, situacao, lancamento_incorreto, contas ( id, tipo, fornecedor_nome, loja_id, lojas ( codigo, empresas ( nome ) ) )")
    .eq("id", lancamentoId)
    .maybeSingle();

  if (!original) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  if (original.lancamento_incorreto) {
    return NextResponse.json({ error: "Esse lançamento já foi marcado como incorreto." }, { status: 409 });
  }

  const contaOrig: any = original.contas;
  if (contaOrig?.loja_id === lojaCorretaId) {
    return NextResponse.json({ error: "A loja informada é a mesma do lançamento atual." }, { status: 400 });
  }

  // ---- a conta equivalente na loja certa: reaproveita se já existir ----
  let query = db.from("contas").select("id")
    .eq("loja_id", lojaCorretaId)
    .eq("tipo", contaOrig.tipo)
    .eq("status", "ativo");
  query = contaOrig.fornecedor_nome
    ? query.eq("fornecedor_nome", contaOrig.fornecedor_nome)
    : query.is("fornecedor_nome", null);

  const { data: contaExistente } = await query.maybeSingle();
  let contaCertaId = contaExistente?.id as string | undefined;

  if (!contaCertaId) {
    const { data: nova, error: erroConta } = await db.from("contas").insert({
      loja_id: lojaCorretaId,
      tipo: contaOrig.tipo,
      fornecedor_nome: contaOrig.fornecedor_nome,
      origem: "a_definir",
      status: "ativo",
      situacao_cadastro: "aprovada",
    }).select("id").single();
    if (erroConta || !nova) {
      return NextResponse.json({ error: "Não foi possível criar a conta na loja correta." }, { status: 500 });
    }
    contaCertaId = nova.id;
  }

  // ---- o lançamento certo ----
  // Se a loja certa JÁ tem lançamento nesse mês, não sobrescreve: avisa. Um
  // upsert aqui apagaria silenciosamente um lançamento legítimo de outra
  // pessoa, que é justamente o tipo de perda que essa fase existe pra evitar.
  const { data: jaExiste } = await db.from("lancamentos")
    .select("id, situacao").eq("conta_id", contaCertaId).eq("ano", original.ano).eq("mes", original.mes).maybeSingle();
  if (jaExiste) {
    return NextResponse.json({
      error: "A loja correta já tem lançamento nessa competência. Confira antes de corrigir — nada foi alterado.",
      lancamentoExistenteId: jaExiste.id,
    }, { status: 409 });
  }

  const agora = new Date().toISOString();
  const { data: corrigido, error: erroNovo } = await db.from("lancamentos").insert({
    conta_id: contaCertaId,
    ano: original.ano, mes: original.mes,
    valor: original.valor,
    situacao: "lancado",
    lancado_em: agora,
    lancado_por: perfil.id,
    origem_lancamento_id: original.id,
  }).select("id").single();

  if (erroNovo || !corrigido) {
    return NextResponse.json({ error: "Não foi possível criar o lançamento na loja correta." }, { status: 500 });
  }

  // ---- só agora o original é marcado: se algo falhou acima, ele continua válido ----
  await db.from("lancamentos").update({
    lancamento_incorreto: true,
    motivo_incorreto: String(motivo).trim(),
    marcado_incorreto_por: perfil.id,
    marcado_incorreto_em: agora,
    conta_correta_id: contaCertaId,
    corrigido_em_lancamento_id: corrigido.id,
    situacao: "cancelado",
  }).eq("id", original.id);

  // ---- histórico dos dois lados ----
  const { data: lojaCerta } = await db.from("lojas")
    .select("codigo, empresas ( nome )").eq("id", lojaCorretaId).maybeSingle();

  const empresaErrada = contaOrig?.lojas?.empresas?.nome ?? null;
  const lojaErrada = contaOrig?.lojas?.codigo ?? null;
  const empresaCerta = (lojaCerta as any)?.empresas?.nome ?? null;
  const lojaCertaCod = (lojaCerta as any)?.codigo ?? null;

  await db.from("lancamento_historico").insert([
    {
      lancamento_id: original.id,
      acao: "marcado_incorreto",
      de: original.situacao, para: "cancelado",
      quem: perfil.id, em: agora,
      empresa_anterior: empresaErrada, empresa_nova: empresaCerta,
      loja_anterior: lojaErrada, loja_nova: lojaCertaCod,
      valor_anterior: original.valor, valor_novo: original.valor,
      motivo: String(motivo).trim(),
      comentario: `Lançamento incorreto. Corrigido em ${lojaCertaCod ?? "outra loja"}.`,
    },
    {
      lancamento_id: corrigido.id,
      acao: "corrigido",
      de: "—", para: "lancado",
      quem: perfil.id, em: agora,
      empresa_anterior: empresaErrada, empresa_nova: empresaCerta,
      loja_anterior: lojaErrada, loja_nova: lojaCertaCod,
      valor_anterior: original.valor, valor_novo: original.valor,
      motivo: String(motivo).trim(),
      comentario: `Criado a partir de um lançamento incorreto em ${lojaErrada ?? "outra loja"}.`,
    },
  ]);

  return NextResponse.json({
    ok: true,
    lancamentoCorrigidoId: corrigido.id,
    contaCorretaId: contaCertaId,
    empresaErrada, lojaErrada, empresaCorreta: empresaCerta, lojaCorreta: lojaCertaCod,
  });
}
