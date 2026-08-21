import { NextResponse } from "next/server";
import { perfilAtual } from "@/lib/auth-usuario";
import { extrairDadosContrato } from "@/lib/extrair-contrato";

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

/** Contrato é longo; 15 MB cobre com folga um PDF escaneado de 40 páginas. */
const TAMANHO_MAXIMO = 15 * 1024 * 1024;

/**
 * Lê um contrato em PDF e devolve os campos para conferência.
 *
 * NÃO grava nada. A pessoa confere na tela e confirma — leitura por IA erra,
 * e contrato errado no cadastro vira aluguel reajustado errado por anos.
 */
export async function POST(req: Request) {
  const perfil = await perfilAtual();
  if (!perfil) return NextResponse.json({ error: "Você precisa estar logado." }, { status: 401 });
  if (!["admin", "gestor", "operador"].includes(perfil.papel)) {
    return NextResponse.json({ error: "Sem permissão para cadastrar contratos." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie o contrato em PDF." }, { status: 400 });
  }
  if (arquivo.type !== "application/pdf" && !arquivo.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Só PDF por enquanto. Foto do contrato não dá a leitura necessária." }, { status: 415 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: `O arquivo tem ${Math.round(arquivo.size / 1024 / 1024)} MB. O limite é 15 MB.` }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const dados = await extrairDadosContrato(buffer, arquivo.name);
    // o texto cru da IA não vai pro navegador: é grande e não serve pra tela
    const { _raw, ...limpo } = dados;
    return NextResponse.json({ ok: true, nomeArquivo: arquivo.name, dados: limpo });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Não consegui ler o contrato." }, { status: 502 });
  }
}
