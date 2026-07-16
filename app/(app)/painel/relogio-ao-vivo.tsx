"use client";

import { useState, useEffect } from "react";

export default function RelogioAoVivo() {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // evita mostrar hora errada por um instante antes do primeiro tick no
  // navegador (hidratação) - só renderiza depois de montar de verdade.
  if (!agora) return null;

  const data = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <div className="flex items-center gap-2 text-[13px] text-[#6c757d]">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="7.5" /><path d="M10 6v4l2.5 1.5" /></svg>
      <span className="capitalize">{data}</span>
      <span className="text-[#adb5bd]">·</span>
      <span className="font-mono">{hora}</span>
    </div>
  );
}
