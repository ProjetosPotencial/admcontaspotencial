/**
 * Conta com valor R$ 0,00.
 *
 * Zero é um valor informado, não um campo em branco. A distinção que o
 * sistema passa a fazer:
 *
 *   valor = null  -> ninguém informou ainda (isso sim é pendência)
 *   valor = 0     -> informado, e é zero, com motivo obrigatório
 *
 * Antes os dois caíam no mesmo balde de "sem valor", e a conta zerada
 * ficava eternamente na lista de pendências sem ninguém conseguir fechar.
 */

export type MotivoZerado = { valor: string; rotulo: string };

export const MOTIVOS_ZERADO: MotivoZerado[] = [
  { valor: "sem_cobranca", rotulo: "Sem cobrança no período" },
  { valor: "nao_gerada", rotulo: "Conta não gerada" },
  { valor: "isento", rotulo: "Isento" },
  { valor: "loja_fechada", rotulo: "Loja fechada" },
  { valor: "nao_faturou", rotulo: "Fornecedor não faturou" },
  { valor: "sem_consumo", rotulo: "Sem consumo" },
  { valor: "outro", rotulo: "Outro" },
];

/** Texto gravado no lançamento — por extenso, pra ser legível meses depois. */
export function textoMotivoZerado(valor: string, textoLivre?: string | null): string {
  if (valor === "outro") return (textoLivre ?? "").trim();
  return MOTIVOS_ZERADO.find((m) => m.valor === valor)?.rotulo ?? valor;
}

export function motivoZeradoValido(valor: string, textoLivre?: string | null): boolean {
  if (!valor) return false;
  return textoMotivoZerado(valor, textoLivre).length > 0;
}

/**
 * Lê o que foi digitado no campo de valor.
 *
 * Existe porque "0" precisa sobreviver à conversão. Number("") é 0, então
 * testar só o número confundiria campo vazio com zero legítimo — a string
 * vazia tem que ser barrada ANTES de virar número.
 */
export function lerValorDigitado(texto: string): { ok: boolean; valor: number | null; erro?: string } {
  const limpo = (texto ?? "").trim();
  if (limpo === "") return { ok: false, valor: null, erro: "Informe o valor da conta (use 0,00 se não houve cobrança)." };

  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return { ok: false, valor: null, erro: "Valor inválido." };
  if (n < 0) return { ok: false, valor: null, erro: "O valor não pode ser negativo." };

  return { ok: true, valor: n };
}

/** Zero de verdade — e não nulo, que é outra coisa. */
export function ehZerada(valor: number | null | undefined): boolean {
  return valor != null && Number(valor) === 0;
}

/** Ninguém informou o valor ainda. Isso sim continua sendo pendência. */
export function semValorInformado(valor: number | null | undefined): boolean {
  return valor == null;
}
