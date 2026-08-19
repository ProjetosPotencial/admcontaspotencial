import { redirect } from "next/navigation";
import { getRotaInicial } from "@/lib/menu-cache";
import { perfilAtual } from "@/lib/auth-usuario";
import { SemNenhumAcesso } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

// Rota neutra para onde o login manda. Ela olha as permissões reais da
// pessoa e decide o destino - nunca assume o Painel. Se não houver
// nenhum módulo liberado, mostra a tela de sem acesso em vez de deixar
// entrar numa página qualquer.
export default async function InicioPage() {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");

  const rota = await getRotaInicial(perfil.id, perfil.papel);

  if (!rota) return <SemNenhumAcesso />;
  redirect(rota);
}
