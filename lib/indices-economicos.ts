import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Índices econômicos, vindos do SGS do Banco Central.
 *
 * A especificação pedia Banco Central, IBGE e FGV. Na prática o SGS
 * republica os três, com formato idêntico — uma integração no lugar de três,
 * e sem depender da API do IBGE, que muda de contrato com alguma frequência.
 */

export const SERIES: Record<string, { serie: string; nome: string; origem: string }> = {
  ipca: { serie: "433", nome: "IPCA", origem: "IBGE" },
  inpc: { serie: "188", nome: "INPC", origem: "IBGE" },
  igpm: { serie: "189", nome: "IGP-M", origem: "FGV" },
};

/** O que o SGS devolve: data "dd/mm/aaaa" e valor como string. */
type LinhaSGS = { data: string; valor: string };

/**
 * Busca a série mensal no SGS.
 *
 * O SGS aceita no máximo 10 anos por chamada e devolve erro seco quando o
 * intervalo é maior — por isso a janela é sempre curta aqui.
 */
async function buscarSerie(serie: string, desde: Date): Promise<LinhaSGS[]> {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados`
    + `?formato=json&dataInicial=${fmt(desde)}&dataFinal=${fmt(new Date())}`;

  const resp = await fetch(url, { headers: { accept: "application/json" } });
  if (!resp.ok) throw new Error(`SGS ${serie} respondeu HTTP ${resp.status}`);

  const json = await resp.json();
  if (!Array.isArray(json)) throw new Error(`SGS ${serie} devolveu formato inesperado`);
  return json as LinhaSGS[];
}

/**
 * Sincroniza os três índices.
 *
 * Guarda a variação de cada MÊS. Quando encontra um mês já gravado com
 * percentual diferente (o IBGE revisa publicações), preserva o valor antigo
 * na tabela de revisões antes de atualizar — assim um reajuste feito com o
 * número anterior continua explicável.
 */
export async function sincronizarIndices(mesesParaTras = 18) {
  const db = createAdminClient();
  const desde = new Date();
  desde.setMonth(desde.getMonth() - mesesParaTras);

  let novos = 0, revisados = 0;
  const erros: string[] = [];

  for (const [chave, cfg] of Object.entries(SERIES)) {
    try {
      const linhas = await buscarSerie(cfg.serie, desde);

      const { data: existentes } = await db
        .from("indices_economicos")
        .select("ano, mes, percentual")
        .eq("indice", chave);

      const mapa = new Map(
        (existentes ?? []).map((e: any) => [`${e.ano}-${e.mes}`, Number(e.percentual)]),
      );

      for (const linha of linhas) {
        const [, mes, ano] = linha.data.split("/").map(Number);
        const percentual = Number(linha.valor);
        if (!Number.isFinite(percentual) || !ano || !mes) continue;

        const anterior = mapa.get(`${ano}-${mes}`);

        if (anterior === undefined) {
          await db.from("indices_economicos").insert({
            indice: chave, ano, mes, percentual,
            fonte: `BCB/SGS · ${cfg.origem}`, serie: cfg.serie,
          });
          novos++;
          continue;
        }

        // mesmo número: nada a fazer (o caso comum, todo dia)
        if (Math.abs(anterior - percentual) < 0.00005) continue;

        // revisão: guarda o antigo ANTES de mexer no vigente
        await db.from("indices_economicos_revisoes").insert({
          indice: chave, ano, mes,
          percentual_antigo: anterior, percentual_novo: percentual,
        });
        await db.from("indices_economicos")
          .update({ percentual, atualizado_em: new Date().toISOString() })
          .eq("indice", chave).eq("ano", ano).eq("mes", mes);
        revisados++;
      }
    } catch (err: any) {
      erros.push(`${cfg.nome}: ${err?.message ?? "erro"}`);
    }
  }

  return { ok: erros.length === 0, novos, revisados, erros: erros.length ? erros : undefined };
}

export type AcumuladoPeriodo = {
  percentual: number;
  /** os meses que entraram na conta — sem isso o reajuste não é auditável */
  meses: { ano: number; mes: number; percentual: number }[];
  /** faltou algum mês do período na base? então o número está incompleto */
  completo: boolean;
};

/**
 * Acumulado de um índice entre dois meses, pelo produtório.
 *
 * É AQUI que mora o erro caro do módulo. O IPCA de um mês é ~0,4%; o
 * acumulado de doze meses é ~4,5%. Reajustar aluguel pelo mês isolado
 * corrigiria um contrato de R$ 8.000 em R$ 32 em vez de R$ 360 — e o número
 * parece plausível o bastante pra ninguém desconfiar.
 *
 * Por isso a função devolve os meses usados junto do resultado, e avisa
 * quando algum mês do período está faltando na base.
 */
export async function acumuladoDoPeriodo(
  indice: string,
  de: { ano: number; mes: number },
  ate: { ano: number; mes: number },
): Promise<AcumuladoPeriodo> {
  const db = createAdminClient();

  const { data } = await db
    .from("indices_economicos")
    .select("ano, mes, percentual")
    .eq("indice", indice)
    .order("ano").order("mes");

  const dentro = (r: any) => {
    const chave = r.ano * 12 + r.mes;
    return chave >= de.ano * 12 + de.mes && chave <= ate.ano * 12 + ate.mes;
  };

  const meses = (data ?? []).filter(dentro).map((r: any) => ({
    ano: r.ano, mes: r.mes, percentual: Number(r.percentual),
  }));

  // produtório: (1+i₁)(1+i₂)…(1+iₙ) − 1
  const fator = meses.reduce((acc, m) => acc * (1 + m.percentual / 100), 1);
  const percentual = (fator - 1) * 100;

  const esperados = (ate.ano * 12 + ate.mes) - (de.ano * 12 + de.mes) + 1;

  return {
    percentual: Math.round(percentual * 10000) / 10000,
    meses,
    completo: meses.length === esperados,
  };
}
