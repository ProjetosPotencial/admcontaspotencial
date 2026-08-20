import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilAtual } from "@/lib/auth-usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tira um lançamento da fila de aprovação.
 *
 * NÃO apaga. Marca como cancelado, com motivo, autor e horário, e o registro
 * continua inteiro no banco — some da fila e dos totais, mas continua
 * respondível: daqui a três meses ainda dá pra dizer por que aquela conta
 * sumiu, e quem mandou sumir.
 *
 * É a regra que a própria operação escreveu: "nunca apagar definitivamente um
 * lançamento que já tenha sido processado". Tudo que está na fila de
 * aprovação já foi processado — alguém lançou.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  // excluir da fila é decisão de gestão, não de quem lança
  if (!["admin", "gestor"].includes(perfil.papel)) {
    return NextResponse.json({ error: "Só gestor ou administrador podem excluir da fila." }, { status: 403 });
  }

  const { lancamentoId, motivo } = await req.json().catch(() => ({}));
  if (!lancamentoId) return NextResponse.json({ error: "Informe o lançamento." }, { status: 400 });
  if (!motivo || String(motivo).trim().length < 3) {
    return NextResponse.json({ error: "Descreva o motivo da exclusão." }, { status: 400 });
  }

  const leitura = createClient();
  const { data: lanc } = await leitura
    .from("lancamentos")
    .select("id, situacao, valor, contas ( tipo, fornecedor_nome, lojas ( codigo ) )")
    .eq("id", lancamentoId)
    .maybeSingle();

  if (!lanc) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
  if (lanc.situacao === "pago") {
    return NextResponse.json({
      error: "Esse lançamento já foi pago e não pode ser excluído. Se o pagamento foi indevido, registre a correção pelo histórico.",
    }, { status: 409 });
  }
  if (lanc.situacao === "cancelado") {
    return NextResponse.json({ error: "Esse lançamento já está cancelado." }, { status: 409 });
  }

  const agora = new Date().toISOString();
  const db = createAdminClient();

  await db.from("lancamentos").update({
    situacao: "cancelado",
    motivo_recusa: String(motivo).trim(),
    recusado_por: perfil.id,
    recusado_em: agora,
  }).eq("id", lanc.id);

  await db.from("lancamento_historico").insert({
    lancamento_id: lanc.id,
    acao: "excluido_da_fila",
    de: lanc.situacao, para: "cancelado",
    quem: perfil.id, em: agora,
    valor_anterior: lanc.valor, valor_novo: lanc.valor,
    motivo: String(motivo).trim(),
    comentario: "Excluído da fila de aprovações. O registro foi mantido.",
  });

  const c: any = lanc.contas;
  return NextResponse.json({
    ok: true,
    loja: c?.lojas?.codigo ?? null,
    tipo: c?.tipo ?? null,
    fornecedor: c?.fornecedor_nome ?? null,
  });
}
