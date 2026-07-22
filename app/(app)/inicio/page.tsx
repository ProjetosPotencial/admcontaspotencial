import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRotaInicial } from "@/lib/menu-cache";
import { SemNenhumAcesso } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

// Rota neutra para onde o login manda. Ela olha as permissões reais da
// pessoa e decide o destino - nunca assume o Painel. Se não houver
// nenhum módulo liberado, mostra a tela de sem acesso em vez de deixar
// entrar numa página qualquer.
export default async function InicioPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).maybeSingle();
  const rota = await getRotaInicial(user.id, perfil?.papel ?? "leitura");

  if (!rota) return <SemNenhumAcesso />;
  redirect(rota);
}
