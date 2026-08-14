// Chip de status genérico e consistente. Use `tom` para a cor semântica:
//   ok (verde)   → concluído, saudável, pago
//   alerta (verm)→ atraso, risco, falha
//   info (azul)  → informação, em andamento
//   aviso (âmbar)→ atenção, pendente
//   auto (roxo)  → automação / IA
//   neutro       → sem estado / padrão
// Mantém o mesmo tamanho e forma em todo o sistema.

type Tom = "ok" | "alerta" | "info" | "aviso" | "auto" | "neutro";

const TONS: Record<Tom, string> = {
  ok: "bg-ok-bg text-ok",
  alerta: "bg-alerr-bg text-alerr",
  info: "bg-info-bg text-info",
  aviso: "bg-amarelo-bg text-amb",
  auto: "bg-[#F3EFFB] text-[#6B5B95]",
  neutro: "bg-[#EEE] text-[#777]",
};

export default function StatusChip({ tom = "neutro", children }: { tom?: Tom; children: React.ReactNode }) {
  return <span className={`badge ${TONS[tom]}`}>{children}</span>;
}

export type { Tom };
