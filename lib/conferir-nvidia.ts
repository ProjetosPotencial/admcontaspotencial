// Segunda leitura da nota por um modelo de VISÃO da NVIDIA, para conferir os
// dados que a Anthropic extraiu. É best-effort: qualquer falha aqui NÃO derruba
// a leitura principal — apenas deixa a conferência "não realizada".
//
// A NVIDIA usa endpoint compatível com OpenAI (integrate.api.nvidia.com/v1) e
// modelos de visão aceitam IMAGEM (não PDF). Por isso o chamador precisa passar
// um buffer de imagem (PNG/JPEG) — a conversão de PDF→imagem é feita antes, em
// lib/pdf-para-imagem.ts.

type CamposNota = {
  valor: number | null;
  cnpj: string | null;
  numero_documento: string | null;
  chave_acesso: string | null;
};

export type ResultadoConferencia = {
  conferido: boolean;              // a NVIDIA conseguiu ler e comparar?
  concorda: boolean;               // os campos-chave batem?
  divergencias: string[];          // quais campos divergiram
  lidoNvidia: CamposNota | null;   // o que a NVIDIA leu (para auditoria)
  erro?: string | null;            // motivo, quando a conferência não roda (diagnóstico)
};

const PROMPT_CONFERENCIA = `Você recebe a imagem de um documento financeiro brasileiro (boleto ou nota fiscal). Extraia SOMENTE estes campos e responda APENAS um JSON, sem texto ou markdown:
{"valor": number|null, "cnpj": "somente dígitos do CNPJ do EMITENTE/fornecedor"|null, "numero_documento": "número da NF"|null, "chave_acesso": "44 dígitos da chave de acesso"|null}
Transcreva os números exatamente, dígito a dígito. Use o VALOR TOTAL. null se não achar.`;

async function lerComNvidia(imagemBase64: string, mime: string): Promise<{ campos: CamposNota | null; erro: string | null }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return { campos: null, erro: "NVIDIA_API_KEY não configurada" };
  const model = process.env.NVIDIA_MODEL ?? "meta/llama-3.2-90b-vision-instruct";

  try {
    const resp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT_CONFERENCIA },
            { type: "image_url", image_url: { url: `data:${mime};base64,${imagemBase64}` } },
          ],
        }],
      }),
    });
    if (!resp.ok) {
      const corpo = await resp.text().catch(() => "");
      return { campos: null, erro: `NVIDIA ${resp.status} (modelo "${model}"): ${corpo.slice(0, 300)}` };
    }
    const data = await resp.json();
    const texto: string = data?.choices?.[0]?.message?.content ?? "";
    const limpo = texto.replace(/^```json\s*|\s*```$/g, "").trim();
    const m = limpo.match(/\{[\s\S]*\}/);
    if (!m) return { campos: null, erro: `NVIDIA respondeu sem JSON: ${texto.slice(0, 200)}` };
    const j = JSON.parse(m[0]);
    return {
      campos: {
        valor: j.valor != null ? Number(j.valor) : null,
        cnpj: j.cnpj ? String(j.cnpj).replace(/\D/g, "") : null,
        numero_documento: j.numero_documento ? String(j.numero_documento).trim() : null,
        chave_acesso: j.chave_acesso ? String(j.chave_acesso).replace(/\D/g, "") || null : null,
      },
      erro: null,
    };
  } catch (e: any) {
    return { campos: null, erro: `Falha ao chamar a NVIDIA (modelo "${model}"): ${e?.message ?? "erro"}` };
  }
}

// Compara os campos-chave. Tolerâncias: valor até 1 centavo; textos por igualdade
// de dígitos/trim. Campos ausentes nos dois lados não contam como divergência.
export async function conferirComNvidia(
  imagemBase64: string,
  mime: string,
  anthropic: CamposNota,
): Promise<ResultadoConferencia> {
  const { campos: nvidia, erro } = await lerComNvidia(imagemBase64, mime);
  if (!nvidia) return { conferido: false, concorda: false, divergencias: [], lidoNvidia: null, erro };

  const div: string[] = [];
  const igualNum = (a: number | null, b: number | null) =>
    a == null || b == null ? a == b : Math.abs(a - b) <= 0.01;
  const igualTxt = (a: string | null, b: string | null) =>
    a == null || b == null ? a == b : a === b;

  if (!igualNum(anthropic.valor, nvidia.valor)) div.push("valor");
  if (!igualTxt(anthropic.cnpj, nvidia.cnpj)) div.push("CNPJ");
  if (!igualTxt(anthropic.numero_documento, nvidia.numero_documento)) div.push("número da NF");
  if (anthropic.chave_acesso && nvidia.chave_acesso && anthropic.chave_acesso !== nvidia.chave_acesso) div.push("chave de acesso");

  return { conferido: true, concorda: div.length === 0, divergencias: div, lidoNvidia: nvidia, erro: null };
}
