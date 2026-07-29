import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testarConexaoDrive } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", session.user.id).single();
  if (perfil?.papel !== "admin" && perfil?.papel !== "gestor") {
    return NextResponse.json({ error: "Só gestor ou admin podem testar." }, { status: 403 });
  }

  try {
    const r = await testarConexaoDrive();
    return NextResponse.json(r);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Erro ao testar o Drive." }, { status: 500 });
  }
}
