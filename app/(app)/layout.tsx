import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMenuParaPapel } from "@/lib/menu-cache";
import Sidebar from "@/components/sidebar";
import TopNav from "@/components/topnav";
import AppShell from "@/components/app-shell";
import IaFlutuante from "@/components/ia-flutuante";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const user = session.user;

  // o papel do usuário precisa ser sempre fresco (se um admin rebaixar
  // alguém, isso tem que valer na hora, não pode ficar em cache). Já o
  // CONTEÚDO do menu (estrutura, não a visibilidade) quase nunca muda,
  // então esse sim fica em cache - ver lib/menu-cache.ts.
  const { data: perfil } = await supabase.from("perfis").select("nome, email, papel").eq("id", user.id).single();
  const menuItens = await getMenuParaPapel(perfil?.papel ?? "leitura");

  const nome = perfil?.nome ?? user.email ?? "Usuário";
  const email = perfil?.email ?? user.email ?? "";

  return (
    <AppShell>
      <Suspense fallback={<div className="bg-ebano w-[248px] shrink-0 h-screen sticky top-0 hidden md:block" />}>
        <Sidebar nome={nome} email={email} itens={menuItens} />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <IaFlutuante />
    </AppShell>
  );
}
