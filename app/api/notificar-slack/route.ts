import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterPeriodoAtual, estaAtrasada } from "@/lib/date-utils";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // protege contra chamada pública: o cron da Vercel manda esse header
  // sozinho quando CRON_SECRET está configurado no ambiente do projeto.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "SLACK_WEBHOOK_URL não configurado." }, { status: 500 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const itens = (data ?? []) as any[];
  const venceHoje = itens.filter((l) => l.contas?.dia_vencimento === diaAtual);
  const atrasadas = itens.filter((l) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano));

  if (venceHoje.length === 0 && atrasadas.length === 0) {
    // nada pra avisar hoje - não manda mensagem vazia no canal
    return NextResponse.json({ ok: true, enviado: false, motivo: "nada vencendo ou atrasado hoje" });
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
    return NextResponse.json({ error: `Slack recusou o envio: ${texto}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, enviado: true, venceHoje: venceHoje.length, atrasadas: atrasadas.length });
}
