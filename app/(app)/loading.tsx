export default function CarregandoApp() {
  // Esse componente aparece DENTRO do layout, que já tem a sidebar e a
  // barra superior de verdade renderizadas por fora. Por isso aqui só
  // desenha o esqueleto do CONTEÚDO - desenhar uma sidebar falsa aqui
  // duplicava a de verdade, ficando uma tela confusa e preta por cima.
  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-forte px-8 py-7 flex flex-col items-center gap-3 border border-linha">
          <svg width="46" height="46" viewBox="0 0 72 72" fill="none" className="animate-pulse">
            <path d="M18 8h20c11 0 18 7 18 17s-7 17-18 17H30v22H18V8z" fill="#FFC107" />
            <path d="M30 20h7c4.5 0 7 2.2 7 5.5S41.5 31 37 31h-7V20z" fill="#1a1c1e" />
          </svg>
          <span className="text-[12px] font-semibold text-[#6c757d] tracking-wide">Carregando...</span>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <div className="h-7 w-56 bg-[#e9ecef] rounded animate-pulse mb-2" />
        <div className="h-4 w-80 bg-[#f1f3f5] rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-linha rounded-xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="h-64 bg-white border border-linha rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
