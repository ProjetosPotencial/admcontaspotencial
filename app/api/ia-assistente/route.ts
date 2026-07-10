import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { FERRAMENTAS, executarFerramenta } from "@/lib/ia-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é o assistente interno do sistema de Contas de Consumo do Grupo Potencial.
Responde em português do Brasil, de forma direta e curta.
Você tem ferramentas pra consultar de verdade: contratos, contas de consumo, lançamentos do mês, alertas (atrasadas/aprovações pendentes/sem origem), lojas e fornecedores.
Sempre que a pergunta envolver algum desses dados, chame a ferramenta certa antes de responder - nunca invente número, valor, loja ou data.
Se a ferramenta não trouxer nada, diga isso claramente.
Seja objetivo: listas curtas, valores formatados em R$, sem enrolação.`;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
  }

  const { mensagens } = await req.json();
  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    return NextResponse.json({ error: "Envie ao menos uma mensagem." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });
  const historico: Anthropic.MessageParam[] = mensagens;

  try {
    for (let rodada = 0; rodada < 5; rodada++) {
      const resposta = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: FERRAMENTAS,
        messages: historico,
      });

      const usoDeFerramenta = resposta.content.find((b) => b.type === "tool_use");

      if (!usoDeFerramenta) {
        const texto = resposta.content.find((b) => b.type === "text");
        return NextResponse.json({ resposta: texto && "text" in texto ? texto.text : "Não consegui formular uma resposta." });
      }

      const nomeFerramenta = (usoDeFerramenta as any).name;
      const args = (usoDeFerramenta as any).input;
      const resultado = await executarFerramenta(supabase, nomeFerramenta, args);

      historico.push({ role: "assistant", content: resposta.content });
      historico.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: (usoDeFerramenta as any).id, content: JSON.stringify(resultado) }],
      });
    }

    return NextResponse.json({ resposta: "A pergunta ficou complexa demais pra eu resolver em poucas consultas. Tenta ser mais específico." });
  } catch (err: any) {
    console.error("Erro no assistente:", err);
    return NextResponse.json({ error: err?.message ?? "Erro ao falar com a IA." }, { status: 500 });
  }
}
