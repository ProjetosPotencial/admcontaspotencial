import { createAdminClient } from "@/lib/supabase/admin";
import { estaAtrasada, obterPeriodoAtual } from "@/lib/date-utils";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";

export async function enviarResumoSemanalSlack() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false as const, status: 500, error: "SLACK_WEBHOOK_URL não configurado." };
  }

  const supabase = createAdminClient();
  const { ano, mes } = obterPeriodoAtual();

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const isoSeteDias = seteDiasAtras.toISOString();

  const [{ data: lancadosSemana, error: e1 }, { data: aprovadosSemana, error: e2 }, { data: atrasadasAgora, error: e3 }] = await Promise.all([
    supabase.from("lancamentos").select("id, valor, lancado_em, contas!inner ( lojas ( codigo ) )")
      .gte("lancado_em", isoSeteDias),
    supabase.from("lancamentos").select("id, valor, situacao, aprovado_em")
      .gte("aprovado_em", isoSeteDias).in("situacao", ["aprovado", "pago", "contestado"]),
    supabase.from("lancamentos")
      .select("id, situacao, contas!inner ( tipo, dia_vencimento, lojas ( codigo ) )")
      .eq("ano", ano).eq("mes", mes).eq("situacao", "pendente"),
  ]);

  if (e1 || e2 || e3) {
    return { ok: false as const, status: 500, error: (e1 ?? e2 ?? e3)?.message ?? "erro desconhecido" };
  }

  const totalLancado = (lancadosSemana ?? []).reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const aprovados = (aprovadosSemana ?? []).filter((l) => l.situacao === "aprovado" || l.situacao === "pago");
  const contestados = (aprovadosSemana ?? []).filter((l) => l.situacao === "contestado");
  const totalAprovado = aprovados.reduce((s, l) => s + Number(l.valor ?? 0), 0);

  const atrasadasReais = (atrasadasAgora ?? []).filter((l: any) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano));

  // ranking de lojas com mais contas atrasadas agora
  const porLoja: Record<string, number> = {};
  atrasadasReais.forEach((l: any) => {
    const codigo = l.contas?.lojas?.codigo ?? "?";
    porLoja[codigo] = (porLoja[codigo] ?? 0) + 1;
  });
  const topLojasAtrasadas = Object.entries(porLoja).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if ((lancadosSemana ?? []).length === 0 && (aprovadosSemana ?? []).length === 0 && atrasadasReais.length === 0) {
    return { ok: true as const, enviado: false, motivo: "sem movimento nos últimos 7 dias" };
  }

  const urlSite = process.env.APP_URL ?? "https://admcontaspotencial.vercel.app";
  const blocos: any[] = [
    { type: "header", text: { type: "plain_text", text: "📊 Resumo semanal — Contas de consumo", emoji: true } },
    { type: "context", elements: [{ type: "mrkdwn", text: `Últimos 7 dias, até ${new Date().toLocaleDateString("pt-br")}` }] },
    { type: "divider" },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Lançado na semana*\n${(lancadosSemana ?? []).length} contas · ${money(totalLancado)}` },
        { type: "mrkdwn", text: `*Aprovado na semana*\n${aprovados.length} contas · ${money(totalAprovado)}` },
      ],
    },
  ];

  if (contestados.length > 0) {
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `⚠️ *${contestados.length} lançamento(s) contestado(s)* essa semana — precisa relançar com boleto corrigido.` } });
  }

  if (topLojasAtrasadas.length > 0) {
    const lista = topLojasAtrasadas.map(([codigo, qtd]) => `• *${codigo}* — ${qtd} conta${qtd > 1 ? "s" : ""} atrasada${qtd > 1 ? "s" : ""}`).join("\n");
    blocos.push({ type: "divider" });
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*🔴 Lojas com mais atraso agora (${atrasadasReais.length} contas atrasadas no total)*\n${lista}` } });
  } else {
    blocos.push({ type: "divider" });
    blocos.push({ type: "section", text: { type: "mrkdwn", text: "✅ Nenhuma conta atrasada no momento." } });
  }

  blocos.push({
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "Ver relatório completo", emoji: true }, url: `${urlSite}/relatorios`, style: "primary" },
    ],
  });

  const resposta = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: blocos }),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    return { ok: false as const, status: 502, error: `Slack recusou o envio: ${texto}` };
  }

  return {
    ok: true as const, enviado: true,
    lancados: (lancadosSemana ?? []).length, aprovados: aprovados.length, contestados: contestados.length,
    atrasadas: atrasadasReais.length,
  };
}
