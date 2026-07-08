import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAPEL_LABEL: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-alerr-bg text-alerr" },
  gestor: { label: "Gestor", cls: "bg-info-bg text-info" },
  operador: { label: "Operador", cls: "bg-ok-bg text-ok" },
  leitura: { label: "Leitura", cls: "bg-[#f5f5f5] text-[#999]" },
};

export default async function UsuariosPage() {
  const supabase = createClient();
  const { data } = await supabase.from("perfis").select("id, nome, email, papel, ativo").order("nome");

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Usuários</h1>
        <p className="text-[14px] text-[#666] mt-2.5">Pessoas com acesso ao sistema e seus papéis</p>
      </div>
      <div className="px-8 pb-8 max-w-[800px]">
        <div className="text-[12px] text-[#999] bg-[#f5f5f5] rounded-md px-4 py-2.5 mb-4">
          A lista reflete o que o seu papel pode ver: gestores e administradores veem todos; os demais veem apenas o próprio usuário.
        </div>
        <div className="card overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5] h-12">
                <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Nome</th>
                <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">E-mail</th>
                <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Papel</th>
                <th className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((u: any) => {
                const iniciais = (u.nome ?? "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
                const p = PAPEL_LABEL[u.papel] ?? PAPEL_LABEL.leitura;
                return (
                  <tr key={u.id} className="h-14 border-b border-[#f0f0f0] last:border-0 hover:bg-[#f9f9f9]">
                    <td className="px-4 text-[13px] font-medium flex items-center gap-2.5 h-14">
                      <span className="w-7 h-7 rounded-full bg-[#e0e0e0] text-[#1a1a1a] grid place-items-center text-[10px] font-semibold">{iniciais}</span>
                      {u.nome}
                    </td>
                    <td className="px-4 text-[13px] text-[#666]">{u.email}</td>
                    <td className="px-4"><span className={`badge ${p.cls}`}>{p.label}</span></td>
                    <td className="px-4"><span className={`badge ${u.ativo ? "bg-ok-bg text-ok" : "bg-[#f5f5f5] text-[#999]"}`}>{u.ativo ? "Ativo" : "Inativo"}</span></td>
                  </tr>
                );
              })}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-[#999]">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
