import { cookies } from "next/headers";
import { obterPeriodoAtual, type PeriodoAtual } from "./date-utils";

/**
 * Igual obterPeriodoAtual(), mas respeita o período que a pessoa escolheu
 * no seletor do topo (guardado num cookie). Se não tiver escolhido nada
 * ainda, ou o cookie estiver com um valor inválido, cai no mês atual de
 * verdade - nunca quebra, só nunca lembra a escolha.
 *
 * Use isso nas páginas cujo conteúdo faz sentido "por mês" (Painel,
 * Contas, Lançamentos, Aprovações, Pagamentos, Centros de Custo). Não use
 * em coisas que são sempre "agora" de verdade (o sino de notificação, a
 * caixa de vencimentos do dia) - essas continuam com obterPeriodoAtual().
 */
export function obterPeriodoSelecionado(): PeriodoAtual & { ehPeriodoAtual: boolean } {
  const cookieStore = cookies();
  const mesCookie = cookieStore.get("periodo_mes")?.value;
  const anoCookie = cookieStore.get("periodo_ano")?.value;

  const atual = obterPeriodoAtual();

  const mes = mesCookie ? parseInt(mesCookie, 10) : NaN;
  const ano = anoCookie ? parseInt(anoCookie, 10) : NaN;

  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(ano) || ano < 2020 || ano > 2100) {
    return { ...atual, ehPeriodoAtual: true };
  }

  const dataEscolhida = new Date(ano, mes - 1, 1);
  const periodo = obterPeriodoAtual(dataEscolhida);
  const ehPeriodoAtual = periodo.ano === atual.ano && periodo.mes === atual.mes;
  return { ...periodo, ehPeriodoAtual };
}
