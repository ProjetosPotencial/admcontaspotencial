import { NextRequest, NextResponse } from "next/server";
import { sincronizarIndices } from "@/lib/indices-economicos";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Puxa IPCA, INPC e IGP-M do SGS do Banco Central.
 *
 * Roda diariamente: os índices saem em datas diferentes e mudam de mês a mês,
 * então tentar todo dia é mais simples (e mais barato) que acertar o
 * calendário de publicação de cada um. Dia sem novidade não escreve nada.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }
  const r = await sincronizarIndices();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
