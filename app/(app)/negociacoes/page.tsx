import { createClient } from "@/lib/supabase/server";
import NegociacoesClient from "./negociacoes-client";
import { podeAcessar, SemPermissao } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function NegociacoesPage() {
  if (!(await podeAcessar("/negociacoes"))) return <SemPermissao modulo="Negociações" />;

  const supabase = createClient();
  const { data: negs } = await supabase
    .from("negociacoes")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(500);

  const lojaIds = Array.from(new Set((negs ?? []).map((n: any) => n.loja_id).filter(Boolean)));
  const { data: lojas } = lojaIds.length
    ? await supabase.from("lojas").select("id, codigo, coban, cidade, uf").in("id", lojaIds)
    : { data: [] as any[] };
  const lojaMap = Object.fromEntries((lojas ?? []).map((l: any) => [l.id, l]));

  const respIds = Array.from(new Set((negs ?? []).map((n: any) => n.responsavel_id).filter(Boolean)));
  const { data: perfis } = respIds.length
    ? await supabase.from("perfis").select("id, nome").in("id", respIds)
    : { data: [] as any[] };
  const perfilMap = Object.fromEntries((perfis ?? []).map((p: any) => [p.id, p.nome ?? "—"]));

  const { data: forns } = await supabase.from("fornecedores").select("nome, logo_url").not("logo_url", "is", null);
  const logos = Object.fromEntries((forns ?? []).map((f: any) => [String(f.nome).toLowerCase(), f.logo_url]));

  return <NegociacoesClient negociacoes={(negs ?? []) as any[]} lojas={lojaMap} responsaveis={perfilMap} logos={logos} />;
}
