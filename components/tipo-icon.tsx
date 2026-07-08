// Icones por tipo de conta - usados no Painel, Contas, Aprovações, Categorias.
// Um só componente pra manter os glifos consistentes em tudo.

const PATHS: Record<string, React.ReactNode> = {
  agua: (
    <path d="M12 2.5c-4 5.2-7 9-7 12.5a7 7 0 0014 0c0-3.5-3-7.3-7-12.5z" />
  ),
  energia: (
    <path d="M13 2L5 13h5.5l-1 9L19 11h-5.5l1-9z" strokeLinejoin="round" />
  ),
  telefone: (
    <path d="M5 3.5h3l1.5 4-2 1.3a12 12 0 006.7 6.7l1.3-2 4 1.5v3a2 2 0 01-2.2 2C10.5 19.5 4.5 13.5 3 6.7A2 2 0 015 3.5z" strokeLinejoin="round" />
  ),
  iptu: (
    <>
      <path d="M3 9.5L12 4l9 5.5" />
      <path d="M3 19h18" />
      <path d="M5.5 9.5V19M9.5 9.5V19M14.5 9.5V19M18.5 9.5V19" />
    </>
  ),
  condominio: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="1" />
      <path d="M9.5 7h1.5M13 7h1.5M9.5 11h1.5M13 11h1.5M9.5 15h1.5M13 15h1.5" />
      <path d="M10 21.5v-3h4v3" />
    </>
  ),
  aluguel: (
    <>
      <path d="M3.5 11L12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  custo_geral: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.1 5.9l-1.7 1.7M7.6 16.4l-1.7 1.7M18.1 18.1l-1.7-1.7M7.6 7.6L5.9 5.9" />
    </>
  ),
};

export default function TipoIcon({ tipo, size = 20, color = "currentColor", strokeWidth = 1.7 }: {
  tipo: string; size?: number; color?: string; strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {PATHS[tipo] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
