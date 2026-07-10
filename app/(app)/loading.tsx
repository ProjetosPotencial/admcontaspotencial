export default function CarregandoApp() {
  return (
    <div className="min-h-screen flex bg-papel">
      {/* esqueleto da sidebar */}
      <div className="bg-ebano w-[248px] shrink-0 h-screen hidden md:flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="h-8 w-32 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="flex-1 px-3 py-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-white/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* esqueleto da barra superior */}
        <div className="h-16 bg-white border-b border-linha px-6 flex items-center justify-end gap-3 shrink-0">
          <div className="h-9 w-28 bg-[#f1f3f5] rounded-lg animate-pulse" />
          <div className="h-9 w-9 bg-[#f1f3f5] rounded-lg animate-pulse" />
        </div>

        {/* esqueleto do conteudo */}
        <div className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
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
    </div>
  );
}
