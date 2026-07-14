import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extrairDadosBoleto } from "@/lib/extrair-boleto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const form = await req.formData();
  const arquivo = form.get("arquivo") as File | null;
  if (!arquivo) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const resultado = await extrairDadosBoleto(buffer, arquivo.name, arquivo.type);
    return NextResponse.json(resultado);
  } catch (err: any) {
    console.error("Erro ao extrair dados do boleto:", err);
    return NextResponse.json({ error: "Não foi possível ler o boleto automaticamente." }, { status: 500 });
  }
}
