import { NextRequest, NextResponse } from "next/server";
import { enviarResumoDiarioSlack } from "@/lib/slack-resumo";

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

  const resultado = await enviarResumoDiarioSlack();
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : resultado.status });
}
