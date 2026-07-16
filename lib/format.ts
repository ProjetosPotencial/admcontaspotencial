export const money = (v: number | null | undefined) =>
  v == null
    ? "—"
    : "R$ " + Number(v).toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Transforma "MG 058 PE Mococa" em "MG_058_PE_Mococa" - seguro pra usar como
// nome de arquivo ou caminho de pasta (sem acento, sem caractere especial).
// Formata uma data "pura" (tipo date do Postgres, sem hora) sem cair no
// bug clássico de fuso: `new Date("2026-07-16")` o JS interpreta como
// meia-noite em UTC, e ao formatar num navegador no Brasil (3h atrás),
// "volta" pro dia anterior (mostra 15/07 em vez de 16/07). Aqui a data é
// lida pelos pedaços (ano-mes-dia), sem passar pela conversão de fuso.
export function formatarDataSemFuso(dataISO: string | null | undefined): string {
  if (!dataISO) return "—";
  const [ano, mes, dia] = dataISO.split("T")[0].split("-").map(Number);
  if (!ano || !mes || !dia) return "—";
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

export function nomeArquivoSeguro(texto: string): string {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\- ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}
