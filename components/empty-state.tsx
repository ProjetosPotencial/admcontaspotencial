// Estado vazio explicado: um ícone, um título, uma explicação curta e (opcional)
// uma ação recomendada. Evita que telas sem dados pareçam quebradas.

export default function EmptyState({
  titulo,
  descricao,
  icone,
  acao,
}: {
  titulo: string;
  descricao?: string;
  icone?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 rounded-full bg-off grid place-items-center text-txt-3 mb-4">
        {icone ?? (
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="4.5" width="13" height="11" rx="2" />
            <path d="M3.5 8h13M7 12h6" />
          </svg>
        )}
      </div>
      <h3 className="text-[15px] font-semibold text-txt">{titulo}</h3>
      {descricao && <p className="text-[13px] text-txt-2 mt-1 max-w-sm leading-relaxed">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
