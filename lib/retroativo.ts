import { obterPeriodoAtual } from "@/lib/date-utils";
import { MES } from "@/lib/format";

/**
 * Lançamento de competência anterior ao mês corrente.
 *
 * A marcação acontece NO ATO do lançamento, e não é deduzida depois de
 * propósito: em setembro, todo lançamento de agosto pareceria retroativo
 * olhando só as datas. O que separa "lancei em dia" de "lancei atrasado" é o
 * momento em que a pessoa clicou, e isso só dá pra registrar na hora.
 */

export type Retroatividade = {
  retroativo: boolean;
  mesesAtraso: number;
  /** "julho/2026" — o mês a que a conta se refere */
  competencia: string;
  /** frase pronta pra tela, ou null quando está em dia */
  aviso: string | null;
};

export function avaliarRetroatividade(ano: number, mes: number, hoje = new Date()): Retroatividade {
  const atual = obterPeriodoAtual(hoje);
  const distancia = (atual.ano * 12 + atual.mes) - (ano * 12 + mes);
  const competencia = `${MES[mes - 1]}/${ano}`;

  if (distancia <= 0) {
    return { retroativo: false, mesesAtraso: 0, competencia, aviso: null };
  }

  const aviso = distancia === 1
    ? `Esta conta é de ${competencia} — competência do mês passado. Informe o motivo do atraso.`
    : `Esta conta é de ${competencia} — ${distancia} meses atrás. Informe o motivo do atraso.`;

  return { retroativo: true, mesesAtraso: distancia, competencia, aviso };
}

/**
 * Motivos que a operação usa. Igual aos outros campos de motivo do sistema:
 * lista curta do que acontece de fato, mais texto livre para o resto.
 */
export const MOTIVOS_ATRASO: { valor: string; rotulo: string }[] = [
  { valor: "boleto_atrasado", rotulo: "Boleto chegou depois do fechamento do mês" },
  { valor: "esquecimento", rotulo: "Conta não foi lançada no mês correto" },
  { valor: "portal_indisponivel", rotulo: "Portal do fornecedor estava indisponível" },
  { valor: "documento_pendente", rotulo: "Documento estava pendente de correção" },
  { valor: "cadastro_novo", rotulo: "Conta cadastrada depois do período" },
  { valor: "outro", rotulo: "Outro" },
];

export function textoMotivoAtraso(valor: string, textoLivre?: string | null): string {
  if (valor === "outro") return (textoLivre ?? "").trim();
  return MOTIVOS_ATRASO.find((m) => m.valor === valor)?.rotulo ?? valor;
}

export function motivoAtrasoValido(valor: string, textoLivre?: string | null): boolean {
  if (!valor) return false;
  return textoMotivoAtraso(valor, textoLivre).length > 0;
}

/** A observação que aparece na lista de Lançamentos. */
export function observacaoRetroativa(r: Retroatividade, motivo: string): string {
  return `Lançamento retroativo · competência ${r.competencia} · ${motivo}`;
}
