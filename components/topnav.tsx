"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatarPeriodo, obterPeriodoAtual } from "@/lib/date-utils";
import { useMenuMobile } from "@/components/app-shell";

export default function TopNav() {
  const [sinoAberto, setSinoAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<number | null>(null);
  const { setAberto } = useMenuMobile();
  const pathname = usePathname();
  const { ano, mes } = obterPeriodoAtual();
  const periodo = formatarPeriodo(mes, ano);

  useEffect(() => {
    // busca depois da tela já ter aparecido - não trava nenhuma navegação
    // esperando isso. Se falhar, só não mostra o número, sem quebrar nada.
    let cancelado = false;
    fetch("/api/alertas-contagem")
      .then((r) => r.json())
      .then((json) => { if (!cancelado) setNotificacoes(json.total ?? 0); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [pathname]);

  return (
    <header className="h-16 bg-white border-b border-linha px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      <button onClick={() => setAberto(true)} className="text-txt-2 hover:text-txt md:hidden shrink-0" aria-label="Abrir menu">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h14M3 10h14M3 14h14" /></svg>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 border border-linha rounded-lg px-2.5 sm:px-3.5 py-2 text-[12px] sm:text-[13px] font-medium text-txt bg-white">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#6c757d" strokeWidth="1.6" className="shrink-0"><rect x="3.5" y="5" width="13" height="12" rx="1.5" /><path d="M3.5 8.5h13M7 3v3.5M13 3v3.5" /></svg>
          <span className="hidden xs:inline">{periodo}</span>
        </div>

        <div className="relative">
          <button onClick={() => setSinoAberto((v) => !v)} className="relative text-txt-2 hover:text-txt w-9 h-9 grid place-items-center rounded-lg hover:bg-off transition">
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 8a5 5 0 0110 0c0 4 1.5 5 1.5 5h-13S5 12 5 8z" /><path d="M8 16a2 2 0 004 0" /></svg>
            {!!notificacoes && notificacoes > 0 && (
              <span className="absolute top-1 right-1 bg-alerr text-white text-[10px] font-bold w-4 h-4 rounded-full grid place-items-center">{notificacoes}</span>
            )}
          </button>
          {sinoAberto && (
            <div className="absolute right-0 top-11 bg-white border border-linha rounded-lg shadow-media w-64 py-3 px-4 z-40">
              {notificacoes == null ? (
                <p className="text-[13px] text-txt-2">Carregando...</p>
              ) : notificacoes > 0 ? (
                <>
                  <p className="text-[13px] text-txt font-medium leading-snug">
                    <b className="text-alerr">{notificacoes}</b> {notificacoes === 1 ? "item precisa" : "itens precisam"} de atenção agora.
                  </p>
                  <p className="text-[11.5px] text-txt-2 mt-1">Contas atrasadas e sem origem mapeada.</p>
                  <Link href="/alertas" onClick={() => setSinoAberto(false)}
                    className="block text-center mt-3 bg-amarelo text-ebano text-[12.5px] font-semibold rounded-md py-2 hover:brightness-95">
                    Ver alertas
                  </Link>
                </>
              ) : (
                <p className="text-[13px] text-txt-2">Nenhum alerta no momento.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
