import Anthropic from "@anthropic-ai/sdk";

const PROMPT = `Esse arquivo deveria ser um boleto bancário ou fatura de consumo brasileira (água, energia, telefone, IPTU etc). Extraia:
1. "valor": o valor total a pagar, em reais, como número (ex: 118.95). Se não conseguir ler com confiança, use null.
2. "codigo_barras": a linha digitável (o código numérico longo, geralmente com espaços entre grupos de dígitos, tipo "34191.79001 01043.510047 91020.150008 1 96380000011895"). Se não achar, use null.
3. "parece_documento_valido": true se o arquivo realmente parece ser um boleto/fatura de verdade (tem estrutura de banco, valor, vencimento, linha digitável). false se for outra coisa (foto qualquer, documento em branco, print de conversa, arquivo corrompido, ou qualquer coisa que não seja claramente uma fatura).
4. "tipo_conta": que tipo de conta é essa fatura, baseado no fornecedor/serviço. Use exatamente um destes valores: "agua" (companhia de água/saneamento), "energia" (companhia elétrica), "telefone" (telefonia, internet, celular, dados), "iptu" (imposto predial), "condominio", "aluguel", "custo_geral" (qualquer outra coisa que não se encaixe acima). Se não conseguir identificar com confiança, use null.
5. "loja_mencionada": se o documento ou nome do cliente/endereço no boleto mencionar claramente qual loja/unidade é, tente extrair esse texto (ex: nome da rua, cidade, ou identificador). Se não conseguir, use null.

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, nesse formato exato:
{"valor": 118.95, "codigo_barras": "34191.79001 01043.510047 91020.150008 1 96380000011895", "parece_documento_valido": true, "tipo_conta": "agua", "loja_mencionada": null}

Se não for possível ler o documento com confiança, responda {"valor": null, "codigo_barras": null, "parece_documento_valido": false, "tipo_conta": null, "loja_mencionada": null}. Nunca invente número.`;

export type ExtracaoBoleto = {
  valor: number | null;
  codigo_barras: string | null;
  parece_documento_valido: boolean;
  formato_codigo_valido: boolean;
  tipo_conta: string | null;
  loja_mencionada: string | null;
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
    max_tokens: 350,
    messages: [{ role: "user", content: [conteudoArquivo, { type: "text", text: PROMPT }] }] as any,
  });

  const bloco = resposta.content.find((b) => b.type === "text");
  const texto = bloco && "text" in bloco ? bloco.text.trim() : "{}";
  const json = JSON.parse(texto.replace(/^```json\s*|\s*```$/g, ""));

  const codigoBarras: string | null = json.codigo_barras || null;
  const digitos = codigoBarras ? codigoBarras.replace(/\D/g, "") : "";
  const formatoValido = codigoBarras ? (digitos.length === 47 || digitos.length === 48) : true;

  return {
    valor: typeof json.valor === "number" ? json.valor : null,
    codigo_barras: codigoBarras,
    parece_documento_valido: json.parece_documento_valido !== false,
    formato_codigo_valido: formatoValido,
    tipo_conta: json.tipo_conta || null,
    loja_mencionada: json.loja_mencionada || null,
  };
}
