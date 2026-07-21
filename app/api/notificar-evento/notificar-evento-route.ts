import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Notificações pontuais no Slack disparadas pelo uso do sistema
 * (conta lançada, encerrada, reativada...). Complementa os resumos
 * diário/semanal, que continuam existindo.
 */
const TEMPLATES: Record<string, (d: any) => string> = {
  lancamento: (d) => `✅ *Nova conta lançada* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}${d.valor ? ` · ${d.valor}` : ""}${d.por ? `\n_por ${d.por}_` : ""}`,
  aprovada:   (d) => `✔️ *Conta aprovada* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}${d.valor ? ` · ${d.valor}` : ""}`,
  reprovada:  (d) => `❌ *Conta reprovada* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}${d.valor ? ` · ${d.valor}` : ""}${d.motivo ? `\nMotivo: ${d.motivo}` : ""}`,
  conta_criada:    (d) => `🆕 *Nova conta cadastrada* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}${d.fornecedor ? ` · ${d.fornecedor}` : ""}`,
  conta_excluida:  (d) => `🗑️ *Conta excluída* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}`,
  fornecedor_novo: (d) => `🏭 *Novo fornecedor cadastrado* — ${d.fornecedor ?? "—"}`,
  pagamento:       (d) => `💸 *Pagamento realizado* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}${d.valor ? ` · ${d.valor}` : ""}`,
  encerrada:  (d) => `🏢 *Fornecedor encerrado* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}\n_Não gera mais cobranças; cadastro mantido._`,
  reativada:  (d) => `🔄 *Fornecedor reativado* — ${d.loja ?? "loja"} · ${d.tipo ?? "conta"}`,
  loja_concluida: (d) => `🏪 *Loja concluída* — todas as contas de ${d.loja ?? "uma loja"} foram lançadas.`,
};

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ ok: false, error: "SLACK_WEBHOOK_URL não configurado" }, { status: 200 });

  const body = await req.json().catch(() => ({}));
  const montar = TEMPLATES[String(body.evento ?? "")];
  if (!montar) return NextResponse.json({ ok: false, error: "evento desconhecido" }, { status: 400 });

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: montar(body) +
          `\n_${body.por ?? "sistema"} · ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}_`,
      }),
    });
  } catch {
    // Slack fora do ar não pode quebrar o fluxo de quem está lançando
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
