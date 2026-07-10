import { createAdminClient } from "@/lib/supabase/admin";
import { obterPeriodoAtual, estaAtrasada } from "@/lib/date-utils";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";

export async function enviarResumoDiarioSlack() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false as const, status: 500, error: "SLACK_WEBHOOK_URL não configurado." };
  }

  const supabase = createAdminClient();
  const { ano, mes } = obterPeriodoAtual();
  const diaAtual = new Date().getDate();

  const { data, error } = await supabase
    .from("lancamentos")
    .select("id, valor, situacao, contas!inner ( tipo, dia_vencimento, fornecedor_nome, lojas ( codigo ) )")
    .eq("ano", ano).eq("mes", mes)
    .eq("situacao", "pendente");

  if (error) {
    return { ok: false as const, status: 500, error: error.message };
  }

  const itens = (data ?? []) as any[];
  const venceHoje = itens.filter((l) => l.contas?.dia_vencimento === diaAtual);
  const atrasadas = itens.filter((l) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano));

  if (venceHoje.length === 0 && atrasadas.length === 0) {
    return { ok: true as const, enviado: false, venceHoje: 0, atrasadas: 0, motivo: "nada vencendo ou atrasado hoje" };
  }

  function linha(l: any) {
    const t = TIPOS[l.contas.tipo]?.n ?? l.contas.tipo;
    return `• *${l.contas.lojas?.codigo ?? "?"}* — ${t} · ${l.contas.fornecedor_nome ?? "sem fornecedor"} — ${money(l.valor)}`;
  }

  const blocos: any[] = [
    { type: "header", text: { type: "plain_text", text: "📋 Contas de consumo — resumo do dia", emoji: true } },
  ];

  if (venceHoje.length > 0) {
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*🟡 Vence hoje (${venceHoje.length})*\n${venceHoje.map(linha).join("\n")}` } });
  }
  if (atrasadas.length > 0) {
    blocos.push({ type: "divider" });
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*🔴 Atrasadas, ninguém lançou ainda (${atrasadas.length})*\n${atrasadas.map(linha).join("\n")}` } });
  }
  blocos.push({ type: "context", elements: [{ type: "mrkdwn", text: "Sistema Potencial Contas · lança pelo sistema pra sair dessa lista" }] });

  const resposta = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: blocos }),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    return { ok: false as const, status: 502, error: `Slack recusou o envio: ${texto}` };
  }

  return { ok: true as const, enviado: true, venceHoje: venceHoje.length, atrasadas: atrasadas.length };
}
