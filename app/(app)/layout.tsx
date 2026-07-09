import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { contarAlertas } from "@/lib/alertas";
import { obterPeriodoAtual } from "@/lib/date-utils";
import Sidebar from "@/components/sidebar";
import TopNav from "@/components/topnav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const user = session.user;

  const { ano, mes } = obterPeriodoAtual();
  const [{ data: perfil }, alertas, { data: menuItens }] = await Promise.all([
    supabase.from("perfis").select("nome, email, papel").eq("id", user.id).single(),
    contarAlertas(supabase, ano, mes),
    // já vem filtrado pelo papel do usuário logado, calculado no banco (vw_menu_visivel)
    supabase.from("vw_menu_visivel").select("id, label, href, icone"),
  ]);

  const nome = perfil?.nome ?? user.email ?? "Usuário";
  const email = perfil?.email ?? user.email ?? "";

  return (
    <div className="min-h-screen flex bg-papel">
      <Suspense fallback={<div className="bg-ebano w-[248px] shrink-0 h-screen sticky top-0" />}>
        <Sidebar nome={nome} email={email} itens={menuItens ?? []} />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav notificacoes={alertas.total} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
