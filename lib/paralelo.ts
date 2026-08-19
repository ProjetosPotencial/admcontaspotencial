/**
 * Executa uma tarefa por item, várias ao mesmo tempo, mas nunca mais que o
 * limite.
 *
 * A importação lia um PDF de cada vez: 7 arquivos × ~15s na IA = quase dois
 * minutos parado. Com limite 4 o mesmo lote sai em torno de 30 segundos.
 *
 * O limite existe porque "todos de uma vez" troca um problema por outro: a
 * API da Anthropic tem teto de requisições por minuto, e estourar ele faz o
 * lote inteiro falhar com 429 — pior que demorar.
 *
 * A ordem do resultado acompanha a ordem da entrada, independente de quem
 * terminar primeiro. Erros sobem pra quem chamou, item a item, pra um
 * arquivo ruim não derrubar os outros.
 */
export async function emParalelo<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  if (itens.length === 0) return [];

  const resultados = new Array<R>(itens.length);
  let proximo = 0;

  // N "trabalhadores" puxando do mesmo balde: assim que um termina, já pega
  // o próximo da fila, em vez de esperar o lote inteiro acabar.
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await tarefa(itens[i], i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, trabalhador),
  );

  return resultados;
}

/**
 * Igual ao emParalelo, mas um item que falha vira `{ erro }` em vez de
 * derrubar todo o lote. Útil na importação, onde um PDF ilegível não pode
 * impedir os outros seis de entrarem.
 */
export async function emParaleloTolerante<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<R>,
): Promise<({ ok: true; valor: R } | { ok: false; erro: any })[]> {
  return emParalelo(itens, limite, async (item, i) => {
    try {
      return { ok: true as const, valor: await tarefa(item, i) };
    } catch (erro) {
      return { ok: false as const, erro };
    }
  });
}
