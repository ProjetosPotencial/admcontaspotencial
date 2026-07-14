"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MES } from "@/lib/format";
import { useMenuMobile } from "@/components/app-shell";

const ANO_ATUAL_REAL = new Date().getFullYear();
const ANOS_DISPONIVEIS = [ANO_ATUAL_REAL - 1, ANO_ATUAL_REAL, ANO_ATUAL_REAL + 1];

export default function TopNav({ mes, ano, ehPeriodoAtual }: { mes: number; ano: number; ehPeriodoAtual: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sinoAberto, setSinoAberto] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<number | null>(null);
  const [trocando, setTrocando] = useState(false);
  const { setAberto } = useMenuMobile();

  useEffect(() => {
    let cancelado = false;
    fetch("/api/alertas-contagem")
      .then((r) => r.json())
      .then((json) => { if (!cancelado) setNotificacoes(json.total ?? 0); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [pathname]);

  async function escolherPeriodo(novoMes: number, novoAno: number) {
    setTrocando(true);
    await fetch("/api/periodo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes: novoMes, ano: novoAno }),
    });
    setSeletorAberto(false);
    setTrocando(false);
    router.refresh();
  }

  async function voltarParaHoje() {
    setTrocando(true);
    await fetch("/api/periodo", { method: "DELETE" });
    setSeletorAberto(false);
    setTrocando(false);
    router.refresh();
  }

  return (
    <header className="h-16 bg-white border-b border-linha px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      <button onClick={() => setAberto(true)} className="text-txt-2 hover:text-txt md:hidden shrink-0" aria-label="Abrir menu">
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h14M3 10h14M3 14h14" /></svg>
      </button>

      {!ehPeriodoAtual && (
        <div className="hidden md:flex items-center gap-2 bg-amb-bg border border-amarelo/40 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#7a5c00] ml-2">
          Vendo {MES[mes - 1]}/{ano} - não é o mês atual
          <button onClick={voltarParaHoje} disabled={trocando} className="underline hover:no-underline disabled:opacity-50">voltar para hoje</button>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative">
          <button onClick={() => setSeletorAberto((v) => !v)}
            className={`flex items-center gap-1.5 sm:gap-2 border rounded-lg px-2.5 sm:px-3.5 py-2 text-[12px] sm:text-[13px] font-medium bg-white transition ${
              ehPeriodoAtual ? "border-linha text-txt" : "border-amarelo text-[#7a5c00]"
            }`}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke={ehPeriodoAtual ? "#6c757d" : "#B8860B"} strokeWidth="1.6" className="shrink-0"><rect x="3.5" y="5" width="13" height="12" rx="1.5" /><path d="M3.5 8.5h13M7 3v3.5M13 3v3.5" /></svg>
            <span className="hidden xs:inline">{MES[mes - 1]}/{ano}</span>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="opacity-60"><path d="M6 8l4 4 4-4" /></svg>
          </button>

          {seletorAberto && (
            <div className="absolute right-0 top-11 bg-white border border-linha rounded-lg shadow-media w-64 p-3 z-40">
              <div className="grid grid-cols-3 gap-1 mb-2">
                {ANOS_DISPONIVEIS.map((a) => (
                  <button key={a} onClick={() => escolherPeriodo(mes, a)}
                    className={`text-[12px] font-semibold rounded-md py-1.5 ${a === ano ? "bg-amarelo text-ebano" : "text-txt-2 hover:bg-off"}`}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MES.map((nomeMes, i) => (
                  <button key={nomeMes} onClick={() => escolherPeriodo(i + 1, ano)} disabled={trocando}
                    className={`text-[11.5px] font-medium rounded-md py-1.5 disabled:opacity-50 ${
                      i + 1 === mes ? "bg-amarelo text-ebano font-semibold" : "text-txt-2 hover:bg-off"
                    }`}>
                    {nomeMes}
                  </button>
                ))}
              </div>
              {!ehPeriodoAtual && (
                <button onClick={voltarParaHoje} disabled={trocando}
                  className="w-full mt-2.5 pt-2.5 border-t border-linha2 text-[12px] font-semibold text-info hover:underline disabled:opacity-50">
                  Voltar para o mês atual
                </button>
              )}
            </div>
          )}
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
