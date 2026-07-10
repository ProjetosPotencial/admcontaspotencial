import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarResumoSemanalSlack } from "@/lib/slack-resumo-semanal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  }
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", session.user.id).single();
  if (perfil?.papel !== "admin") {
    return NextResponse.json({ error: "Só administradores podem testar o envio." }, { status: 403 });
  }

  const resultado = await enviarResumoSemanalSlack();
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : resultado.status });
}
