"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Contador que sobe até o valor final quando o card aparece.
 * Respeita quem prefere menos animação no sistema.
 */
export default function ContadorAnimado({
  valor,
  duracao = 900,
  prefixo = "",
  formatar,
  className = "",
}: {
  valor: number;
  duracao?: number;
  prefixo?: string;
  formatar?: (n: number) => string;
  className?: string;
}) {
  const [atual, setAtual] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const jaRodou = useRef(false);

  useEffect(() => {
    const semAnimacao =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (semAnimacao) { setAtual(valor); return; }

    const el = ref.current;
    if (!el) { setAtual(valor); return; }

    const obs = new IntersectionObserver((entradas) => {
      if (!entradas[0].isIntersecting || jaRodou.current) return;
      jaRodou.current = true;
      const inicio = performance.now();
      const passo = (agora: number) => {
        const t = Math.min(1, (agora - inicio) / duracao);
        // easing suave no fim
        const eased = 1 - Math.pow(1 - t, 3);
        setAtual(valor * eased);
        if (t < 1) requestAnimationFrame(passo);
        else setAtual(valor);
      };
      requestAnimationFrame(passo);
    }, { threshold: 0.2 });

    obs.observe(el);
    return () => obs.disconnect();
  }, [valor, duracao]);

  const texto = formatar ? formatar(atual) : Math.round(atual).toLocaleString("pt-BR");
  return <span ref={ref} className={className}>{prefixo}{texto}</span>;
}
