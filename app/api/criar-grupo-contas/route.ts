import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfilAtual } from "@/lib/auth-usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Junta várias contas num grupo e gera UM lançamento.
 *
 * No servidor porque são seis escritas que precisam andar juntas: criar o
 * grupo, gravar os itens, absorver os lançamentos individuais, criar o
 * lançamento do grupo e escrever o histórico. Se isso ficasse na tela, uma
 * aba fechada no meio deixaria contas absorvidas sem lançamento nenhum — as
 * lojas sumiriam da fila e ninguém pagaria.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  if (!["admin", "gestor", "operador"].includes(perfil.papel)) {
    return NextResponse.json({ error: "Sem permissão para criar grupos." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { nome, tipoServico, fornecedor, ano, mes, vencimento, observacao, itens } = body ?? {};

  if (!nome?.trim()) return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });
  if (!Array.isArray(itens) || itens.length < 2) {
    return NextResponse.json({ error: "Selecione ao menos duas contas para formar um grupo." }, { status: 400 });
  }
  if (!ano || !mes) return NextResponse.json({ error: "Informe a competência." }, { status: 400 });

  const valores = itens.map((i: any) => Number(i.valor));
  if (valores.some((v) => !Number.isFinite(v) || v < 0)) {
    return NextResponse.json({ error: "Há valor inválido entre as contas." }, { status: 400 });
  }
  // A soma É o total. Em vez de pedir o total e conferir contra a soma, o
  // total nasce da soma — assim não existe o estado "não bate", que só daria
  // trabalho de resolver.
  const valorTotal = Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;

  const db = createAdminClient();

  // ---- regra 9: conta não entra em dois grupos ativos na mesma competência ----
  const contaIds = itens.map((i: any) => i.contaId);
  const { data: jaAgrupadas } = await db
    .from("conta_grupo_itens")
    .select("conta_id, conta_grupos!inner ( nome, ano, mes, status, excluido_em )")
    .in("conta_id", contaIds);

  const conflitos = (jaAgrupadas ?? []).filter((r: any) => {
    const g = r.conta_grupos;
    return g && g.ano === ano && g.mes === mes && !g.excluido_em
      && !["contestado", "cancelado"].includes(g.status);
  });

  if (conflitos.length > 0) {
    const nomes = Array.from(new Set(conflitos.map((c: any) => c.conta_grupos.nome)));
    return NextResponse.json({
      error: `Há conta já agrupada nesta competência (grupo: ${nomes.join(", ")}). Nada foi criado.`,
    }, { status: 409 });
  }

  const agora = new Date().toISOString();

  // ---- 1. o grupo ----
  const { data: grupo, error: erroGrupo } = await db.from("conta_grupos").insert({
    nome: nome.trim(),
    tipo_servico: tipoServico?.trim() || null,
    fornecedor: fornecedor?.trim() || null,
    ano, mes,
    valor_total: valorTotal,
    vencimento: vencimento || null,
    observacao: observacao?.trim() || null,
    status: "lancado",
    criado_por: perfil.id,
  }).select("id").single();

  if (erroGrupo || !grupo) {
    return NextResponse.json({ error: "Não foi possível criar o grupo." }, { status: 500 });
  }

  // ---- 2. absorver o lançamento individual de cada conta ----
  // Ordem deliberada: o lançamento do grupo é criado DEPOIS. Se algo falhar
  // aqui, as contas ainda têm seus lançamentos e nada se perdeu.
  const linhasItens: any[] = [];

  for (const item of itens) {
    const { data: individual } = await db
      .from("lancamentos")
      .select("id, situacao")
      .eq("conta_id", item.contaId).eq("ano", ano).eq("mes", mes)
      .maybeSingle();

    if (individual && !["pago", "aprovado"].includes(individual.situacao)) {
      await db.from("lancamentos").update({
        situacao: "cancelado",
        motivo_recusa: `Absorvido pelo grupo ${nome.trim()}`,
        recusado_por: perfil.id, recusado_em: agora,
      }).eq("id", individual.id);

      await db.from("lancamento_historico").insert({
        lancamento_id: individual.id,
        acao: "absorvido_por_grupo",
        de: individual.situacao, para: "cancelado",
        quem: perfil.id, em: agora,
        motivo: `Passou a ser cobrado pelo grupo ${nome.trim()}`,
        comentario: "O lançamento individual sai da fila; o pagamento acontece pelo grupo.",
      });
    }

    linhasItens.push({
      grupo_id: grupo.id,
      conta_id: item.contaId,
      valor: Number(item.valor),
      lancamento_absorvido_id: individual?.id ?? null,
    });
  }

  await db.from("conta_grupo_itens").insert(linhasItens);

  // ---- 3. o lançamento único ----
  const { data: lancGrupo, error: erroLanc } = await db.from("lancamentos").insert({
    conta_id: null,
    grupo_id: grupo.id,
    ano, mes,
    valor: valorTotal,
    situacao: "lancado",
    lancado_em: agora,
    lancado_por: perfil.id,
    observacao: `${nome.trim()} · ${itens.length} lojas`,
  }).select("id").single();

  if (erroLanc || !lancGrupo) {
    return NextResponse.json({
      error: "O grupo foi criado, mas o lançamento falhou. Abra o grupo e tente lançar de novo.",
      grupoId: grupo.id,
    }, { status: 500 });
  }

  await db.from("lancamento_historico").insert({
    lancamento_id: lancGrupo.id,
    acao: "grupo_criado",
    de: "—", para: "lancado",
    quem: perfil.id, em: agora,
    valor_novo: valorTotal,
    comentario: `Grupo ${nome.trim()} com ${itens.length} lojas.`,
  });

  return NextResponse.json({
    ok: true,
    grupoId: grupo.id,
    lancamentoId: lancGrupo.id,
    valorTotal,
    lojas: itens.length,
  });
}
