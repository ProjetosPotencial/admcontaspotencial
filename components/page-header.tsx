// Cabeçalho de página padrão: título, descrição opcional e área de ação à
// direita (botões). Dá o mesmo respiro e hierarquia a todas as telas.

export default function PageHeader({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="font-disp text-[26px] sm:text-[30px] font-semibold text-txt tracking-tight">{titulo}</h1>
        {descricao && <p className="text-[13.5px] text-txt-2 mt-1">{descricao}</p>}
      </div>
      {acao && <div className="flex items-center gap-2 shrink-0">{acao}</div>}
    </div>
  );
}
