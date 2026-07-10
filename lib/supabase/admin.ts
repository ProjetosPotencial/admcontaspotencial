import { createClient } from "@supabase/supabase-js";

// Cliente com a chave de SERVIÇO do Supabase - ignora RLS de propósito,
// porque essa rota roda sozinha (agendada), sem ninguém logado por trás.
// NUNCA importar isso em componente de cliente ("use client") - só em
// rotas de API que rodam no servidor.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(url, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
