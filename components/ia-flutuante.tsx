"use client";

import { useEffect, useState } from "react";
import IaAssistentePanel from "./ia-assistente-panel";
import { agente, type MensagemAgente } from "@/lib/agente-proativo";

const COR: Record<string, string> = {
  incentivo: "border-ok/30",
  lembrete: "border-info/30",
  sugestao: "border-amarelo/40",
  alerta: "border-alerr/30",
};

export default function IaFlutuante() {
  const [aberto, setAberto] = useState(false);
  const [balao, setBalao] = useState<MensagemAgente | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);

  // escuta o que o agente tem a dizer enquanto a pessoa trabalha
  useEffect(() => {
    return agente.inscrever((m) => {
      if (aberto) return; // com o chat aberto, não precisa de balão
      setBalao(m);
      setNaoLidas((n) => n + 1);
      const t = setTimeout(() => setBalao((atual) => (atual?.id === m.id ? null : atual)), 9000);
      return () => clearTimeout(t);
    });
  }, [aberto]);

  function abrirChat() {
    setAberto(true);
    setBalao(null);
    setNaoLidas(0);
  }

  return (
    <>
      {aberto && <div onClick={() => setAberto(false)} className="fixed inset-0 bg-black/30 z-40" />}

      {aberto && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] max-w-[380px] h-[560px] max-h-[75vh]">
          <IaAssistentePanel compacto />
        </div>
      )}

      {/* balão proativo: aparece sozinho durante o trabalho */}
      {!aberto && balao && (
        <div className={`fixed bottom-24 right-4 sm:right-6 z-50 w-[86vw] max-w-[300px] bg-white border ${COR[balao.tipo] ?? "border-linha"} rounded-2xl rounded-br-sm shadow-forte p-3.5 animate-in`}>
          <button onClick={() => setBalao(null)} aria-label="Dispensar"
            className="absolute top-2 right-2 text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <p className="text-[12.5px] text-[#1a1a1a] leading-snug pr-4">{balao.texto}</p>
          <button onClick={abrirChat}
            className="mt-2 text-[11.5px] font-semibold text-amarelo-dark hover:underline">
            {balao.perguntaSugerida ? "Me conta mais" : "Falar com o assistente"}
          </button>
        </div>
      )}

      <button
        onClick={() => (aberto ? setAberto(false) : abrirChat())}
        aria-label="Abrir assistente"
        className="fixed bottom-5 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-amarelo hover:bg-amarelo-dark text-ebano shadow-forte grid place-items-center transition-transform hover:scale-105"
      >
        {!aberto && naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[19px] h-[19px] px-1 rounded-full bg-alerr text-white text-[10px] font-bold grid place-items-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
        {aberto ? (
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.2 4.5 3 6l-1 4 4.3-1.7c.9.3 1.8.4 2.7.4 5 0 9-3.6 9-8S17 3 12 3z" />
          </svg>
        )}
      </button>
    </>
  );
}
