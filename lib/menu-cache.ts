import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Mesma hierarquia da função papel_rank() que existe no banco - repetida
// aqui em JS de propósito, porque quem decide quem vê o quê agora é o
// código, não mais uma consulta com RLS. A estrutura do menu em si não é
// segredo (qualquer usuário logado poderia ver a lista completa sem
// problema), só a VISIBILIDADE por papel que precisa ficar certa.
const RANK: Record<string, number> = { leitura: 0, operador: 1, gestor: 2, admin: 3 };

export type MenuItemBruto = { id: string; label: string; href: string; icone: string; ordem: number; papel_minimo: string; ativo: boolean };

// Busca TODOS os itens do menu (não filtrado por papel) direto com a chave
// de serviço - por isso pode ser cacheado com segurança: o resultado é
// igual pra todo mundo, a diferença de quem vê o quê acontece depois,
// em getMenuParaPapel(). Recarrega sozinho a cada 5 minutos, ou na hora
// se um admin editar o menu (revalidateTag em /api/revalidar-menu).
const buscarTodosOsItens = unstable_cache(
  async (): Promise<MenuItemBruto[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("menu_itens")
      .select("id, label, href, icone, ordem, papel_minimo, ativo")
      .eq("ativo", true)
      .order("ordem");
    return (data ?? []) as MenuItemBruto[];
  },
  ["menu-itens-todos"],
  { revalidate: 300, tags: ["menu-itens"] }
);

export async function getMenuParaPapel(papel: string) {
  const todos = await buscarTodosOsItens();
  const meuRank = RANK[papel] ?? 0;
  return todos.filter((item) => (RANK[item.papel_minimo] ?? 0) <= meuRank);
}

// Menu efetivo de um usuário: parte do padrão do papel e aplica as
// exceções por usuário (tabela perfil_menu). Admin sempre vê tudo, pra
// ninguém se trancar pra fora do próprio painel.
export async function getMenuParaUsuario(userId: string, papel: string) {
  const todos = await buscarTodosOsItens();
  if (papel === "admin") return todos;

  const meuRank = RANK[papel] ?? 0;
  const supabase = createAdminClient();
  const { data: overrides } = await supabase
    .from("perfil_menu")
    .select("menu_item_id, permitido")
    .eq("perfil_id", userId);
  const mapa = new Map((overrides ?? []).map((o: { menu_item_id: string; permitido: boolean }) => [o.menu_item_id, o.permitido]));

  return todos.filter((item) => {
    if (mapa.has(item.id)) return mapa.get(item.id) === true;      // exceção explícita
    return (RANK[item.papel_minimo] ?? 0) <= meuRank;               // padrão do papel
  });
}
