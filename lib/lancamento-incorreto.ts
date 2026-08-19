/**
 * Lançamento incorreto: conta lançada na empresa ou na loja errada.
 *
 * O texto da notificação mora aqui, e não na tela, porque precisa sair igual
 * venha de onde vier — e porque o ponto dessa mensagem é ser conferível: ela
 * mostra lado a lado ONDE foi lançada e ONDE deveria ter sido, que é
 * exatamente o par que alguém precisa comparar pra confirmar o erro.
 */

export type DadosIncorreto = {
  fornecedor: string | null;
  tipoConta: string | null;
  descricao?: string | null;
  valor: string;          // já formatado
  vencimento: string;     // "25/08/2026"
  competencia: string;    // "08/2026"
  empresaErrada: string | null;
  lojaErrada: string | null;
  empresaCorreta: string | null;
  lojaCorreta: string | null;
  motivo: string;
  usuario: string;
  dataHora: string;
};

export function mensagemLancamentoIncorreto(d: DadosIncorreto): string {
  const linhas = [
    "🚨 *LANÇAMENTO INCORRETO — PRECISA SER CORRIGIDO*",
    "",
    `🧾 Conta: ${d.tipoConta ?? "—"}`,
    `🏭 Fornecedor: ${d.fornecedor ?? "—"}`,
  ];

  if (d.descricao?.trim()) linhas.push(`📄 Descrição: ${d.descricao.trim()}`);

  linhas.push(
    `💰 Valor: ${d.valor}`,
    `📅 Competência: ${d.competencia}`,
    `📆 Vencimento: ${d.vencimento}`,
    "",
    "❌ *Lançado em:*",
    `   Empresa: ${d.empresaErrada ?? "—"}`,
    `   Loja: ${d.lojaErrada ?? "—"}`,
    "",
    "✅ *Deveria ser:*",
    `   Empresa: ${d.empresaCorreta ?? "—"}`,
    `   Loja: ${d.lojaCorreta ?? "—"}`,
    "",
    `⚠️ Motivo: ${d.motivo}`,
    "",
    `👤 Identificado por: ${d.usuario}`,
    `🕐 Data/Hora: ${d.dataHora}`,
    "",
    "🔔 Ação necessária: o lançamento errado foi cancelado e um novo foi criado na loja correta. Confira antes de aprovar.",
  );

  return linhas.join("\n");
}

/** O motivo é obrigatório — é o que separa correção de rasura. */
export function motivoIncorretoValido(texto: string | null | undefined): boolean {
  return !!texto && texto.trim().length >= 3;
}
