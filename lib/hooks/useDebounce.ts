import { useState, useEffect } from "react";

/**
 * Devolve o valor só depois que o usuário para de digitar por `delay` ms.
 * Usado nos campos de busca para não refazer o filtro (e re-renderizar a
 * tabela inteira) a cada letra digitada - só quando a pessoa realmente
 * pausa, o que evita o campo "travar" em listas grandes.
 */
export function useDebounce<T>(valor: T, delay = 300): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), delay);
    return () => clearTimeout(t);
  }, [valor, delay]);
  return debounced;
}
