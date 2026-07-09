export const money = (v: number | null | undefined) =>
  v == null
    ? "—"
    : "R$ " + Number(v).toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Transforma "MG 058 PE Mococa" em "MG_058_PE_Mococa" - seguro pra usar como
// nome de arquivo ou caminho de pasta (sem acento, sem caractere especial).
export function nomeArquivoSeguro(texto: string): string {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\- ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}
