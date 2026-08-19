/**
 * Lançamento sem documento.
 *
 * Conta que existe e vence, mas cujo boleto não chegou. Quem lança precisa
 * dizer POR QUE está lançando às cegas — é isso que separa "não chegou o
 * boleto, valor conferido no portal" de um lançamento esquecido e zerado.
 */

export type MotivoSemDocumento = {
  valor: string;
  rotulo: string;
};

/**
 * Os motivos que a operação usa. "outro" abre campo livre — os quatro
 * primeiros cobrem o que acontece de fato, e o texto livre existe pra não
 * forçar ninguém a escolher um motivo errado por falta de opção.
 */
export const MOTIVOS_SEM_DOCUMENTO: MotivoSemDocumento[] = [
  { valor: "gerada_sem_boleto", rotulo: "Conta gerada pelo sistema do fornecedor, mas boleto ainda não disponibilizado" },
  { valor: "boleto_nao_recebido", rotulo: "Boleto ainda não recebido" },
  { valor: "indisponivel_portal", rotulo: "Documento indisponível no portal do fornecedor" },
  { valor: "recebida_outro_meio", rotulo: "Conta recebida por outro meio" },
  { valor: "outro", rotulo: "Outro" },
];

/**
 * Texto que fica gravado no lançamento e vai pro Slack. Em "outro", o que
 * a pessoa escreveu; nos demais, o rótulo por extenso — assim quem lê o
 * histórico meses depois entende sem precisar decodificar a chave.
 */
export function textoDoMotivo(valor: string, textoLivre?: string | null): string {
  if (valor === "outro") return (textoLivre ?? "").trim();
  return MOTIVOS_SEM_DOCUMENTO.find((m) => m.valor === valor)?.rotulo ?? valor;
}

/** A regra de segurança: sem motivo, não lança. */
export function motivoValido(valor: string, textoLivre?: string | null): boolean {
  if (!valor) return false;
  return textoDoMotivo(valor, textoLivre).length > 0;
}

export type DadosSemDocumento = {
  loja: string | null;
  tipoConta: string | null;
  instalacao: string | null;
  fornecedor: string | null;
  competencia: string;   // "08/2026"
  vencimento: string;    // "25/08/2026"
  valor: string;         // já formatado, "R$ 1.250,00"
  motivo: string;
  observacao?: string | null;
  lancadoPor: string;
  dataHora: string;      // "19/08/2026 09:42"
};

/**
 * A mensagem do Slack. Fica aqui, e não no componente de tela, porque o
 * texto é o mesmo venha de onde vier o lançamento — e porque assim dá pra
 * conferir o formato sem abrir o navegador.
 */
export function mensagemSemDocumento(d: DadosSemDocumento): string {
  const linhas = [
    "⚠️ *CONTA LANÇADA SEM DOCUMENTO*",
    "",
    `🏢 Loja: ${d.loja ?? "—"}`,
    `🧾 Conta: ${d.tipoConta ?? "—"}`,
    `🔢 Instalação: ${d.instalacao ?? "—"}`,
    `📅 Competência: ${d.competencia}`,
    `📆 Vencimento: ${d.vencimento}`,
    `💰 Valor: ${d.valor}`,
    "",
    `⚠️ Motivo: ${d.motivo}`,
  ];

  if (d.observacao?.trim()) linhas.push(`📝 Observação: ${d.observacao.trim()}`);

  linhas.push(
    "",
    `👤 Lançado por: ${d.lancadoPor}`,
    `🕐 Data/Hora: ${d.dataHora}`,
    "",
    "📎 Documento: Não disponível",
    "",
    "🔔 Ação necessária: Aguardar/disponibilizar o documento para anexação posteriormente.",
  );

  return linhas.join("\n");
}

/** Data e hora no fuso de São Paulo — a Vercel roda em UTC. */
export function agoraBrasil(): string {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).replace(",", "");
}
