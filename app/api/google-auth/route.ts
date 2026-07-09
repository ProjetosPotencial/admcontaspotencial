import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Só admin pode disparar essa autorização — ela concede acesso de verdade
// à conta Google dona da pasta, então não é algo pra deixar solto.
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return new NextResponse("Você precisa estar logado no sistema.", { status: 401 });
  }
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", session.user.id).single();
  if (perfil?.papel !== "admin") {
    return new NextResponse("Só administradores podem autorizar a integração com o Google Drive.", { status: 403 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return new NextResponse(
      "Faltam as variáveis GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET ou GOOGLE_OAUTH_REDIRECT_URI no ambiente.",
      { status: 500 }
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = client.generateAuthUrl({
    access_type: "offline",  // sem isso o Google não devolve o refresh_token
    prompt: "consent",       // força mostrar a tela de consentimento sempre, garante refresh_token novo
    scope: ["https://www.googleapis.com/auth/drive"],
  });

  return NextResponse.redirect(url);
}
