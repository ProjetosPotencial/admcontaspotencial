"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sincronização em tempo real.
 *
 * Fica montado no layout, então vale para todas as telas. Quando alguém
 * mexe no banco, ele chama router.refresh(): o Next busca os dados do
 * servidor de novo e re-renderiza **sem recarregar a página** — os filtros
 * digitados, o que está aberto e a posição da rolagem continuam como estavam.
 *
 * Se o Realtime não estiver habilitado, um autorrefresh periódico cobre.
 */

const TABELAS = [
  "lancamentos", "contas", "lojas", "fornecedores",
  "empresas", "contratos", "caixa_entrada_boletos",
] as const;

/** agrupa rajadas de mudanças em um único refresh */
const ESPERA_MS = 900;
/** rede de segurança quando o Realtime não está ligado */
const INTERVALO_FALLBACK_MS = 60_000;

const AVISOS: Record<string, string> = {
  lancamentos: "Um lançamento foi atualizado por outro usuário.",
  contas: "Uma conta foi alterada por outro usuário.",
  lojas: "Os dados de lojas foram atualizados.",
  fornecedores: "Os fornecedores foram atualizados.",
  empresas: "As empresas foram atualizadas.",
  contratos: "Os contratos foram atualizados.",
  caixa_entrada_boletos: "Novos boletos chegaram na Caixa de Entrada.",
};

export default function SincronizacaoTempoReal() {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    function agendarRefresh(tabela: string) {
      pendente.current = tabela;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!ativo) return;
        router.refresh();                       // preserva filtros e rolagem
        const t = pendente.current;
        setAviso(t ? (AVISOS[t] ?? "Os dados foram atualizados automaticamente.") : null);
        setTimeout(() => setAviso(null), 4000);
      }, ESPERA_MS);
    }

    const canal = supabase.channel("sync-sistema");
    for (const tabela of TABELAS) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabela },
        () => agendarRefresh(tabela));
    }
    canal.subscribe();

    // rede de segurança: atualiza de tempos em tempos, só com a aba visível
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, INTERVALO_FALLBACK_MS);

    // ao voltar para a aba, sincroniza na hora
    const aoVoltar = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      if (timer.current) clearTimeout(timer.current);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      supabase.removeChannel(canal);
    };
  }, [router]);

  if (!aviso) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <div className="flex items-center gap-2 bg-[#1a1a1a] text-white text-[12.5px] rounded-full pl-3 pr-4 py-2 shadow-forte">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" className="shrink-0">
          <path d="M3 10a7 7 0 0111.9-5M17 10a7 7 0 01-11.9 5" />
          <path d="M15 2v3.5h-3.5M5 18v-3.5h3.5" />
        </svg>
        {aviso}
      </div>
    </div>
  );
}
