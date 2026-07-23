import { createAdminClient } from "@/lib/supabase/admin";
import { obterPeriodoAtual, estaAtrasada } from "@/lib/date-utils";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";

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
  ]);

  const erro = e1 ?? e2 ?? e3 ?? e4;
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
  const semValor = fila.filter((l) => l.valor == null || Number(l.valor) === 0);

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

  const blocos: any[] = [
    { type: "header", text: { type: "plain_text", text: `☀️ Bom dia — resumo de ${dataHoje}`, emoji: true } },
  ];

  // ---- 1. confirmação do que foi processado ----
  const textoMovimento = confirmados.length === 0 && rejeitados.length === 0
    ? `_Nenhum boleto foi revisado desde ${rotuloDesde}._`
    : [
        `✅ *${confirmados.length}* ${confirmados.length === 1 ? "boleto enviado" : "boletos enviados"} para lançamento` +
          (soma(confirmados, "valor_detectado") > 0 ? ` · ${money(soma(confirmados, "valor_detectado"))}` : ""),
        rejeitados.length > 0 ? `🗑️ *${rejeitados.length}* ${rejeitados.length === 1 ? "rejeitado" : "rejeitados"} na revisão` : null,
      ].filter(Boolean).join("\n");

  blocos.push({ type: "section", text: { type: "mrkdwn", text: `*📥 Movimento desde ${rotuloDesde}*\n${textoMovimento}` } });

  // ---- 2. números do dia, lado a lado ----
  blocos.push({ type: "divider" });
  blocos.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Lançamentos pendentes*\n${pendentes.length} ${pendentes.length === 1 ? "conta" : "contas"}` },
      { type: "mrkdwn", text: `*Aprovações pendentes*\n${fila.length} ${fila.length === 1 ? "item" : "itens"} · ${money(soma(fila))}` },
      { type: "mrkdwn", text: `*Vence hoje*\n${venceHoje.length} · ${money(soma(venceHoje))}` },
      { type: "mrkdwn", text: `*Próximos ${JANELA_PROXIMOS} dias*\n${proximos.length} · ${money(soma(proximos))}` },
    ],
  });

  // ---- 3. vencimentos do dia (detalhado) ----
  if (venceHoje.length > 0) {
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*🟡 Vence hoje (${venceHoje.length})*\n${lista(venceHoje)}` } });
  }
  if (proximos.length > 0) {
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*🟢 Vence nos próximos ${JANELA_PROXIMOS} dias (${proximos.length})*\n${lista(proximos, 5)}` } });
  }
  if (atrasadas.length > 0) {
    blocos.push({ type: "divider" });
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*🔴 Atrasadas, ninguém lançou ainda (${atrasadas.length})*\n${lista(atrasadas)}` } });
  }

  // ---- 4. fila de aprovação parada ----
  if (fila.length > 0) {
    const maisAntigo = fila
      .map((l) => l.lancado_em).filter(Boolean)
      .sort()[0];
    const desde = maisAntigo ? new Date(maisAntigo).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;
    blocos.push({ type: "divider" });
    blocos.push({
      type: "section",
      text: { type: "mrkdwn", text: `*✍️ Esperando aprovação (${fila.length})*\n${money(soma(fila))} parado na fila${desde ? ` · mais antigo desde ${desde}` : ""}` },
    });
  }

  // ---- 5. inconsistências ----
  const inconsistencias = [
    baixaConfianca.length > 0 ? `• ${baixaConfianca.length} ${baixaConfianca.length === 1 ? "boleto na caixa precisa" : "boletos na caixa precisam"} de conferência manual (leitura incerta)` : null,
    naCaixa.length > 0 ? `• ${naCaixa.length} ${naCaixa.length === 1 ? "boleto aguarda" : "boletos aguardam"} revisão na Caixa de Entrada` : null,
    semVencimento.length > 0 ? `• ${semVencimento.length} ${semVencimento.length === 1 ? "conta está" : "contas estão"} sem dia de vencimento definido` : null,
    semOrigem.length > 0 ? `• ${semOrigem.length} ${semOrigem.length === 1 ? "conta está" : "contas estão"} sem origem definida` : null,
    semValor.length > 0 ? `• ${semValor.length} ${semValor.length === 1 ? "lançamento foi enviado" : "lançamentos foram enviados"} sem valor` : null,
  ].filter(Boolean);

  if (inconsistencias.length > 0) {
    blocos.push({ type: "divider" });
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*⚠️ Pendências que precisam de atenção*\n${inconsistencias.join("\n")}` } });
  }

  // ---- rodapé + atalhos ----
  blocos.push({ type: "context", elements: [{ type: "mrkdwn", text: "Sistema Potencial Contas · lança pelo sistema pra sair dessa lista" }] });
  blocos.push({
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "Caixa de Entrada", emoji: true }, url: `${urlSite}/caixa-entrada`, style: "primary" },
      { type: "button", text: { type: "plain_text", text: "Aprovações", emoji: true }, url: `${urlSite}/aprovacoes` },
      { type: "button", text: { type: "plain_text", text: "Alertas", emoji: true }, url: `${urlSite}/alertas` },
    ],
  });

  const resposta = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: blocos, text: `Resumo do dia ${dataHoje}: ${pendentes.length} pendentes, ${fila.length} aguardando aprovação, ${atrasadas.length} atrasadas.` }),
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
  };
}
