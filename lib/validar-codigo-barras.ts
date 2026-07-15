/**
 * Valida o dígito verificador do código de barras/linha digitável de
 * boletos brasileiros. Isso é matemática determinística (módulo 10 ou 11
 * dependendo do tipo), bem mais confiável que só conferir o tamanho -
 * pega erro de leitura que a IA cometeu mesmo tendo acertado a
 * quantidade de dígitos.
 *
 * Cobre os dois formatos mais comuns:
 * - 47 dígitos: boleto bancário tradicional (aluguel, custos gerais...)
 * - 48 dígitos: conta de consumo/convênio (água, energia, telefone...)
 *   que é o formato mais comum no nosso caso de uso.
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

function modulo11(digitos: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += parseInt(digitos[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

function validarBoletoBancario(digitos: string): boolean {
  // 47 dígitos: três blocos de 10 dígitos com DV próprio (módulo 10), mais
  // o DV geral do código de barras que fica separado (não conferimos esse
  // aqui pela linha digitável sozinha, os três blocos já dão um bom sinal).
  const campo1 = digitos.slice(0, 9), dv1 = parseInt(digitos[9], 10);
  const campo2 = digitos.slice(10, 20), dv2 = parseInt(digitos[20], 10);
  const campo3 = digitos.slice(21, 31), dv3 = parseInt(digitos[31], 10);
  return modulo10(campo1) === dv1 && modulo10(campo2) === dv2 && modulo10(campo3) === dv3;
}

function validarContaConsumo(digitos: string): boolean {
  // 48 dígitos: o terceiro dígito diz qual módulo usar pro DV geral
  // (posição 4) - 6 ou 7 usa módulo 10, 8 ou 9 usa módulo 11.
  const terceiroDigito = digitos[2];
  const dvInformado = parseInt(digitos[3], 10);
  const restante = digitos.slice(0, 3) + digitos.slice(4);
  const usaModulo10 = terceiroDigito === "6" || terceiroDigito === "7";
  const dvCalculado = usaModulo10 ? modulo10(restante) : modulo11(restante);
  return dvCalculado === dvInformado;
}

/**
 * Confere o dígito verificador. Devolve true se bateu (ou se não deu pra
 * calcular, pra não travar por um caso não previsto), false só quando
 * teve certeza de que o número não fecha matematicamente.
 */
export function codigoBarrasFechaMatematicamente(codigoComPontuacao: string): boolean {
  const digitos = codigoComPontuacao.replace(/\D/g, "");
  try {
    if (digitos.length === 47) return validarBoletoBancario(digitos);
    if (digitos.length === 48) return validarContaConsumo(digitos);
  } catch {
    return true; // não trava por erro de cálculo inesperado
  }
  return true; // tamanho diferente já é pego por outra regra
}
