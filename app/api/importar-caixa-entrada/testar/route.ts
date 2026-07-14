import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importarCaixaEntradaDrive } from "@/lib/importar-caixa-entrada";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", session.user.id).single();
  if (perfil?.papel !== "admin" && perfil?.papel !== "gestor") {
    return NextResponse.json({ error: "Só gestor ou admin podem importar." }, { status: 403 });
  }

  const resultado = await importarCaixaEntradaDrive();
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
}
