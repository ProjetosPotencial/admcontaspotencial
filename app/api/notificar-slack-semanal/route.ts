import { NextRequest, NextResponse } from "next/server";
import { enviarResumoSemanalSlack } from "@/lib/slack-resumo-semanal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const resultado = await enviarResumoSemanalSlack();
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : resultado.status });
}
