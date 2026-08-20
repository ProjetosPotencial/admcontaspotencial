import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth-usuario";
import { TIPOS } from "@/lib/types";

/**
 * Quais tipos de conta o usuário logado enxerga.
 *
 * Isto é para a TELA — montar o filtro só com o que a pessoa pode ver, para
 * ela não escolher uma opção que devolveria lista vazia.
 *
 * A proteção de verdade NÃO está aqui: está na RLS do banco
 * (sql/2026-08-20-permissao-tipos-conta.sql). Nesta arquitetura o navegador
 * fala direto com o Supabase, então esconder a opção no filtro não impede
 * ninguém de chamar a API. Os dois existem por motivos diferentes — um é
 * usabilidade, o outro é segurança — e o daqui nunca substitui o de lá.
 */

/** Todos os tipos que o sistema conhece, na ordem em que aparecem no filtro. */
export const TODOS_OS_TIPOS = Object.keys(TIPOS);

/**
 * `null` significa "todos" — é o estado de quem nunca foi configurado, e o
 * mesmo que a função pode_ver_tipo() usa no banco. Manter os dois lados com
 * a mesma convenção evita que a tela e a RLS discordem sobre quem vê o quê.
 */
export const permitidosDoUsuario = cache(async (): Promise<string[] | null> => {
  const user = await usuarioAtual();
  if (!user) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from("perfis")
    .select("papel, tipos_permitidos")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return [];
  if (data.papel === "admin") return null;              // admin vê tudo, sempre
  if (!data.tipos_permitidos) return null;              // nunca configurado = tudo
  return data.tipos_permitidos as string[];
});

/** A lista pronta para montar o filtro da tela. */
export async function tiposParaFiltro(): Promise<{ valor: string; rotulo: string }[]> {
  const permitidos = await permitidosDoUsuario();
  const lista = permitidos ?? TODOS_OS_TIPOS;
  return lista
    .filter((t) => TIPOS[t])
    .map((t) => ({ valor: t, rotulo: TIPOS[t].n }));
}

/** Serve para esconder ação/coluna de um tipo específico na tela. */
export async function podeVerTipo(tipo: string | null | undefined): Promise<boolean> {
  if (!tipo) return true;
  const permitidos = await permitidosDoUsuario();
  return permitidos === null || permitidos.includes(tipo);
}
