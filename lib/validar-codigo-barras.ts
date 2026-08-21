/**
 * Valida o dígito verificador de códigos de barra brasileiros.
 *
 * São DOIS padrões diferentes, e confundi-los é o erro clássico:
 *
 * - **Título** (47 dígitos): boleto bancário. Aluguel, custos gerais,
 *   fornecedor. Três blocos de 10 com DV próprio em módulo 10.
 *
 * - **Arrecadação** (48 dígitos, começa com 8): IPTU, condomínio via
 *   convênio, água e energia de concessionária. Quatro blocos de 12, e o DV
 *   geral é calculado sobre o CÓDIGO DE BARRAS de 44 dígitos — não sobre os
 *   48 da linha digitável.
 *
 * Conferir o DV é matemática determinística, bem mais confiável que olhar o
 * tamanho: pega erro de leitura da IA que acertou a quantidade de dígitos
 * mas trocou um número.
 */

function modulo10(digitos: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let produto = parseInt(digitos[i], 10) * peso;
    if (produto > 9) produto = Math.floor(produto / 10) + (produto % 10);
    soma += produto;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/** Módulo 11 de TÍTULO: resto 0, 10 ou 11 vira DV 1. */
function modulo11Titulo(digitos: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += parseInt(digitos[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/**
 * Módulo 11 de ARRECADAÇÃO: resto 0, 10 ou 11 vira DV **0**.
 *
 * Essa diferença de um dígito em relação ao título é o que faz um IPTU
 * legítimo ser recusado quando se usa a função errada.
 */
function modulo11Arrecadacao(digitos: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += parseInt(digitos[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 0 : dv;
}

/** Boleto bancário: três blocos de 10 dígitos, cada um com DV em módulo 10. */
function validarTitulo(digitos: string): boolean {
  const campo1 = digitos.slice(0, 9), dv1 = parseInt(digitos[9], 10);
  const campo2 = digitos.slice(10, 20), dv2 = parseInt(digitos[20], 10);
  const campo3 = digitos.slice(21, 31), dv3 = parseInt(digitos[31], 10);
  return modulo10(campo1) === dv1 && modulo10(campo2) === dv2 && modulo10(campo3) === dv3;
}

/**
 * Arrecadação (IPTU, condomínio, concessionária).
 *
 * A linha digitável são 4 blocos de 12: 11 dígitos + o DV daquele bloco.
 * Tirando os 4 DVs de bloco sobra o código de barras de 44 dígitos, e é
 * sobre ele que o DV geral (posição 4) é calculado.
 *
 * O 3º dígito manda no algoritmo: 6 ou 7 usam módulo 10, 8 ou 9 usam
 * módulo 11.
 */
function validarArrecadacao(linha: string): boolean {
  const blocos = [0, 1, 2, 3].map((i) => linha.slice(i * 12, i * 12 + 12));
  if (blocos.some((b) => b.length !== 12)) return true; // formato estranho: não reprova

  const identificadorValor = linha[2];
  if (!["6", "7", "8", "9"].includes(identificadorValor)) return true;

  const usaModulo10 = identificadorValor === "6" || identificadorValor === "7";
  const calcular = usaModulo10 ? modulo10 : modulo11Arrecadacao;

  // 1) o DV de cada bloco
  for (const bloco of blocos) {
    const corpo = bloco.slice(0, 11);
    const dv = parseInt(bloco[11], 10);
    if (calcular(corpo) !== dv) return false;
  }

  // 2) o DV geral, sobre os 44 dígitos do código de barras
  const barras = blocos.map((b) => b.slice(0, 11)).join("");
  const dvGeral = parseInt(barras[3], 10);
  const semDv = barras.slice(0, 3) + barras.slice(4);
  return calcular(semDv) === dvGeral;
}

/**
 * Confere o dígito verificador.
 *
 * Devolve `false` só quando teve CERTEZA de que o número não fecha. Formato
 * fora do previsto devolve `true` — a regra de tamanho já cobre isso, e
 * reprovar por um caso não mapeado travaria lançamento legítimo.
 */
export function codigoBarrasFechaMatematicamente(codigoComPontuacao: string): boolean {
  const digitos = (codigoComPontuacao ?? "").replace(/\D/g, "");
  try {
    if (digitos.length === 47) return validarTitulo(digitos);
    if (digitos.length === 48) return validarArrecadacao(digitos);
  } catch {
    return true;
  }
  return true;
}

export type TipoCodigo = "titulo" | "arrecadacao" | "desconhecido";

/**
 * Que tipo de documento é esse código.
 *
 * Serve pra tela explicar o que está lendo: IPTU e condomínio quase sempre
 * chegam como arrecadação, e mostrar "boleto bancário" ali confundiria quem
 * confere.
 */
export function tipoDoCodigo(codigoComPontuacao: string): TipoCodigo {
  const d = (codigoComPontuacao ?? "").replace(/\D/g, "");
  if (d.length === 47) return "titulo";
  if (d.length === 48 && d[0] === "8") return "arrecadacao";
  return "desconhecido";
}

/** Segmento da arrecadação — diz de que serviço é a conta. */
const SEGMENTOS: Record<string, string> = {
  "1": "Prefeitura",
  "2": "Saneamento",
  "3": "Energia elétrica ou gás",
  "4": "Telecomunicações",
  "5": "Órgão governamental",
  "6": "Carnê ou convênio",
  "7": "Multas de trânsito",
  "9": "Uso exclusivo do banco",
};

/**
 * O que dá pra dizer sobre o código sem consultar ninguém.
 * Usado pra conferência na tela: "Arrecadação · Prefeitura" num IPTU é a
 * confirmação de que o documento certo foi lido.
 */
export function descreverCodigo(codigoComPontuacao: string): string | null {
  const d = (codigoComPontuacao ?? "").replace(/\D/g, "");
  if (d.length === 47) return "Boleto bancário";
  if (d.length === 48 && d[0] === "8") {
    const seg = SEGMENTOS[d[1]];
    return seg ? `Arrecadação · ${seg}` : "Arrecadação";
  }
  return null;
}
