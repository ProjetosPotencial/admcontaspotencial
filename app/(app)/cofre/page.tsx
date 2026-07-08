import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CofrePage() {
  const supabase = createClient();

  const { data: creds } = await supabase
    .from("credenciais")
    .select("conta_id, login, senha_secret, contas!inner ( fornecedor_nome, lojas ( codigo, coban ) )")
    .limit(50);

  const { data: acessos } = await supabase
    .from("cofre_acessos")
    .select("motivo, acessado_em, perfis ( nome ), credenciais ( contas ( lojas ( codigo ) ) )")
    .order("acessado_em", { ascending: false })
    .limit(15);

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Cofre de credenciais</h1>
        <p className="text-[14px] text-[#666] mt-2.5">Armazene credenciais de forma segura</p>
      </div>

      <div className="px-8 pb-8 max-w-[1100px]">
        <div className="card overflow-hidden mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5] h-12">
                {["Loja", "Fornecedor", "Login", "Senha"].map((h) => (
                  <th key={h} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(creds ?? []).map((c: any) => (
                <tr key={c.conta_id} className="h-14 border-b border-[#f0f0f0] last:border-0 hover:bg-[#f9f9f9] transition">
                  <td className="px-4 text-[13px] font-medium">
                    {c.contas?.lojas?.codigo}
                    <small className="block text-[#999] text-[11px] font-mono">{c.contas?.lojas?.coban}</small>
                  </td>
                  <td className="px-4 text-[13px] font-medium">{c.contas?.fornecedor_nome ?? "—"}</td>
                  <td className="px-4 text-[13px] font-mono">{c.login ?? "—"}</td>
                  <td className="px-4 text-[13px] font-mono text-[#999]">
                    {c.senha_secret ? "•••••••••" : <span className="badge bg-[#f5f5f5] text-[#999] font-mono">sem senha</span>}
                  </td>
                </tr>
              ))}
              {(creds ?? []).length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-[#999]">Nenhuma credencial cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-1">Log de auditoria</h2>
          <p className="text-[13px] text-[#666] mb-4">quem revelou qual credencial, e quando</p>
          <div className="card divide-y divide-[#f0f0f0]">
            {(acessos ?? []).map((a: any, i: number) => {
              const nome = a.perfis?.nome ?? "—";
              const ini = nome.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
              const loja = a.credenciais?.contas?.lojas?.codigo ?? "—";
              const quando = a.acessado_em ? new Date(a.acessado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                  <div className="w-8 h-8 rounded-full bg-[#e0e0e0] text-[#1a1a1a] grid place-items-center text-[11px] font-semibold shrink-0">{ini}</div>
                  <div className="text-[#1a1a1a] font-medium">revelou senha de <b>{loja}</b></div>
                  <div className="ml-auto text-[12px] text-[#999] font-mono shrink-0">{quando}</div>
                </div>
              );
            })}
            {(acessos ?? []).length === 0 && <div className="text-center py-10 text-[#999] text-[13px]">Nenhum acesso registrado ainda.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
