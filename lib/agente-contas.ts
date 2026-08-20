import type { RegraVencimento } from "@/lib/calendario";

/**
 * O agente de contas.
 *
 * A mensagem diária antes era um relatório: totais, listas, KPIs, tudo que a
 * tela já mostra. Relatório completo no Slack todo dia é lido uma semana e
 * ignorado na segunda — vira paisagem.
 *
 * Aqui a lógica é outra: olhar os dados, decidir o que precisa de AÇÃO hoje,
 * e falar só disso. Nome de loja no lugar de número, porque "MG 062" alguém
 * reconhece como sua; "96 contas atrasadas" ninguém reconhece como sua.
 *
 * O relatório detalhado continua existindo no sistema, que é o lugar dele.
 */

/** Quantas lojas aparecem por bloco antes de virar "e outras". */
const MAX_LOJAS = 5;

/** Até quantos dias à frente o agente avisa de fim de semana/feriado. */
export const ANTECEDENCIA_DIAS = 4;

export type ContaPendente = {
  loja: string | null;
  diaVencimento: number | null;
  atrasada: boolean;
  /**
   * Há quantos dias venceu. É o que transforma a lista em escalada: repetir
   * "MG 062" todo dia com a mesma cara ensina a equipe que a mensagem não
   * muda; dizer que ela está parada há nove dias mostra que o problema está
   * envelhecendo.
   */
  diasAtraso?: number;
};

export type ContaNaoUtil = {
  loja: string | null;
  data: Date;
  motivo: string;
  /** o que a regra da empresa manda fazer com vencimento em dia não útil */
  regra: RegraVencimento;
};

export type DadosAgente = {
  atrasadas: ContaPendente[];
  venceHoje: ContaPendente[];
  venceAmanha: ContaPendente[];
  proximosDias: ContaPendente[];
  naoUteis: ContaNaoUtil[];
  aguardandoAprovacao: number;
  aguardandoLancamento: number;
  problemasCadastro: number;
  /** contas cobrando bem acima do padrão do fornecedor — só a máquina percebe */
  foraDoPadrao: { loja: string | null; fornecedor: string; vezes: number }[];
  /**
   * Quantas contas saíram da fila desde o último aviso.
   *
   * O agente não pode só cobrar. Um bot que nunca reconhece o trabalho feito
   * é um bot que as pessoas aprendem a ignorar — e aí ele para de funcionar
   * justamente quando mais precisa.
   */
  resolvidasDesdeOntem: number;
  /** rótulo do período coberto, ex "sexta" ou "ontem" */
  desdeQuando: string;
  /** sexta-feira muda o tom do aviso de fim de semana */
  ehSexta: boolean;
  urlSistema: string;
};

/**
 * Lojas distintas, as mais atrasadas primeiro.
 *
 * Quando a conta traz dias de atraso, o nome vem com ele junto — é a parte
 * que muda de um dia para o outro e evita a mensagem virar carimbo.
 */
function lojasDe(contas: ContaPendente[]): string[] {
  const vistas = new Set<string>();
  const ordenadas = [...contas].sort((a, b) => {
    const atraso = (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0);
    if (atraso !== 0) return atraso;
    return (a.diaVencimento ?? 99) - (b.diaVencimento ?? 99);
  });

  const nomes: string[] = [];
  for (const c of ordenadas) {
    const nome = c.loja?.trim();
    if (!nome || vistas.has(nome)) continue;
    vistas.add(nome);
    nomes.push(
      c.diasAtraso && c.diasAtraso > 0
        ? `${nome} — há ${c.diasAtraso} ${c.diasAtraso === 1 ? "dia" : "dias"}`
        : nome
    );
  }
  return nomes;
}

/**
 * Lista de lojas com corte.
 *
 * Passar de umas cinco lojas, a lista deixa de ser acionável e vira parede —
 * ninguém procura o próprio nome numa lista de quarenta. Acima disso, aponta
 * pro sistema.
 */
function blocoLojas(contas: ContaPendente[]): string {
  const nomes = lojasDe(contas);
  if (nomes.length === 0) return "";

  const visiveis = nomes.slice(0, MAX_LOJAS).map((n) => `• ${n}`).join("\n");
  if (nomes.length <= MAX_LOJAS) return visiveis;

  return `${visiveis}\n_Existem outras lojas com pendências. Acesse o sistema para consultar a lista completa._`;
}

/** O que fazer com uma conta que vence em dia não útil, em português. */
function orientacaoRegra(regra: RegraVencimento): string {
  if (regra === "antecipar") return "A regra é *antecipar*: o lançamento precisa ser feito antes.";
  if (regra === "adiar") return "A regra é *próximo dia útil*: pode ser programado para depois.";
  return "A regra pede *confirmação*: alguém precisa decidir entre antecipar ou deixar para o próximo dia útil.";
}

function dataCurta(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Monta a mensagem. Devolve null quando não há nada que peça ação — nesse
 * caso quem chama decide se manda o "tudo em dia" ou fica quieto.
 */
export function montarAvisoAgente(d: DadosAgente): string | null {
  const temAlgo =
    d.atrasadas.length > 0 || d.venceHoje.length > 0 || d.venceAmanha.length > 0 ||
    d.proximosDias.length > 0 || d.naoUteis.length > 0 ||
    d.aguardandoAprovacao > 0 || d.aguardandoLancamento > 0 || d.problemasCadastro > 0 ||
    d.foraDoPadrao.length > 0;

  if (!temAlgo) return null;

  const p: string[] = ["*Bom dia, Equipe Potencial!* 👋", ""];

  // Reconhecer o que andou vem ANTES de cobrar o que falta. Abrir sempre
  // pela cobrança é o que faz o time parar de ler.
  if (d.resolvidasDesdeOntem > 0) {
    p.push(
      `✅ ${d.resolvidasDesdeOntem} ${d.resolvidasDesdeOntem === 1 ? "conta saiu" : "contas saíram"} da fila desde ${d.desdeQuando}. Obrigado!`,
      "",
    );
  }

  p.push("Passando para lembrar das contas que precisam de atenção hoje.", "");

  // ---- 1. atrasadas: a prioridade, e nunca só informativo ----
  if (d.atrasadas.length > 0) {
    p.push("🔴 *Contas atrasadas*");
    p.push("Ainda temos lojas com contas que não foram lançadas. Essas são as que precisam sair da fila primeiro.");
    const lojas = blocoLojas(d.atrasadas);
    if (lojas) p.push("", lojas);
    p.push("");
  }

  // ---- 2. vence hoje ----
  if (d.venceHoje.length > 0) {
    p.push("🟠 *Vencendo hoje*");
    p.push("Algumas contas vencem hoje e precisam ser verificadas.");
    const lojas = blocoLojas(d.venceHoje);
    if (lojas) p.push("", lojas);
    p.push("");
  }

  // ---- 3. fim de semana e feriado: o aviso que evita esquecimento ----
  if (d.naoUteis.length > 0) {
    p.push(d.ehSexta
      ? "⚠️ *Atenção antes do fim do expediente*"
      : "⚠️ *Vencimentos em dia não útil*");

    // agrupa por data, pra dizer "sábado 23/08" e não repetir a explicação
    const porData = new Map<string, ContaNaoUtil[]>();
    for (const c of d.naoUteis) {
      const chave = dataCurta(c.data);
      porData.set(chave, [...(porData.get(chave) ?? []), c]);
    }

    for (const [quando, contas] of Array.from(porData.entries()).sort()) {
      const motivo = contas[0].motivo;
      const lojas = lojasDe(contas.map((c) => ({ loja: c.loja, diaVencimento: null, atrasada: false })));
      const visiveis = lojas.slice(0, MAX_LOJAS).map((n) => `• ${n}`).join("\n");
      const resto = lojas.length > MAX_LOJAS ? `\n_… e outras ${lojas.length - MAX_LOJAS} lojas._` : "";

      p.push("", `*${quando} — ${motivo}*`);
      if (visiveis) p.push(visiveis + resto);
      p.push(orientacaoRegra(contas[0].regra));
    }

    p.push("", d.ehSexta
      ? "👉 Verifiquem essas contas antes do fechamento de hoje, para não virarem pendência na próxima semana."
      : "👉 Vale tratar antes do fim de semana, para nenhuma conta ficar esquecida.");
    p.push("");
  }

  // ---- 4. amanhã e próximos dias: só menciona, sem lista ----
  if (d.venceAmanha.length > 0) {
    p.push("🟡 *Amanhã*");
    p.push(`Também há contas vencendo amanhã${d.venceAmanha.length <= MAX_LOJAS ? ":" : "."}`);
    if (d.venceAmanha.length <= MAX_LOJAS) {
      const lojas = blocoLojas(d.venceAmanha);
      if (lojas) p.push(lojas);
    }
    p.push("");
  } else if (d.proximosDias.length > 0) {
    p.push("🟡 *Próximos dias*");
    p.push("Há contas vencendo nos próximos dias — vale adiantar o que der.");
    p.push("");
  }

  // ---- 5. filas que dependem de outra pessoa ----
  const filas: string[] = [];
  if (d.aguardandoLancamento > 0) filas.push("🔵 Existem contas aguardando lançamento.");
  if (d.aguardandoAprovacao > 0) filas.push("🟣 Existem contas aguardando aprovação.");
  if (d.problemasCadastro > 0) filas.push("⚠️ Existem contas com pendência de cadastro que impedem o lançamento.");
  if (filas.length > 0) p.push(...filas, "");

  // ---- 6. o que só o sistema enxerga: valor fora da curva ----
  if (d.foraDoPadrao.length > 0) {
    p.push("📈 *Vale conferir antes de aprovar*");
    p.push("Algumas contas vieram bem acima do que o fornecedor costuma cobrar:");
    p.push(d.foraDoPadrao
      .map((f) => `• ${f.loja ?? "loja"} · ${f.fornecedor} — ${f.vezes.toFixed(1)}× a média`)
      .join("\n"));
    p.push("");
  }

  // ---- fecho: sempre orientando a ação ----
  p.push(`👉 Acesse o <${d.urlSistema}|*Potencial Contas*> e realize os lançamentos para retirar as pendências da fila.`);
  p.push("");
  p.push("Bom trabalho, Equipe! 🚀");

  return p.join("\n");
}

/**
 * A mensagem de quando não sobrou nada. Curta de propósito: confirmar que a
 * fila zerou vale uma linha, não um relatório.
 */
export function mensagemTudoEmDia(): string {
  return [
    "*Equipe Potencial*, as pendências de lançamento foram atualizadas. ✅",
    "",
    "As contas que foram processadas já não estão mais na fila. Bom trabalho! 🚀",
  ].join("\n");
}
