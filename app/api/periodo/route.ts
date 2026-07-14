import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { mes, ano } = await req.json();
  const mesNum = Number(mes);
  const anoNum = Number(ano);

  if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12 || !Number.isInteger(anoNum)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  const cookieStore = cookies();
  // um ano de validade - dá pra pessoa fechar e abrir o navegador sem perder a escolha
  const opcoes = { maxAge: 60 * 60 * 24 * 365, path: "/" };
  cookieStore.set("periodo_mes", String(mesNum), opcoes);
  cookieStore.set("periodo_ano", String(anoNum), opcoes);

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete("periodo_mes");
  cookieStore.delete("periodo_ano");
  return NextResponse.json({ ok: true });
}
