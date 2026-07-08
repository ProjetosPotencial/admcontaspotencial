import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";

export const dynamic = "force-dynamic";

export default async function CofrePage() {
  const supabase = createClient();

  const { data: creds } = await supabase
    .from("credenciais")
    .select("conta_id, login, senha_secret, contas!inner ( fornecedor_nome, lojas ( codigo, coban ) )")
    .limit(40);

  const { data: acessos } = await supabase
    .from("cofre_acessos")
    .select("motivo, acessado_em, perfis ( nome ), credenciais ( contas ( lojas ( codigo ) ) )")
    .order("acessado_em", { ascending: false })
    .limit(12);

  return (
    <>
      <Topbar eyebrow="Segurança" title="Cofre de credenciais" />
      <div className="px-8 py-7 max-w-[1180px] w-full">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
          <div className="card overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Loja", "Fornecedor", "Login", "Senha"].map((h) => (
                    <th key={h} className="text-left text-[10.5px] tracking-wide uppercase text-txt-3 font-semibold px-4 py-3 border-b border-linha bg-off">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(creds ?? []).map((c: any) => (
                  <tr key={c.conta_id} className="hover:bg-[#FBFAF7] transition">
                    <td className="px-4 py-3 border-b border-linha2 text-[13px]">
                      <b className="font-semibold">{c.contas?.lojas?.codigo}</b>
                      <small className="block text-txt-3 text-[11px] font-mono mt-0.5">{c.contas?.lojas?.coban}</small>
                    </td>
                    <td className="px-4 py-3 border-b border-linha2 text-[13px]">{c.contas?.fornecedor_nome ?? "—"}</td>
                    <td className="px-4 py-3 border-b border-linha2 text-[13px] font-mono">{c.login ?? "—"}</td>
                    <td className="px-4 py-3 border-b border-linha2 text-[13px]">
                      <span className={`badge ${c.senha_secret ? "bg-ok-bg text-ok" : "bg-[#EEE] text-[#777]"}`}>
                        {c.senha_secret ? "No cofre" : "Sem senha"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-ebano rounded-[14px] p-5 text-[#cfcdc7]">
            <h3 className="font-disp text-white text-[13.5px] flex items-center gap-2 mb-1">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#FFB600" strokeWidth="1.6"><path d="M10 5v5l3 2" /><circle cx="10" cy="10" r="7.5" /></svg>
              Log de auditoria
            </h3>
            <div className="text-[11.5px] text-[#807e78] mb-3.5">quem revelou qual credencial, e quando</div>
            {(acessos ?? []).length === 0 && <div className="text-[12px] text-[#6a6862]">Nenhum acesso registrado ainda.</div>}
            {(acessos ?? []).map((a: any, i: number) => {
              const nome = a.perfis?.nome ?? "—";
              const ini = nome.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
              const loja = a.credenciais?.contas?.lojas?.codigo ?? "—";
              const quando = a.acessado_em ? new Date(a.acessado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <div key={i} className="flex gap-2.5 py-2.5 border-b border-[#232323] last:border-0 items-center text-[12px]">
                  <div className="w-[26px] h-[26px] rounded-[7px] bg-petroleo text-white grid place-items-center text-[11px] font-semibold shrink-0">{ini}</div>
                  <div>revelou senha de<br /><em className="not-italic text-amarelo font-mono">{loja}</em></div>
                  <div className="ml-auto font-mono text-[#6a6862] text-[11px]">{quando}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
