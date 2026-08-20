import { createClient } from "@/lib/supabase/server";
import { Calendario, calendarioDaLoja, type Feriado, type RegraVencimento } from "@/lib/calendario";

/** só o que esta função usa do cliente Supabase — serve pro de sessão e pro de serviço */
type SupabaseLike = { from: (tabela: string) => any };

/**
 * Carrega o calendário da empresa (feriados + regra de vencimento).
 *
 * Os feriados NACIONAIS são calculados no código (inclusive os móveis, a
 * partir da Páscoa), então o banco guarda só os estaduais, municipais e os
 * internos da empresa.
 *
 * Se as tabelas ainda não existirem, devolve um calendário só com os
 * nacionais — nada quebra, o sistema apenas não conhece feriado local.
 */
export type CalendarioCarregado = {
  calendario: Calendario;
  regra: RegraVencimento;
  feriados: Feriado[];
  considerarFacultativos: boolean;
};

/**
 * @param cliente cliente Supabase alternativo. O cron roda sem ninguém
 * logado, então ele passa o cliente de serviço — sem isso, a leitura de
 * feriados dependeria de uma sessão que não existe naquele contexto.
 */
export async function carregarCalendario(ano: number, cliente?: SupabaseLike): Promise<CalendarioCarregado> {
  const anos = [ano - 1, ano, ano + 1];
  const supabase = cliente ?? createClient();

  let feriados: Feriado[] = [];
  let regra: RegraVencimento = "adiar";
  let considerarFacultativos = false;

  try {
    const [{ data: fer }, { data: cfg }] = await Promise.all([
      supabase.from("feriados").select("data, nome, escopo, uf, municipio, facultativo"),
      supabase.from("config_calendario").select("regra_vencimento, considerar_facultativos").eq("id", 1).maybeSingle(),
    ]);
    feriados = (fer ?? []) as Feriado[];
    if (cfg?.regra_vencimento) regra = cfg.regra_vencimento as RegraVencimento;
    considerarFacultativos = !!cfg?.considerar_facultativos;
  } catch {
    // sem as tabelas, seguimos só com os feriados nacionais
  }

  return {
    calendario: new Calendario(anos, feriados, considerarFacultativos),
    regra,
    feriados,
    considerarFacultativos,
  };
}

/** calendário específico de uma loja (respeita UF e município dela) */
export function calendarioDe(
  base: CalendarioCarregado,
  ano: number,
  uf?: string | null,
  municipio?: string | null
) {
  return {
    calendario: calendarioDaLoja([ano - 1, ano, ano + 1], base.feriados, uf, municipio, base.considerarFacultativos),
    regra: base.regra,
  };
}
