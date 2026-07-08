import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { contarAlertas } from "@/lib/alertas";
import { obterPeriodoAtual } from "@/lib/date-utils";
import Sidebar from "@/components/sidebar";
import TopNav from "@/components/topnav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  // O middleware já validou a sessão contra o servidor e redireciona quem não
  // está logado antes de chegar aqui. getSession() só lê o cookie, sem bater
  // de novo no Supabase Auth — evita duplicar a chamada de rede a cada página.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const user = session.user;

  // perfil (nome) e a contagem do sino saem em paralelo, não uma depois da
  // outra, pra não pesar a navegação entre páginas.
  const { ano, mes } = obterPeriodoAtual();
  const [{ data: perfil }, alertas] = await Promise.all([
    supabase.from("perfis").select("nome, papel").eq("id", user.id).single(),
    contarAlertas(supabase, ano, mes),
  ]);

  const nome = perfil?.nome ?? user.email ?? "Usuário";

  return (
    <div className="min-h-screen flex flex-col bg-papel">
      <TopNav nome={nome} notificacoes={alertas.total} />
      <div className="flex flex-1 min-h-0">
        <Suspense fallback={<div className="bg-ebano-2 w-[232px] shrink-0" />}>
          <Sidebar />
        </Suspense>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
