export default function Topbar({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="bg-papel border-b border-linha px-8 py-4 flex items-center gap-4 sticky top-0 z-20">
      <div>
        <div className="kicker">{eyebrow}</div>
        <h1 className="font-disp text-2xl font-extrabold -mt-0.5 tracking-tight">{title}</h1>
      </div>
    </header>
  );
}
