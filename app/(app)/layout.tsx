import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import TopNav from "@/components/topnav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel")
    .eq("id", user.id)
    .single();

  const nome = perfil?.nome ?? user.email ?? "Usuário";

  return (
    <div className="min-h-screen flex flex-col bg-papel">
      <TopNav nome={nome} />
      <div className="flex flex-1 min-h-0">
        <Suspense fallback={<div className="bg-[#2a2a2a] w-[232px] shrink-0" />}>
          <Sidebar />
        </Suspense>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
