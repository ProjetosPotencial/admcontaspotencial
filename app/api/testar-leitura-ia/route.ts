export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";

// Banco de testes da leitura por IA: recebe um arquivo (PDF/imagem), roda a
// leitura completa (Anthropic + conferência NVIDIA) e devolve tudo para exibir.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("arquivo") as File | null;
    if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const inicio = Date.now();
    const extracao = await extrairDadosBoleto(buffer, file.name, file.type || "application/pdf");
    const ms = Date.now() - inicio;

    return NextResponse.json({
      ok: true,
      arquivo: file.name,
      duracao_ms: ms,
      extracao,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro ao ler o arquivo." }, { status: 500 });
  }
}
