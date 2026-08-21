import Anthropic from "@anthropic-ai/sdk";

/**
 * Leitura de contrato de locação por IA.
 *
 * Mesmo caminho do extrair-boleto: o PDF vai inteiro pro modelo, que lê
 * digital e escaneado igual — a visão dele faz o papel do OCR. Por isso aqui
 * não entram PDF.js nem Tesseract: seriam duas dependências para refazer o
 * que o modelo já faz, e mais duas coisas para quebrar.
 *
 * A diferença para o boleto é o tamanho e a linguagem. Boleto tem duas
 * páginas e números em caixinhas; contrato tem trinta páginas de texto
 * jurídico, com o valor do aluguel escrito por extenso e o índice de reajuste
 * escondido no meio de uma cláusula. Daí o modelo mais forte e o teto de
 * saída maior.
 */

const MODELO = process.env.ANTHROPIC_MODEL_CONTRATO ?? "claude-sonnet-5";

const PROMPT = `Você está lendo um CONTRATO DE LOCAÇÃO brasileiro. Extraia os dados abaixo para cadastro em sistema financeiro.

REGRAS QUE VALEM MAIS QUE COMPLETAR CAMPO:
- Se um dado não estiver no contrato, use null. NUNCA deduza, calcule ou invente.
- Valores em reais como número (1234.56). Quando o contrato escrever por extenso E em algarismos, confie nos algarismos, mas se os dois divergirem, registre isso em "divergencias".
- Datas no formato "AAAA-MM-DD".
- CPF/CNPJ só dígitos.
- LOCADOR é quem recebe o aluguel (dono do imóvel). LOCATÁRIO é quem paga — quase sempre uma empresa do Grupo Potencial. Não troque os dois.

REAJUSTE — é a cláusula mais importante para este sistema:
- "indice_reajuste": um de "ipca", "igpm", "inpc", "fixo" ou null.
- "percentual_fixo": só quando o contrato define um percentual fixo, não atrelado a índice.
- "periodicidade_meses": de quantos em quantos meses reajusta. Anual = 12.
- Se a cláusula citar mais de um índice (ex: "IGP-M ou, na sua falta, IPCA"), use o PRIMEIRO e explique em "observacoes_reajuste".

Responda SOMENTE com JSON válido, sem texto antes ou depois:
{
  "numero_contrato": "CT-2026-045" ou null,
  "tipo": "aluguel",
  "locador": "nome ou razão social",
  "locador_documento": "12345678000199",
  "locatario": "razão social",
  "locatario_documento": "08191494000140",
  "endereco_imovel": "rua, número, bairro, cidade/UF",
  "loja_mencionada": "código ou nome da loja, se o contrato citar",
  "data_inicio": "2026-01-01",
  "data_fim": "2030-12-31",
  "prazo_meses": 60,
  "dia_vencimento": 10,
  "valor_aluguel": 8000.00,
  "valor_condominio": 450.00,
  "valor_iptu": 180.00,
  "multa_percentual": 10,
  "juros_mensais_percentual": 1,
  "garantia_tipo": "caucao" | "fianca" | "seguro_fianca" | "sem_garantia" | null,
  "garantia_valor": 24000.00,
  "indice_reajuste": "igpm",
  "percentual_fixo": null,
  "periodicidade_meses": 12,
  "observacoes_reajuste": "texto curto da cláusula, se houver algo fora do padrão",
  "campos_nao_encontrados": ["valor_iptu", "..."],
  "divergencias": ["valor por extenso diz oito mil e quinhentos, algarismos dizem 8.000,00"],
  "parece_contrato_locacao": true
}

Em "campos_nao_encontrados", liste as chaves que ficaram null por não estarem no documento — é o que a pessoa vai precisar preencher à mão.
Em "divergencias", liste inconsistências reais que você notou. Lista vazia se não houver.
Se o arquivo não for um contrato de locação, devolva "parece_contrato_locacao": false e o resto null.`;

export type ExtracaoContrato = {
  numero_contrato: string | null;
  tipo: string | null;
  locador: string | null;
  locador_documento: string | null;
  locatario: string | null;
  locatario_documento: string | null;
  endereco_imovel: string | null;
  loja_mencionada: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  prazo_meses: number | null;
  dia_vencimento: number | null;
  valor_aluguel: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  multa_percentual: number | null;
  juros_mensais_percentual: number | null;
  garantia_tipo: string | null;
  garantia_valor: number | null;
  indice_reajuste: "ipca" | "igpm" | "inpc" | "fixo" | null;
  percentual_fixo: number | null;
  periodicidade_meses: number | null;
  observacoes_reajuste: string | null;
  campos_nao_encontrados: string[];
  divergencias: string[];
  parece_contrato_locacao: boolean;
  /** avisos que o SISTEMA deduz depois de ler, não a IA */
  alertas: string[];
  _raw?: string;
};

export async function extrairDadosContrato(buffer: Buffer, nomeArquivo: string): Promise<ExtracaoContrato> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const anthropic = new Anthropic({ apiKey });

  let resposta;
  try {
    resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
          { type: "text", text: PROMPT },
        ],
      }] as any,
    });
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    const msg = e?.error?.error?.message ?? e?.message ?? "erro desconhecido";
    throw new Error(`Anthropic falhou${status ? ` (HTTP ${status})` : ""}: ${msg}`);
  }

  const bloco = resposta.content.find((b) => b.type === "text");
  const texto = bloco && "text" in bloco ? bloco.text.trim() : "{}";
  const limpo = texto.replace(/^```json\s*|\s*```$/g, "");

  let j: any;
  try {
    j = JSON.parse(limpo);
  } catch {
    const m = limpo.match(/\{[\s\S]*\}/);
    try { j = m ? JSON.parse(m[0]) : {}; } catch { j = {}; }
  }

  const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const txt = (v: any) => (v ? String(v).trim() : null);
  const doc = (v: any) => (v ? String(v).replace(/\D/g, "") || null : null);

  const dados: ExtracaoContrato = {
    numero_contrato: txt(j.numero_contrato),
    tipo: txt(j.tipo) ?? "aluguel",
    locador: txt(j.locador),
    locador_documento: doc(j.locador_documento),
    locatario: txt(j.locatario),
    locatario_documento: doc(j.locatario_documento),
    endereco_imovel: txt(j.endereco_imovel),
    loja_mencionada: txt(j.loja_mencionada),
    data_inicio: txt(j.data_inicio),
    data_fim: txt(j.data_fim),
    prazo_meses: num(j.prazo_meses),
    dia_vencimento: num(j.dia_vencimento),
    valor_aluguel: num(j.valor_aluguel),
    valor_condominio: num(j.valor_condominio),
    valor_iptu: num(j.valor_iptu),
    multa_percentual: num(j.multa_percentual),
    juros_mensais_percentual: num(j.juros_mensais_percentual),
    garantia_tipo: txt(j.garantia_tipo),
    garantia_valor: num(j.garantia_valor),
    indice_reajuste: ["ipca", "igpm", "inpc", "fixo"].includes(j.indice_reajuste) ? j.indice_reajuste : null,
    percentual_fixo: num(j.percentual_fixo),
    periodicidade_meses: num(j.periodicidade_meses),
    observacoes_reajuste: txt(j.observacoes_reajuste),
    campos_nao_encontrados: Array.isArray(j.campos_nao_encontrados) ? j.campos_nao_encontrados : [],
    divergencias: Array.isArray(j.divergencias) ? j.divergencias : [],
    parece_contrato_locacao: j.parece_contrato_locacao !== false,
    alertas: [],
    _raw: texto,
  };

  dados.alertas = validar(dados, nomeArquivo);
  return dados;
}

/**
 * O que o SISTEMA percebe depois da leitura.
 *
 * Separado do que a IA responde de propósito: são conclusões que dependem da
 * data de hoje e das regras da operação, não do texto do contrato. Deixar
 * isso a cargo do modelo daria resposta diferente a cada releitura do mesmo
 * arquivo.
 */
function validar(d: ExtracaoContrato, nomeArquivo: string): string[] {
  const alertas: string[] = [];

  if (!d.parece_contrato_locacao) {
    return [`"${nomeArquivo}" não parece um contrato de locação. Confira o arquivo antes de cadastrar.`];
  }

  const hoje = new Date().toISOString().slice(0, 10);

  if (d.data_fim) {
    if (d.data_fim < hoje) {
      alertas.push(`Contrato vencido em ${d.data_fim.split("-").reverse().join("/")}. Confirme se houve renovação.`);
    } else {
      const dias = Math.round((Date.parse(d.data_fim) - Date.parse(hoje)) / 86400000);
      if (dias <= 90) alertas.push(`Vence em ${dias} dias — já entra na faixa de alerta de renovação.`);
    }
  }

  if (d.data_inicio && d.data_fim && d.data_fim < d.data_inicio) {
    alertas.push("A data de término é anterior à de início. Um dos dois foi lido errado.");
  }

  if (!d.indice_reajuste) {
    alertas.push("Não identifiquei o índice de reajuste. Sem ele o reajuste automático não roda — escolha na mão.");
  }
  if (d.indice_reajuste === "fixo" && d.percentual_fixo == null) {
    alertas.push("O contrato prevê percentual fixo, mas o valor não foi encontrado.");
  }
  if (d.valor_aluguel == null) {
    alertas.push("Valor do aluguel não encontrado — é o campo que o reajuste usa como base.");
  }
  if (d.dia_vencimento != null && (d.dia_vencimento < 1 || d.dia_vencimento > 31)) {
    alertas.push(`Dia de vencimento lido como ${d.dia_vencimento}, o que não é um dia válido.`);
  }

  // prazo declarado versus prazo real das datas: divergência aqui costuma ser
  // aditivo de renovação lido junto do contrato original
  if (d.prazo_meses && d.data_inicio && d.data_fim) {
    const meses = Math.round(
      (Date.parse(d.data_fim) - Date.parse(d.data_inicio)) / (30.44 * 86400000),
    );
    if (Math.abs(meses - d.prazo_meses) > 2) {
      alertas.push(`O contrato diz ${d.prazo_meses} meses, mas as datas somam ~${meses}. Pode haver aditivo no mesmo PDF.`);
    }
  }

  for (const div of d.divergencias) alertas.push(div);

  return alertas;
}
