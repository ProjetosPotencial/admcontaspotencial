// Converte a 1ª página de um PDF em PNG, para modelos de visão (NVIDIA) que só
// aceitam imagem. Usa pdfjs-dist (JS puro) + @napi-rs/canvas (prebuilt, roda em
// serverless). Retorna o erro real quando falha, para diagnóstico.
//
// Requer (adicionar ao package.json):
//   npm i pdfjs-dist@4 @napi-rs/canvas

export async function pdfPrimeiraPaginaPng(pdf: Buffer): Promise<{ png: Buffer | null; erro: string | null }> {
  try {
    const pdfjsMod = "pdfjs-dist/legacy/build/pdf.mjs";
    const canvasMod = "@napi-rs/canvas";
    const pdfjs: any = await import(/* webpackIgnore: true */ pdfjsMod);
    const { createCanvas }: any = await import(/* webpackIgnore: true */ canvasMod);

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdf),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;
    return { png: canvas.toBuffer("image/png"), erro: null };
  } catch (e: any) {
    return { png: null, erro: e?.message ?? String(e) };
  }
}
