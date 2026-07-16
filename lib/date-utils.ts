/**
 * Utilitário para gerenciar datas dinâmicas no sistema
 * Permite que o app funcione com qualquer período, não apenas Julho/2026
 */

export interface PeriodoAtual {
  ano: number;
  mes: number;
  mesAnterior: number;
  anoAnterior: number;
}

/**
 * Obtém o período atual (ano e mês)
 * Em produção, utiliza a data atual do servidor
 * Pode ser sobrescrito para testes ou períodos específicos
 */
export function obterPeriodoAtual(dataOverride?: Date): PeriodoAtual {
  const data = dataOverride || new Date();
  const ano = data.getFullYear();
  const mes = data.getMonth() + 1;

  // Mês anterior, cruzando o ano quando necessário
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;

  return { ano, mes, mesAnterior, anoAnterior };
}

/**
 * Verifica se uma conta ainda "vale" pra um período específico. Uma conta
 * encerrada continua contando normalmente ATÉ o mês do encerramento
 * (inclusive) - só deixa de contar a partir do mês seguinte. Isso evita
 * que uma conta encerrada no meio do mês suma de relatórios daquele mês
 * mesmo tendo sido cobrada normalmente até lá.
 *
 * @param status - status da conta ("ativo", "inativo", "encerrado")
 * @param dataEncerramento - data em que foi encerrada (string YYYY-MM-DD ou null)
 * @param ano - ano do período sendo visualizado
 * @param mes - mês do período sendo visualizado
 */
export function contaValidaNoPeriodo(
  status: string,
  dataEncerramento: string | null | undefined,
  ano: number,
  mes: number
): boolean {
  if (status !== "encerrado") return true;
  if (!dataEncerramento) return true; // encerrada sem data - não temos como saber o corte, mantém visível
  const dt = new Date(dataEncerramento);
  const anoEncerramento = dt.getFullYear();
  const mesEncerramento = dt.getMonth() + 1;
  // válida se o período visto é igual ou anterior ao mês do encerramento
  if (ano < anoEncerramento) return true;
  if (ano === anoEncerramento) return mes <= mesEncerramento;
  return false;
}

/**
 * Formata um período (mês/ano) em formato legível
 * @example formatarPeriodo(7, 2026) => "Julho/2026"
 */
export function formatarPeriodo(mes: number, ano: number): string {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${meses[mes - 1]}/${ano}`;
}

/**
 * Verifica se um período já passou
 * @example periodoPassed(7, 2026) => true (se hoje for depois de julho/2026)
 */
export function periodoPassed(mes: number, ano: number, dataAtual?: Date): boolean {
  const hoje = dataAtual || new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  return anoAtual > ano || (anoAtual === ano && mesAtual > mes);
}

/**
 * Verifica se uma data de vencimento está atrasada.
 *
 * Importante: só uma conta PENDENTE (que ninguém lançou ainda) pode estar
 * atrasada. Uma conta já LANÇADA não conta mais como atrasada mesmo que o
 * vencimento tenha passado - nesse ponto ela já foi tratada e está
 * esperando aprovação/pagamento, é uma situação diferente de "ninguém
 * lançou ainda". Sem essa distinção, uma conta lançada com o vencimento
 * já passado ficava presa pra sempre na lista de atrasadas, mesmo depois
 * de resolvida.
 *
 * @param situacao - situação do lançamento (pendente, lancado, etc)
 * @param diaVencimento - dia do mês do vencimento
 * @param mes - mês do período
 * @param ano - ano do período
 * @param dataAtual - data atual para comparação
 */
export function estaAtrasada(
  situacao: string,
  diaVencimento: number | null,
  mes: number,
  ano: number,
  dataAtual?: Date
): boolean {
  // Só pendente pode estar atrasada. Lançada, aprovada, paga ou contestada
  // já saíram do estado de "ninguém tratou ainda".
  if (situacao !== "pendente") {
    return false;
  }

  const hoje = dataAtual || new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();

  // Se o período já passou completamente, está atrasado
  if (anoAtual > ano || (anoAtual === ano && mesAtual > mes)) {
    return true;
  }

  // Se estamos no mesmo período, verifica o dia
  if (anoAtual === ano && mesAtual === mes) {
    if (!diaVencimento) return false;
    return diaVencimento < diaAtual;
  }

  // Se o período ainda não chegou, não está atrasado
  return false;
}

/**
 * Calcula a variação percentual entre dois valores
 * @example variacaoPct(100, 80) => 25 (aumento de 25%)
 */
export function variacaoPct(atual: number, anterior: number | null): number | null {
  if (anterior === null) return null;
  if (anterior === 0) return atual === 0 ? 0 : 100;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}
