import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPEIS = ["leitura", "operador", "gestor", "admin"];

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", session.user.id).single();
  if (perfil?.papel !== "admin") {
    return NextResponse.json({ error: "Só administradores podem criar usuários." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const senha = String(body.senha ?? "").trim();
  const papel = String(body.papel ?? "leitura");
  const overrides: { menu_item_id: string; permitido: boolean }[] = Array.isArray(body.overrides) ? body.overrides : [];

  if (!email || !senha) return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  if (senha.length < 6) return NextResponse.json({ error: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });
  if (!PAPEIS.includes(papel)) return NextResponse.json({ error: "Papel inválido." }, { status: 400 });

  const admin = createAdminClient();

  // 1) cria o login (auth)
  const { data: criado, error: errAuth } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true, user_metadata: { nome },
  });
  if (errAuth || !criado?.user) {
    const jaExiste = /already|exists|registered/i.test(errAuth?.message ?? "");
    return NextResponse.json({ error: jaExiste ? "Já existe um usuário com esse e-mail." : "Não foi possível criar o login." }, { status: 400 });
  }
  const uid = criado.user.id;

  // 2) cria/atualiza o perfil com o papel escolhido
  const { error: errPerfil } = await admin.from("perfis").upsert({
    id: uid, nome: nome || email, email, papel, ativo: true,
  });
  if (errPerfil) {
    return NextResponse.json({ error: "Login criado, mas falhou ao salvar o perfil." }, { status: 500 });
  }

  // 3) exceções de menu (opcional)
  if (overrides.length) {
    const linhas = overrides
      .filter((o) => o && o.menu_item_id)
      .map((o) => ({ perfil_id: uid, menu_item_id: o.menu_item_id, permitido: !!o.permitido }));
    if (linhas.length) await admin.from("perfil_menu").upsert(linhas);
  }

  return NextResponse.json({ ok: true, id: uid, nome: nome || email, email, papel, ativo: true }, { status: 200 });
}
