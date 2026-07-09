import { createClient } from "@/lib/supabase/server";
import UsuariosClient from "./usuarios-client";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data: meuPerfil } = await supabase.from("perfis").select("papel").eq("id", session?.user.id).maybeSingle();
  const ehAdmin = meuPerfil?.papel === "admin";

  const { data } = await supabase.from("perfis").select("id, nome, email, papel, ativo").order("nome");

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Usuários</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Pessoas com acesso ao sistema e seus papéis</p>
      </div>
      <div className="px-8 pb-8 max-w-[900px]">
        <div className="text-[12px] text-[#adb5bd] bg-[#f1f3f5] rounded-md px-4 py-2.5 mb-4">
          {ehAdmin
            ? "Você é admin: pode mudar o papel de qualquer usuário direto nesta lista."
            : "A lista reflete o que o seu papel pode ver. Só administradores podem mudar o papel de alguém."}
        </div>
        <UsuariosClient usuarios={(data ?? []) as any[]} ehAdmin={ehAdmin} meuId={session?.user.id ?? ""} />
      </div>
    </>
  );
}
