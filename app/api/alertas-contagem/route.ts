import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contarAlertas } from "@/lib/alertas";
import { obterPeriodoAtual } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ total: 0 });

  const { ano, mes } = obterPeriodoAtual();
  const alertas = await contarAlertas(supabase, ano, mes);
  return NextResponse.json(alertas);
}
