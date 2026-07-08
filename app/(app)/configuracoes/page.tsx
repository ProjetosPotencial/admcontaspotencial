import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("nome, email, papel, ativo, created_at").eq("id", user?.id).single();

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Configurações</h1>
        <p className="text-[14px] text-[#666] mt-2.5">Sua conta neste sistema</p>
      </div>
      <div className="px-8 pb-8 max-w-[560px]">
        <div className="card p-6">
          <div className="grid grid-cols-2 gap-y-4">
            <div>
              <div className="text-[12px] text-[#999] font-medium mb-0.5">Nome</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">{perfil?.nome ?? "—"}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#999] font-medium mb-0.5">Papel</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a] capitalize">{perfil?.papel ?? "—"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[12px] text-[#999] font-medium mb-0.5">E-mail</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">{perfil?.email ?? user?.email}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#999] font-medium mb-0.5">Status</div>
              <span className={`badge ${perfil?.ativo ? "bg-ok-bg text-ok" : "bg-[#f5f5f5] text-[#999]"}`}>{perfil?.ativo ? "Ativo" : "Inativo"}</span>
            </div>
            <div>
              <div className="text-[12px] text-[#999] font-medium mb-0.5">Membro desde</div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">
                {perfil?.created_at ? new Date(perfil.created_at).toLocaleDateString("pt-br") : "—"}
              </div>
            </div>
          </div>
        </div>
        <p className="text-[12px] text-[#999] mt-4">Para trocar de senha ou dados, peça ao administrador do sistema.</p>
      </div>
    </>
  );
}
