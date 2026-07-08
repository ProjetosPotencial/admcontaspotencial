import type { SupabaseClient } from "@supabase/supabase-js";
import { estaAtrasada } from "./date-utils";

// Conta rápida usada pelo sino de notificação no topo. Mesma função de
// "atrasada" usada no Painel e na tela de Alertas (lib/date-utils.ts),
// pra não ter uma terceira cópia dessa regra espalhada pelo projeto.
export async function contarAlertas(supabase: SupabaseClient, ano: number, mes: number) {
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

  const atrasadas = (lanc ?? []).filter((l: any) =>
    estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano)
  ).length;

  const totalMapear = mapear ?? 0;
  return { atrasadas, mapear: totalMapear, total: atrasadas + totalMapear };
}
