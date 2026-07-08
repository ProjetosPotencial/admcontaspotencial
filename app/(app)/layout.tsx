import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";

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
  const papel = perfil?.papel ?? "leitura";

  return (
    <div className="grid grid-cols-[236px_1fr] min-h-screen">
      <Sidebar nome={nome} papel={papel} />
      <main className="flex flex-col min-w-0">{children}</main>
    </div>
  );
}
