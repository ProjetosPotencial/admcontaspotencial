import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarBoletoParaDrive } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // só usuário logado pode disparar upload pro Drive
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo") as File | null;
    const ano = form.get("ano") as string;
    const mes = form.get("mes") as string;
    const loja = form.get("loja") as string;
    const tipo = form.get("tipo") as string;

    if (!arquivo || !ano || !mes || !loja || !tipo) {
      return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const resultado = await enviarBoletoParaDrive({
      arquivo: buffer,
      nomeArquivo: arquivo.name,
      mimeType: arquivo.type || "application/octet-stream",
      ano: Number(ano),
      mes,
      loja,
      tipo,
    });

    return NextResponse.json(resultado);
  } catch (err: any) {
    console.error("Erro ao enviar para o Drive:", err);
    return NextResponse.json({ error: err?.message ?? "Erro ao enviar para o Google Drive." }, { status: 500 });
  }
}
