"use client";

import { useEffect, useState } from "react";

/**
 * Tela de abertura do app (PWA).
 *
 * Aparece enquanto o sistema se prepara e sai sozinha quando termina.
 * Fica só na sessão: depois que o app já abriu uma vez, navegar entre
 * telas não mostra a splash de novo.
 */

const MENSAGENS = [
  "🔄 Preparando seu ambiente...",
  "🔐 Validando acesso...",
  "📊 Carregando seus dados...",
  "🤖 Inicializando o Assistente de IA...",
  "📬 Sincronizando notificações...",
  "☁️ Verificando atualizações...",
];
const FINAL = "✅ Tudo pronto! Bem-vindo(a).";

const DURACAO_MINIMA_MS = 2600;   // mesmo em conexão rápida, respira
const TROCA_MENSAGEM_MS = 620;
const VERSAO = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

export default function SplashScreen() {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [idx, setIdx] = useState(0);
  const [pronto, setPronto] = useState(false);
  const [progresso, setProgresso] = useState(8);

  // decide, uma única vez, se essa abertura merece splash
  useEffect(() => {
    if (typeof window === "undefined") return;
    const jaAbriu = sessionStorage.getItem("splash_ok");
    if (jaAbriu) return;
    sessionStorage.setItem("splash_ok", "1");
    setVisivel(true);

    const inicio = Date.now();

    const tMsg = setInterval(() => {
      setIdx((i) => (i + 1 < MENSAGENS.length ? i + 1 : i));
    }, TROCA_MENSAGEM_MS);

    const tProg = setInterval(() => {
      setProgresso((p) => (p < 92 ? p + Math.max(1, (95 - p) / 12) : p));
    }, 90);

    function finalizar() {
      const falta = Math.max(0, DURACAO_MINIMA_MS - (Date.now() - inicio));
      setTimeout(() => {
        clearInterval(tMsg);
        clearInterval(tProg);
        setProgresso(100);
        setPronto(true);
        setTimeout(() => setSaindo(true), 420);      // mostra "Tudo pronto!"
        setTimeout(() => setVisivel(false), 900);    // fade e sai
      }, falta);
    }

    if (document.readyState === "complete") finalizar();
    else {
      window.addEventListener("load", finalizar, { once: true });
      // rede ruim não pode prender a pessoa aqui pra sempre
      const limite = setTimeout(finalizar, 9000);
      return () => { clearTimeout(limite); clearInterval(tMsg); clearInterval(tProg); };
    }

    return () => { clearInterval(tMsg); clearInterval(tProg); };
  }, []);

  if (!visivel) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-8"
      style={{
        background: "#0B0B0B",
        opacity: saindo ? 0 : 1,
        transition: "opacity 420ms ease",
        pointerEvents: saindo ? "none" : "auto",
      }}
    >
      {/* marca */}
      <div className="flex flex-col items-center">
        <div
          className="tracking-[0.42em] text-[11px] font-semibold mb-1.5"
          style={{ color: "#8A8A8A" }}
        >
          GRUPO
        </div>

        <div className="flex items-center gap-2.5">
          {/* o "P" da marca */}
          <span
            className="grid place-items-center rounded-[9px] shrink-0"
            style={{ width: 44, height: 44, background: "#FFB600" }}
          >
            <svg width="24" height="24" viewBox="0 0 59 62" fill="none">
              <path
                d="M14 12h20c7.5 0 13 5 13 12s-5.5 12-13 12H24v14h-10V12zm10 8v8h9c2.8 0 4.6-1.6 4.6-4s-1.8-4-4.6-4h-9z"
                fill="#1D1D1B"
              />
            </svg>
          </span>
          <span
            className="font-disp font-extrabold text-white leading-none"
            style={{ fontSize: 40, letterSpacing: "-0.02em" }}
          >
            POTENCIAL
          </span>
        </div>

        <div className="tracking-[0.26em] text-[10.5px] font-semibold mt-3">
          <span style={{ color: "#8A8A8A" }}>AUTOMAÇÃO </span>
          <span style={{ color: "#FFB600" }}>INTELIGENTE</span>
        </div>
      </div>

      {/* progresso */}
      <div className="w-full max-w-[240px] mt-12">
        <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: "#232323" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progresso}%`,
              background: "#FFB600",
              transition: "width 320ms ease",
            }}
          />
        </div>
        <div
          className="text-center text-[12px] mt-3.5"
          style={{ color: pronto ? "#FFB600" : "#8A8A8A", transition: "color 200ms" }}
        >
          {pronto ? FINAL : MENSAGENS[idx]}
        </div>
      </div>

      {/* versão */}
      <div className="absolute bottom-7 text-[10.5px] font-mono" style={{ color: "#4A4A4A" }}>
        versão {VERSAO}
      </div>
    </div>
  );
}
