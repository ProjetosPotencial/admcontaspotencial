import { createClient } from "@/lib/supabase/server";

// Mapa nome-do-fornecedor (minúsculo) -> URL do logo. Usado por qualquer página
// que exibe fornecedor, para mostrar o logo cadastrado em Fornecedores.
export async function getLogosFornecedores(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.from("fornecedores").select("nome, logo_url").not("logo_url", "is", null);
  return Object.fromEntries((data ?? []).map((f: any) => [String(f.nome).toLowerCase(), f.logo_url]));
}
