import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const erro = req.nextUrl.searchParams.get("error");

  if (erro) {
    return new NextResponse(`Você recusou a autorização (${erro}). Nada foi salvo, pode tentar de novo em /api/google-auth.`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Faltou o parâmetro 'code' na resposta do Google.", { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return new NextResponse("Faltam variáveis de ambiente do OAuth.", { status: 500 });
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      return new NextResponse(
        "O Google não devolveu um refresh_token desta vez. Isso acontece quando essa conta já tinha autorizado este app antes. " +
        "Vai em myaccount.google.com/permissions, remove o acesso deste app, e tenta de novo em /api/google-auth.",
        { status: 400 }
      );
    }

    const html = `<!doctype html><html><body style="font-family:sans-serif;max-width:640px;margin:60px auto;line-height:1.6">
      <h2 style="color:#1a1a1a">Autorização concluída ✅</h2>
      <p>Copie o valor abaixo e cole na variável <b>GOOGLE_OAUTH_REFRESH_TOKEN</b> no Vercel (Settings → Environment Variables), depois faça um redeploy.</p>
      <textarea readonly style="width:100%;height:100px;font-family:monospace;font-size:13px;padding:12px;border:1px solid #ccc;border-radius:8px">${tokens.refresh_token}</textarea>
      <p style="color:#B23B3B;font-size:13px">Depois de copiar e salvar no Vercel, feche esta aba. Esse token não vai aparecer de novo.</p>
    </body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err: any) {
    return new NextResponse(`Erro ao trocar o código pelo token: ${err?.message ?? err}`, { status: 500 });
  }
}
