"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Único caminho útil pra quem não tem acesso a nenhum módulo: sair.
export default function BotaoSair() {
  const router = useRouter();
  async function sair() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={sair} className="btn-primario">
      Sair
    </button>
  );
}
