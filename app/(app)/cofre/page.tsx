import { createClient } from "@/lib/supabase/server";
import CofreClient from "./cofre-client";

export const dynamic = "force-dynamic";

export default async function CofrePage() {
  const supabase = createClient();

  const [{ data: creds }, { data: acessos }] = await Promise.all([
    supabase
      .from("credenciais")
      .select("conta_id, login, senha_secret, contas!inner ( fornecedor_nome, status, lojas ( codigo, coban ) )"),
    supabase
      .from("cofre_acessos")
      .select("motivo, acessado_em, perfis ( nome ), credenciais ( contas ( lojas ( codigo ) ) )")
      .order("acessado_em", { ascending: false })
      .limit(8),
  ]);

  const lista = (creds ?? []) as any[];
  const comSenha = lista.filter((c) => c.senha_secret).length;
  const semSenha = lista.length - comSenha;
  const ativas = lista.filter((c) => c.contas?.status === "ativo").length;

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Cofre de credenciais</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Armazene credenciais de forma segura e acesse quando precisar.</p>
      </div>

      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[1400px]">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
          <div className="min-w-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiMini label="Credenciais armazenadas" value={lista.length} cor="#1976d2" bg="#e3f2fd" />
              <KpiMini label="Com senha" value={comSenha} sub={`${lista.length ? Math.round((comSenha / lista.length) * 100) : 0}% do total`} cor="#2E7D57" bg="#E4F1EA" />
              <KpiMini label="Sem senha cadastrada" value={semSenha} cor="#c9922a" bg="#fdf3e3" />
              <KpiMini label="De contas ativas" value={ativas} cor="#6B5B95" bg="#EDE7F6" />
            </div>
            <CofreClient credenciais={lista} />
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-1">Atividade recente</h3>
              <p className="text-[11.5px] text-[#6c757d] mb-3.5">Quem revelou qual credencial</p>
              <div className="space-y-3">
                {(acessos ?? []).map((a: any, i: number) => {
                  const nome = a.perfis?.nome ?? "—";
                  const ini = nome.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
                  const loja = a.credenciais?.contas?.lojas?.codigo ?? "—";
                  const quando = a.acessado_em ? new Date(a.acessado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
                  return (
                    <div key={i} className="flex items-center gap-2.5 text-[12px]">
                      <div className="w-7 h-7 rounded-full bg-[#e9ecef] text-[#1a1a1a] grid place-items-center text-[10px] font-semibold shrink-0">{ini}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[#1a1a1a] font-medium truncate">{nome}</div>
                        <div className="text-[10.5px] text-[#adb5bd]">revelou {loja}</div>
                      </div>
                      <span className="text-[10px] text-[#adb5bd] font-mono shrink-0">{quando}</span>
                    </div>
                  );
                })}
                {(acessos ?? []).length === 0 && <div className="text-[12.5px] text-[#adb5bd]">Nenhum acesso registrado ainda.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiMini({ label, value, sub, cor, bg }: { label: string; value: number; sub?: string; cor: string; bg: string }) {
  return (
    <div className="bg-white border border-linha rounded-xl p-4 shadow-leve">
      <div className="w-9 h-9 rounded-full grid place-items-center mb-2.5" style={{ background: bg }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
      </div>
      <div className="text-[11.5px] text-[#6c757d] font-medium">{label}</div>
      <div className="text-[22px] font-bold text-[#1a1a1a] leading-none mt-1">{value}</div>
      {sub && <div className="text-[10.5px] text-[#adb5bd] mt-1.5">{sub}</div>}
    </div>
  );
}
