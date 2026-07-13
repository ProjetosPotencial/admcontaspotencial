import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT = `Esse arquivo é um boleto bancário brasileiro. Extraia:
1. "valor": o valor total a pagar, em reais, como número (ex: 118.95). Se não conseguir ler com confiança, use null.
2. "codigo_barras": a linha digitável (o código numérico longo, geralmente com espaços entre grupos de dígitos, tipo "34191.79001 01043.510047 91020.150008 1 96380000011895"). Se não achar, use null.

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, nesse formato exato:
{"valor": 118.95, "codigo_barras": "34191.79001 01043.510047 91020.150008 1 96380000011895"}

Se não for possível ler o documento com confiança, responda {"valor": null, "codigo_barras": null}. Nunca invente número.`;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
  }

  const form = await req.formData();
  const arquivo = form.get("arquivo") as File | null;
  if (!arquivo) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const base64 = buffer.toString("base64");
  const isPdf = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");

  const conteudoArquivo = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: (arquivo.type || "image/jpeg") as any, data: base64 } };

  try {
    const anthropic = new Anthropic({ apiKey });
    const resposta = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      messages: [{ role: "user", content: [conteudoArquivo, { type: "text", text: PROMPT }] }] as any,
    });

    const bloco = resposta.content.find((b) => b.type === "text");
    const texto = bloco && "text" in bloco ? bloco.text.trim() : "{}";
    const json = JSON.parse(texto.replace(/^```json\s*|\s*```$/g, ""));

    return NextResponse.json({ valor: typeof json.valor === "number" ? json.valor : null, codigo_barras: json.codigo_barras || null });
  } catch (err: any) {
    console.error("Erro ao extrair dados do boleto:", err);
    return NextResponse.json({ error: "Não foi possível ler o boleto automaticamente." }, { status: 500 });
  }
}
