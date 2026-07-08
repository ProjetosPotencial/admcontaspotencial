import type { SupabaseClient } from "@supabase/supabase-js";

// Conta rápida usada pelo sino de notificação no topo. Mesma lógica de
// "atrasada" usada no Painel e na tela de Alertas: lançamento pendente ou
// lançado cujo vencimento já passou dentro do mês corrente.
export async function contarAlertas(supabase: SupabaseClient, ano: number, mes: number) {
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesJaPassou = hoje.getFullYear() > ano || (hoje.getFullYear() === ano && hoje.getMonth() + 1 > mes);

  const [{ data: lanc }, { count: mapear }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("situacao, contas!inner(dia_vencimento)")
      .eq("ano", ano)
      .eq("mes", mes)
      .in("situacao", ["pendente", "lancado"]),
    supabase
      .from("contas")
      .select("id", { count: "exact", head: true })
      .eq("situacao_cadastro", "aprovada")
      .eq("status", "ativo")
      .eq("origem", "a_definir"),
  ]);

  const atrasadas = (lanc ?? []).filter((l: any) => {
    const dv = l.contas?.dia_vencimento;
    if (mesJaPassou) return true;
    return dv != null && dv < diaAtual;
  }).length;

  const totalMapear = mapear ?? 0;
  return { atrasadas, mapear: totalMapear, total: atrasadas + totalMapear };
}
