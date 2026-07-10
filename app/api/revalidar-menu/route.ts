import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", session.user.id).single();
  if (perfil?.papel !== "admin") return NextResponse.json({ error: "Só admin." }, { status: 403 });

  revalidateTag("menu-itens");
  return NextResponse.json({ ok: true });
}
