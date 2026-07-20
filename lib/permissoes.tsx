import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMenuParaUsuario } from "@/lib/menu-cache";

/**
 * Checa, no servidor, se a pessoa logada pode abrir um módulo.
 *
 * Usa a mesma regra do menu (papel mínimo + exceções por usuário),
 * então o que ela vê no menu é exatamente o que ela consegue abrir —
 * inclusive digitando a URL direto.
 */
export async function podeAcessar(href: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).maybeSingle();
  const papel = perfil?.papel ?? "leitura";
  if (papel === "admin") return true;

  try {
    const itens = await getMenuParaUsuario(user.id, papel);
    // se o módulo nem está cadastrado no menu, não bloqueia por engano
    const existeNoMenu = itens.some((i: any) => i.href === href);
    if (existeNoMenu) return true;

    const { data: todos } = await supabase.from("menu_itens").select("href").eq("href", href).maybeSingle();
    return !todos; // href desconhecido -> libera; conhecido e fora da lista -> bloqueia
  } catch {
    // se a checagem falhar (tabela ausente, rede), não trava o sistema
    return true;
  }
}

/** Tela mostrada quando a pessoa não tem acesso ao módulo. */
export function SemPermissao({ modulo }: { modulo?: string }) {
  return (
    <div className="px-4 sm:px-8 py-16 max-w-[560px] w-full mx-auto">
      <div className="card p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-alerr-bg grid place-items-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="1.7" strokeLinecap="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7.5a4 4 0 018 0v3" />
          </svg>
        </div>
        <h1 className="font-disp text-[18px] font-bold text-[#1a1a1a]">
          Você não possui permissão para acessar este módulo.
        </h1>
        <p className="text-[13px] text-[#6c757d] mt-2 leading-relaxed">
          {modulo ? `O acesso a ${modulo} é restrito. ` : ""}
          Se você precisa usar essa área, peça a um administrador para liberar o acesso
          em <b>Usuários → Definir menus</b>.
        </p>
        <div className="flex gap-2 justify-center mt-6">
          <Link href="/painel" className="btn-primario">Voltar ao painel</Link>
        </div>
      </div>
    </div>
  );
}
