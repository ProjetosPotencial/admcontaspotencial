import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Quem está logado, no servidor — uma vez por requisição.
 *
 * supabase.auth.getUser() vai na rede TODA vez que é chamado, e o sistema
 * chamava em vários pontos do mesmo render (middleware, checagem de
 * permissão, a própria página). Com o volume de re-render que o app faz,
 * isso saturou o endpoint de autenticação: o serviço respondia em 8ms, mas
 * a requisição ficava 27 segundos na fila do gateway, e as telas paravam
 * de carregar.
 *
 * O cache() do React resolve na medida certa: ele deduplica dentro de UMA
 * requisição e joga fora depois. Não é cache entre usuários nem entre
 * páginas — não existe risco de alguém enxergar a sessão de outro.
 *
 * Use SEMPRE isto no servidor, nunca supabase.auth.getUser() direto.
 */
export const usuarioAtual = cache(async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export type PerfilAtual = {
  id: string;
  papel: string;
};

/**
 * Usuário + papel, também uma vez por requisição.
 *
 * Quase todo lugar que pedia o usuário pedia o papel logo em seguida, então
 * as duas idas (auth + tabela perfis) andam juntas aqui. Devolve null quando
 * não há ninguém logado.
 */
export const perfilAtual = cache(async (): Promise<PerfilAtual | null> => {
  const user = await usuarioAtual();
  if (!user) return null;

  const supabase = createClient();
  const { data } = await supabase.from("perfis").select("papel").eq("id", user.id).maybeSingle();
  return { id: user.id, papel: data?.papel ?? "leitura" };
});
