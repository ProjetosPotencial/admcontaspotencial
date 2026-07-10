import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { FERRAMENTA_BUSCAR_CONTRATOS, executarBuscarContratos } from "@/lib/ia-contratos-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é o assistente de contratos do sistema interno do Grupo Potencial.
Responde em português do Brasil, de forma direta e curta.
Sempre que a pergunta envolver dados de contratos (quais existem, quando vencem, valores, lojas, empresas), use a ferramenta buscar_contratos antes de responder - nunca invente número, valor ou data de contrato.
Se a ferramenta não trouxer nenhum contrato, diga isso claramente, não invente um pra parecer útil.
Seja objetivo: liste os contratos relevantes com número, loja e data de vencimento quando fizer sentido.`;

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
    // loop simples de tool-use: manda a mensagem, se o Claude pedir pra
    // chamar a ferramenta, executa e devolve o resultado, até ele responder
    // com texto final (no máximo 4 rodadas, pra não rodar pra sempre).
    for (let rodada = 0; rodada < 4; rodada++) {
      const resposta = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [FERRAMENTA_BUSCAR_CONTRATOS],
        messages: historico,
      });

      const usoDeFerramenta = resposta.content.find((b) => b.type === "tool_use");

      if (!usoDeFerramenta) {
        const texto = resposta.content.find((b) => b.type === "text");
        return NextResponse.json({ resposta: texto && "text" in texto ? texto.text : "Não consegui formular uma resposta." });
      }

      // Claude pediu pra buscar contratos - executa de verdade no Supabase
      const args = (usoDeFerramenta as any).input;
      const resultado = await executarBuscarContratos(supabase, args);

      historico.push({ role: "assistant", content: resposta.content });
      historico.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: (usoDeFerramenta as any).id, content: JSON.stringify(resultado) }],
      });
    }

    return NextResponse.json({ resposta: "A pergunta ficou complexa demais pra eu resolver em poucas consultas. Tenta ser mais específico." });
  } catch (err: any) {
    console.error("Erro na IA de contratos:", err);
    return NextResponse.json({ error: err?.message ?? "Erro ao falar com a IA." }, { status: 500 });
  }
}
