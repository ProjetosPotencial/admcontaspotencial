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
    <div className="flex items-start justify-between gap-4 mb-7">
      <div className="min-w-0">
        <div className="section-label mb-2">Grupo Potencial · Gestão financeira</div>
        <h1 className="font-disp text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight tracking-[-0.03em]">{titulo}</h1>
        {descricao && <p className="text-[13.5px] text-[#667085] mt-2 max-w-2xl leading-relaxed">{descricao}</p>}
      </div>
      {acao && <div className="flex items-center gap-2 shrink-0">{acao}</div>}
    </div>
  );
}
