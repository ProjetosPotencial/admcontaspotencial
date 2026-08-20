import { createAdminClient } from "@/lib/supabase/admin";
import { obterPeriodoAtual, estaAtrasada } from "@/lib/date-utils";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";
import { detectarValoresForaDoPadrao } from "@/lib/alertas-inteligentes";
import { semValorInformado } from "@/lib/conta-zerada";
import { carregarCalendario } from "@/lib/calendario-server";
import { montarAvisoAgente, mensagemTudoEmDia, ANTECEDENCIA_DIAS } from "@/lib/agente-contas";

/** Quantos dias à frente entram em "próximos vencimentos". */
const JANELA_PROXIMOS = 3;

/**
 * "Hoje" no fuso de São Paulo. A Vercel roda em UTC, então new Date() na
 * virada do dia devolve a data errada pro Brasil - mesmo problema que já
 * foi corrigido na saudação do Painel.
 */
function hojeBrasil(): { ano: number; mes: number; dia: number; diaSemana: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [ano, mes, dia] = fmt.format(new Date()).split("-").map(Number);
  // getUTCDay em data "pura" (meio-dia UTC evita qualquer borda de fuso)
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia, 12)).getUTCDay();
  return { ano, mes, dia, diaSemana };
}

/**
 * Início do último dia útil, em ISO com offset de Brasília.
 *
 * O resumo sai às 8h - nesse horário "o que aconteceu hoje" ainda está
 * vazio. Então a confirmação de boletos/lançamentos cobre o movimento do
 * último dia útil: na segunda, pega sexta + fim de semana.
 */
function inicioUltimoDiaUtil(): { iso: string; rotulo: string } {
  const { ano, mes, dia, diaSemana } = hojeBrasil();
  // segunda(1) -> volta 3 dias (sexta); domingo(0) -> 2; demais -> 1
  const voltar = diaSemana === 1 ? 3 : diaSemana === 0 ? 2 : 1;
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
  d.setUTCDate(d.getUTCDate() - voltar);
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, "0"), dd = String(d.getUTCDate()).padStart(2, "0");
  return { iso: `${y}-${m}-${dd}T00:00:00-03:00`, rotulo: `${dd}/${m}` };
}

export async function enviarResumoDiarioSlack() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false as const, status: 500, error: "SLACK_WEBHOOK_URL não configurado." };
  }

  const supabase = createAdminClient();
  const { ano, mes } = obterPeriodoAtual();
  const { dia: diaAtual } = hojeBrasil();
  const { iso: desdeISO, rotulo: rotuloDesde } = inicioUltimoDiaUtil();

  // garante que toda conta ativa tenha linha "pendente" no período - sem
  // isso a contagem de pendentes fica menor que a realidade.
  await supabase.rpc("garantir_lancamentos_pendentes", { p_ano: ano, p_mes: mes });

  const [
    { data: lancPeriodo, error: e1 },
    { data: aguardandoAprovacao, error: e2 },
    { data: boletosMovimento, error: e3 },
    { data: boletosNaCaixa, error: e4 },
    { data: resolvidas },
    { data: historicoAno, error: e5 },
  ] = await Promise.all([
    // tudo do período: serve pra pendentes, vence hoje, próximos e atrasadas
    supabase
      .from("lancamentos")
      .select("id, valor, situacao, contas!inner ( tipo, dia_vencimento, fornecedor_nome, origem, lojas ( codigo ) )")
      .eq("ano", ano).eq("mes", mes),
    // fila de aprovação: lançado e ainda não decidido (não filtra período,
    // igual à tela de Aprovações - pendência não some ao trocar de mês)
    supabase
      .from("lancamentos")
      .select("id, valor, lancado_em, contas!inner ( fornecedor_nome, lojas ( codigo ) )")
      .eq("situacao", "lancado"),
    // o que foi revisado na caixa de entrada desde o último dia útil
    supabase
      .from("caixa_entrada_boletos")
      .select("id, status, valor_detectado, revisado_em")
      .gte("revisado_em", desdeISO)
      .in("status", ["confirmado", "rejeitado"]),
    // o que ainda está parado na caixa esperando revisão
    supabase
      .from("caixa_entrada_boletos")
      .select("id, nome_arquivo, confianca, observacao")
      .eq("status", "pendente"),
    // o que SAIU da fila desde o último aviso — vira o reconhecimento no
    // topo da mensagem. Sai de lancado_em, sem precisar guardar estado.
    supabase
      .from("lancamentos")
      .select("id")
      .gte("lancado_em", desdeISO),
    // meses anteriores do ano: a base pra saber o que é valor fora do padrão
    supabase
      .from("lancamentos")
      .select("valor, contas!inner ( tipo, fornecedor_nome )")
      .eq("ano", ano).neq("mes", mes),
  ]);

  const erro = e1 ?? e2 ?? e3 ?? e4 ?? e5;
  if (erro) return { ok: false as const, status: 500, error: erro.message };

  const itens = (lancPeriodo ?? []) as any[];
  const pendentes = itens.filter((l) => l.situacao === "pendente");

  const venceHoje = pendentes.filter((l) => l.contas?.dia_vencimento === diaAtual);
  const proximos = pendentes.filter((l) => {
    const dv = l.contas?.dia_vencimento;
    return dv != null && dv > diaAtual && dv <= diaAtual + JANELA_PROXIMOS;
  });
  const atrasadas = pendentes.filter((l) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano));

  const fila = (aguardandoAprovacao ?? []) as any[];
  const confirmados = (boletosMovimento ?? []).filter((b: any) => b.status === "confirmado");
  const rejeitados = (boletosMovimento ?? []).filter((b: any) => b.status === "rejeitado");
  const naCaixa = (boletosNaCaixa ?? []) as any[];

  // ---- inconsistências que pedem ação humana ----
  const baixaConfianca = naCaixa.filter((b) => b.confianca === "baixa" || b.observacao);
  const semOrigem = pendentes.filter((l) => l.contas?.origem === "a_definir");
  const semVencimento = pendentes.filter((l) => l.contas?.dia_vencimento == null);
  // Só entra aqui quem NÃO informou valor. Conta de R$ 0,00 é valor
  // informado (com motivo), não pendência — antes as duas se misturavam e a
  // conta zerada nunca saía desta lista.
  const semValor = fila.filter((l) => semValorInformado(l.valor));

  // Conta cobrando muito acima do que aquele fornecedor costuma cobrar.
  // Continua sendo um sinal do agente: é o tipo de coisa que só a máquina
  // percebe, e é exatamente o que vale avisar — diferente de um total, que
  // a tela já mostra.
  const foraDoPadrao = detectarValoresForaDoPadrao(
    itens,
    (historicoAno ?? []).map((l: any) => ({
      fornecedor: l.contas?.fornecedor_nome ?? null,
      tipo: l.contas?.tipo ?? null,
      valor: Number(l.valor ?? 0),
    })),
  );

  const inconsistencias = [baixaConfianca, semVencimento, semOrigem, semValor].filter((a) => a.length > 0);

  const soma = (arr: any[], campo = "valor") => arr.reduce((s, l) => s + Number(l[campo] ?? 0), 0);

  function linha(l: any) {
    const t = TIPOS[l.contas?.tipo]?.n ?? l.contas?.tipo ?? "—";
    return `• *${l.contas?.lojas?.codigo ?? "?"}* — ${t} · ${l.contas?.fornecedor_nome ?? "sem fornecedor"} — ${money(l.valor)}`;
  }
  // listas longas viram "e mais N" pra mensagem não virar um paredão
  function lista(arr: any[], max = 8) {
    const visiveis = arr.slice(0, max).map(linha).join("\n");
    return arr.length > max ? `${visiveis}\n_… e mais ${arr.length - max}_` : visiveis;
  }

  const urlSite = process.env.APP_URL ?? "https://admcontaspotencial.vercel.app";
  const dataHoje = `${String(diaAtual).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;

  // ==========================================================================
  // A mensagem é do AGENTE, não um relatório.
  //
  // Antes daqui saía um paredão de blocos com todos os totais e listas — o
  // mesmo que a tela já mostra. Relatório completo todo dia vira paisagem: é
  // lido uma semana e ignorado depois. Agora sai só o que pede AÇÃO hoje,
  // com nome de loja no lugar de número, e sempre orientando o que fazer.
  // O detalhe continua no sistema, que é o lugar dele.
  // ==========================================================================
  const { calendario, regra } = await carregarCalendario(ano, supabase);

  const paraAgente = (l: any) => {
    const dv = l.contas?.dia_vencimento ?? null;
    // dias de atraso dentro da competência: é o número que cresce a cada dia
    // e faz a mensagem de amanhã ser diferente da de hoje.
    const diasAtraso = dv != null && dv < diaAtual ? diaAtual - dv : 0;
    return { loja: l.contas?.lojas?.codigo ?? null, diaVencimento: dv, atrasada: diasAtraso > 0, diasAtraso };
  };

  // Vencimentos em sábado, domingo ou feriado nos próximos dias. O agente
  // avisa ANTES da sexta de propósito: esperar sexta é esperar o problema.
  const naoUteis: any[] = [];
  for (let i = 0; i <= ANTECEDENCIA_DIAS; i++) {
    const alvo = new Date(Date.UTC(ano, mes - 1, diaAtual + i, 12));
    if (calendario.ehDiaUtil(alvo)) continue;
    const motivo = calendario.motivoNaoUtil(alvo) ?? "dia não útil";
    const diaAlvo = alvo.getUTCDate();
    for (const l of pendentes) {
      if (l.contas?.dia_vencimento !== diaAlvo) continue;
      naoUteis.push({ loja: l.contas?.lojas?.codigo ?? null, data: new Date(ano, mes - 1, diaAlvo), motivo, regra });
    }
  }

  const venceAmanha = pendentes.filter((l) => l.contas?.dia_vencimento === diaAtual + 1);
  const diaSemanaHoje = new Date(Date.UTC(ano, mes - 1, diaAtual, 12)).getUTCDay();

  const texto = montarAvisoAgente({
    atrasadas: atrasadas.map(paraAgente),
    venceHoje: venceHoje.map(paraAgente),
    venceAmanha: venceAmanha.map(paraAgente),
    proximosDias: proximos.map(paraAgente),
    naoUteis,
    aguardandoAprovacao: fila.length,
    aguardandoLancamento: naCaixa.length,
    problemasCadastro: baixaConfianca.length + semVencimento.length + semOrigem.length + semValor.length,
    foraDoPadrao: foraDoPadrao.slice(0, 5).map((f) => ({ loja: f.loja, fornecedor: f.fornecedor, vezes: f.vezes })),
    resolvidasDesdeOntem: (resolvidas ?? []).length,
    desdeQuando: rotuloDesde,
    ehSexta: diaSemanaHoje === 5,
    urlSistema: urlSite,
  });

  // Nada pedindo ação: confirma que a fila zerou, em uma linha.
  const mensagem = texto ?? mensagemTudoEmDia();
  const resposta = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: mensagem }),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    return { ok: false as const, status: 502, error: `Slack recusou o envio: ${texto}` };
  }

  return {
    ok: true as const,
    enviado: true,
    confirmados: confirmados.length,
    rejeitados: rejeitados.length,
    pendentes: pendentes.length,
    aguardandoAprovacao: fila.length,
    venceHoje: venceHoje.length,
    proximos: proximos.length,
    atrasadas: atrasadas.length,
    inconsistencias: inconsistencias.length,
    foraDoPadrao: foraDoPadrao.length,
  };
}
