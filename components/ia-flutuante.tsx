"use client";

import { useState } from "react";
import IaAssistentePanel from "./ia-assistente-panel";

export default function IaFlutuante() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {aberto && (
        <div onClick={() => setAberto(false)} className="fixed inset-0 bg-black/30 z-40" />
      )}

      {aberto && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] max-w-[380px] h-[560px] max-h-[75vh]">
          <IaAssistentePanel compacto />
        </div>
      )}

      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Abrir assistente"
        className="fixed bottom-5 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-amarelo hover:bg-amarelo-dark text-ebano shadow-forte grid place-items-center transition-transform hover:scale-105"
      >
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
