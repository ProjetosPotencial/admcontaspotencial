/**
 * Lê o nome do arquivo do boleto e deduz tipo, loja e competência.
 *
 * Quem sobe os boletos nomeia de forma bem previsível:
 *   "ÁGUA SANTA LUZIA 01 2026.pdf"      -> água · Santa Luzia · jan/2026
 *   "INTERNET JUCESP 07 2026.pdf"       -> telefone · Jucesp · jul/2026
 *   "ENERGIA MG 075 CAMPO BELO.pdf"     -> energia · MG 075
 *   "IPTU_MS-046_ASA-BRANCA_2026.pdf"   -> iptu · MS 046
 *
 * A ideia é chegar com tudo pré-preenchido e sobrar só conferir.
 */

export type LeituraNome = {
  tipo: string | null;
  ano: number | null;
  mes: number | null;
  /** o que sobrou depois de tirar tipo e datas — serve pra casar a loja */
  textoLoja: string;
  confiancaTipo: "alta" | "baixa";
};

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** palavras que aparecem no nome do arquivo e indicam o tipo de conta */
const PISTAS_TIPO: [string, string[]][] = [
  ["agua",        ["agua", "saneamento", "copasa", "sabesp", "sanesul", "caesb", "cagece", "embasa", "saerp", "brk", "aegea", "corsan", "sanepar", "casan", "compesa", "deso", "caema", "cosanpa", "caer"]],
  ["energia",     ["energia", "luz", "eletric", "cemig", "cpfl", "enel", "light", "equatorial", "neoenergia", "celesc", "copel", "coelba", "elektro", "energisa", "rge", "cee"]],
  ["telefone",    ["telefone", "telefonia", "internet", "fibra", "link", "banda larga", "vivo", "claro", "tim", "oi", "net", "algar", "sercomtel", "embratel", "nextfibra", "desktop"]],
  ["iptu",        ["iptu", "predial", "territorial"]],
  ["aluguel",     ["aluguel", "locacao", "imobiliaria", "arrendamento"]],
  ["condominio",  ["condominio", "condominial"]],
  ["custo_geral", ["custo", "diversos", "geral", "manutencao", "servico"]],
];

/** meses escritos por extenso ou abreviados */
const MESES_TXT: [string[], number][] = [
  [["jan", "janeiro"], 1], [["fev", "fevereiro"], 2], [["mar", "marco", "março"], 3],
  [["abr", "abril"], 4], [["mai", "maio"], 5], [["jun", "junho"], 6],
  [["jul", "julho"], 7], [["ago", "agosto"], 8], [["set", "setembro"], 9],
  [["out", "outubro"], 10], [["nov", "novembro"], 11], [["dez", "dezembro"], 12],
];

export function lerNomeArquivo(nomeArquivo: string, anoPadrao = new Date().getFullYear()): LeituraNome {
  const semExt = nomeArquivo.replace(/\.[a-z0-9]{2,5}$/i, "");
  const n = normalizar(semExt);
  const palavras = n.split(" ");

  // ---- tipo ----
  let tipo: string | null = null;
  let confiancaTipo: "alta" | "baixa" = "baixa";
  // compara PALAVRA INTEIRA: senão "Santa Luzia" casaria com "luz" (energia)
  // e "Paranaguá" com "net" (telefone).
  const casaPista = (pista: string) =>
    pista.includes(" ") ? n.includes(pista) : palavras.includes(pista);
  for (const [chave, pistas] of PISTAS_TIPO) {
    if (pistas.some(casaPista)) { tipo = chave; confiancaTipo = "alta"; break; }
  }

  // ---- ano ----
  let ano: number | null = null;
  const mAno = n.match(/\b(20\d{2})\b/);
  if (mAno) ano = Number(mAno[1]);

  // ---- mês ----
  let mes: number | null = null;
  // por extenso
  for (const [nomes, num] of MESES_TXT) {
    if (palavras.some((p) => nomes.includes(p))) { mes = num; break; }
  }
  // "07 2026" / "07-2026" / "07/2026"
  if (mes === null) {
    const mMesAno = n.match(/\b(0?[1-9]|1[0-2])\s+(20\d{2})\b/);
    if (mMesAno) mes = Number(mMesAno[1]);
  }
  // "2026 07"
  if (mes === null) {
    const mAnoMes = n.match(/\b(20\d{2})\s+(0?[1-9]|1[0-2])\b/);
    if (mAnoMes) mes = Number(mAnoMes[2]);
  }
  // número de 1 ou 2 dígitos isolado (ex.: "ÁGUA SANTA LUZIA 01 2026")
  if (mes === null) {
    const cand = palavras.find((p) => /^(0[1-9]|1[0-2])$/.test(p));
    if (cand) mes = Number(cand);
  }
  if (mes !== null && ano === null) ano = anoPadrao;

  // ---- texto que sobra: serve pra casar a loja ----
  const pistasTipo = PISTAS_TIPO.flatMap(([, p]) => p);
  const mesesTodos = MESES_TXT.flatMap(([nomes]) => nomes);
  const textoLoja = palavras
    .filter((p) => !pistasTipo.includes(p))
    .filter((p) => !mesesTodos.includes(p))
    .filter((p) => !/^20\d{2}$/.test(p))
    .filter((p) => !/^(0[1-9]|1[0-2])$/.test(p))
    .filter((p) => !["boleto", "fatura", "conta", "nf", "nfe", "pdf", "copia", "via", "2via"].includes(p))
    .join(" ")
    .trim();

  return { tipo, ano, mes, textoLoja, confiancaTipo };
}

export type LojaBusca = { id: string; codigo: string; nome?: string | null; cidade?: string | null };

/**
 * Casa o texto do nome do arquivo com a loja certa.
 * Tenta, nesta ordem: código exato → nome cadastrado → cidade.
 */
export function casarLoja(textoLoja: string, lojas: LojaBusca[]) {
  const alvo = normalizar(textoLoja);
  if (!alvo) return null;

  const cands = lojas.map((l) => ({
    loja: l,
    codigo: normalizar(l.codigo),
    nome: normalizar(l.nome ?? ""),
    cidade: normalizar(l.cidade ?? ""),
  }));

  // 1) código completo no texto ("mg 075")
  let achou = cands.find((c) => c.codigo && alvo.includes(c.codigo));
  if (achou) return { loja: achou.loja, confianca: "alta" as const, por: "código" };

  // 2) nome cadastrado da loja
  achou = cands.find((c) => c.nome.length >= 4 && alvo.includes(c.nome));
  if (achou) return { loja: achou.loja, confianca: "alta" as const, por: "nome" };

  // 3) nome da loja contido no texto por partes ("santa luzia" em "pe santa luzia")
  const palavrasAlvo = alvo.split(" ").filter((p) => p.length >= 3);
  achou = cands.find((c) => {
    const pn = c.nome.split(" ").filter((p) => p.length >= 3);
    if (pn.length < 2) return false;
    return pn.every((p) => palavrasAlvo.includes(p));
  });
  if (achou) return { loja: achou.loja, confianca: "media" as const, por: "nome" };

  // 4) cidade — só se for única, senão é ambíguo
  const porCidade = cands.filter((c) => c.cidade.length >= 4 && alvo.includes(c.cidade));
  if (porCidade.length === 1) return { loja: porCidade[0].loja, confianca: "media" as const, por: "cidade" };

  return null;
}
