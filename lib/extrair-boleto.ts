import Anthropic from "@anthropic-ai/sdk";
import { codigoBarrasFechaMatematicamente } from "@/lib/validar-codigo-barras";

const PROMPT = `Esse arquivo é um documento financeiro brasileiro que pode ser (a) um BOLETO/FATURA DE CONSUMO (água, energia, telefone, IPTU, condomínio) ou (b) uma NOTA FISCAL (NF-e de produto ou NFS-e de serviço: honorários, softwares, serviços prestados, materiais). Primeiro identifique qual é, depois extraia os campos.

PRECISÃO (muito importante): leia o documento com atenção e transcreva números EXATAMENTE, dígito a dígito, sem arredondar nem inventar. Para valores, use o VALOR TOTAL da nota/fatura (não subtotais, não retenções). Se um campo específico estiver ilegível ou ausente, use null — nunca chute. Confira CNPJs e a chave de acesso caractere a caractere.

1. "classe_documento": "boleto" se for boleto bancário ou fatura de consumo com linha digitável; "nota_fiscal" se for nota fiscal (tem número da NF, emitente com CNPJ, discriminação de produto/serviço); null se não der pra dizer.
2. "valor": o valor total a pagar/da nota, em reais, como número (ex: 118.95). null se não ler com confiança.
3. "fornecedor": a razão social de QUEM EMITIU a nota — o EMITENTE / PRESTADOR DE SERVIÇOS. Em NFS-e aparece como "EMITENTE DA NFS-e" ou "PRESTADOR DE SERVIÇOS". É o lado que NÃO é a empresa do Grupo Potencial. Ex: "MESSANO ADVOGADOS", "TATI DOS CARTUCHOS LTDA", "SANEPAR". null se não achar.
4. "cnpj": o CNPJ do emitente, só dígitos (ex: "08191494000140"). null se não achar. (Boletos de consumo geralmente não têm; NF sempre tem.)
5. "codigo_barras": a linha digitável de PAGAMENTO (boleto), quando existir — inclusive numa nota fiscal que vem com boleto anexo. É o número longo tipo "34191.79001 01043.510047 ...". NÃO confunda com a chave de acesso da NF-e (44 dígitos, que serve pra validar a nota, não pra pagar): se só houver a chave de acesso e nenhuma linha digitável de boleto, use null. Sem linha digitável, use null.
6. "numero_documento": o número da nota (só para nota fiscal). Em NFS-e é o "Número da NFS-e" / "Número da Nota" (ex: 82, 00002479). null para boleto.
7. "data": a data de referência como {"dia":D,"mes":M,"ano":A}. Para BOLETO use o VENCIMENTO; para NOTA FISCAL use a DATA DE EMISSÃO. Use null se não ler.
8. "tipo_conta": categoria, um destes: "agua","energia","telefone","iptu","condominio","aluguel","imposto" (ISS/ISSQN/IRRF e tributos), "custo_geral" (serviços, honorários, software, materiais e qualquer outro). null se incerto.
9. "loja_mencionada": se o documento citar claramente uma loja/unidade/endereço, extraia esse texto. null se não. (NF de custo de empresa normalmente não cita loja.)
10. "parece_documento_valido": true se for de fato um boleto/fatura OU uma nota fiscal de verdade. false se for foto qualquer, documento em branco, print de conversa ou arquivo ilegível.
11. "destinatario": a razão social de QUEM RECEBEU/COMPROU (o cliente da nota), quase sempre uma empresa do Grupo Potencial (nome com "POTENCIAL", ex: "POTENCIAL LOTERIAS LTDA"). ONDE ENCONTRAR: em NF-e de PRODUTO/mercadoria (DANFE) fica no quadro "DESTINATÁRIO / REMETENTE" — o 2º bloco de partes, logo abaixo do EMITENTE; em NFS-e de SERVIÇO fica em "TOMADOR DO SERVIÇO", "TOMADOR DE SERVIÇOS" ou "DADOS DO TOMADOR". REGRA PRÁTICA: toda nota fiscal tem DOIS lados com CNPJ — o EMITENTE (quem vendeu = "fornecedor") e o DESTINATÁRIO/TOMADOR (quem comprou). Se houver dois lados com CNPJ, preencha SEMPRE os dois — inclusive quando você tiver classificado o documento como boleto/cupom. O lado "POTENCIAL ..." é o destinatário; o outro é o fornecedor. Nunca troque os dois. null só se realmente não existir um segundo lado.
12. "destinatario_cnpj": o CNPJ do destinatário — aquele que aparece junto do nome do comprador (a empresa "POTENCIAL ..."), só dígitos (ex: "08191494005533"). Preencha sempre que houver um segundo lado com CNPJ. null só se não achar.
13. "chave_acesso": a CHAVE DE ACESSO da nota fiscal eletrônica — 44 dígitos, aparece rotulada como "Chave de Acesso" (geralmente no topo da DANFE/DANFSe, perto do código QR). Transcreva só os dígitos, exatamente. null se não houver ou for boleto.

Responda SOMENTE com JSON válido, sem texto antes/depois, nesse formato:
{"classe_documento":"nota_fiscal","valor":1877.00,"fornecedor":"MESSANO ADVOGADOS","cnpj":"12345678000199","codigo_barras":null,"numero_documento":"4521","data":{"dia":7,"mes":7,"ano":2026},"tipo_conta":"custo_geral","loja_mencionada":null,"parece_documento_valido":true,"destinatario":"POTENCIAL LOTERIAS LTDA","destinatario_cnpj":"08191494000140","chave_acesso":"35150612345678000199550010000004521123456789"}

Se não for possível ler com confiança: {"classe_documento":null,"valor":null,"fornecedor":null,"cnpj":null,"codigo_barras":null,"numero_documento":null,"data":null,"tipo_conta":null,"loja_mencionada":null,"parece_documento_valido":false,"destinatario":null,"destinatario_cnpj":null,"chave_acesso":null}. Nunca invente número.`;

export type ExtracaoBoleto = {
  classe_documento: "boleto" | "nota_fiscal" | null;
  valor: number | null;
  fornecedor: string | null;
  cnpj: string | null;
  codigo_barras: string | null;
  numero_documento: string | null;
  parece_documento_valido: boolean;
  formato_codigo_valido: boolean;
  codigo_barras_fecha_matematicamente: boolean;
  tipo_conta: string | null;
  loja_mencionada: string | null;
  destinatario: string | null;
  destinatario_cnpj: string | null;
  chave_acesso: string | null;
  dia_vencimento: number | null;
  data_emissao: { dia: number; mes: number; ano: number } | null;
};

export async function extrairDadosBoleto(buffer: Buffer, nomeArquivo: string, mimeType: string): Promise<ExtracaoBoleto> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const base64 = buffer.toString("base64");
  const isPdf = mimeType === "application/pdf" || nomeArquivo.toLowerCase().endsWith(".pdf");

  const conteudoArquivo = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: (mimeType || "image/jpeg") as any, data: base64 } };

  const anthropic = new Anthropic({ apiKey });
  const resposta = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 700,
    messages: [{ role: "user", content: [conteudoArquivo, { type: "text", text: PROMPT }] }] as any,
  });

  const bloco = resposta.content.find((b) => b.type === "text");
  const texto = bloco && "text" in bloco ? bloco.text.trim() : "{}";
  const limpo = texto.replace(/^```json\s*|\s*```$/g, "");
  let json: any;
  try {
    json = JSON.parse(limpo);
  } catch {
    // Resposta cortada/estranha: não derruba a leitura. Tenta pegar o
    // primeiro objeto JSON completo; se não der, devolve documento inválido
    // (o chamado ainda vira card, marcado como ilegível).
    const m = limpo.match(/\{[\s\S]*\}/);
    try { json = m ? JSON.parse(m[0]) : {}; } catch { json = {}; }
    if (typeof json.parece_documento_valido !== "boolean") json.parece_documento_valido = false;
  }

  const classe: "boleto" | "nota_fiscal" | null =
    json.classe_documento === "boleto" || json.classe_documento === "nota_fiscal" ? json.classe_documento : null;

  // Boleto exige linha digitável; NF pode ou não ter boleto anexo — se tiver,
  // capturamos a linha digitável do mesmo jeito. Nunca reprova a NF por isso.
  const codigoBarras: string | null = json.codigo_barras || null;
  const digitos = codigoBarras ? codigoBarras.replace(/\D/g, "") : "";
  const formatoValido = codigoBarras ? (digitos.length === 47 || digitos.length === 48) : true;
  const fechaMatematicamente = codigoBarras ? codigoBarrasFechaMatematicamente(codigoBarras) : true;

  // O campo "data" é vencimento no boleto e emissão na NF.
  const d = json.data && typeof json.data === "object" ? json.data : null;
  const dataValida = d && [d.dia, d.mes, d.ano].every((n: any) => typeof n === "number");
  const diaVencimento = classe !== "nota_fiscal"
    ? (typeof d?.dia === "number" ? d.dia : null)
    : null;
  const dataEmissao = classe === "nota_fiscal" && dataValida
    ? { dia: d.dia, mes: d.mes, ano: d.ano }
    : null;

  return {
    classe_documento: classe,
    valor: typeof json.valor === "number" ? json.valor : null,
    fornecedor: json.fornecedor ? String(json.fornecedor).trim() : null,
    cnpj: json.cnpj ? String(json.cnpj).replace(/\D/g, "") || null : null,
    codigo_barras: codigoBarras,
    numero_documento: json.numero_documento ? String(json.numero_documento).trim() : null,
    parece_documento_valido: json.parece_documento_valido !== false,
    formato_codigo_valido: formatoValido,
    codigo_barras_fecha_matematicamente: fechaMatematicamente,
    tipo_conta: json.tipo_conta || null,
    loja_mencionada: json.loja_mencionada || null,
    destinatario: json.destinatario ? String(json.destinatario).trim() : null,
    destinatario_cnpj: json.destinatario_cnpj ? String(json.destinatario_cnpj).replace(/\D/g, "") : null,
    chave_acesso: json.chave_acesso ? String(json.chave_acesso).replace(/\D/g, "") || null : null,
    dia_vencimento: diaVencimento,
    data_emissao: dataEmissao,
  };
}
