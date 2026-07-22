"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Mostra a mensagem de "sem permissão" por alguns segundos e então leva a
// pessoa pra primeira área que ela pode abrir. Assim atendemos as duas
// regras da spec ao mesmo tempo: exibir o aviso E redirecionar sozinho.
export default function RedirecionarApos({ destino, segundos = 4 }: { destino: string; segundos?: number }) {
  const router = useRouter();
  const [restante, setRestante] = useState(segundos);

  useEffect(() => {
    const tick = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    const t = setTimeout(() => {
      router.push(destino);
      router.refresh();
    }, segundos * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(t);
    };
  }, [destino, segundos, router]);

  return (
    <p className="text-[12px] text-[#6c757d] mt-4">
      Redirecionando para uma área liberada em {restante}s…
    </p>
  );
}
