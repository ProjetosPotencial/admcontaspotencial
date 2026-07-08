export default function Topbar({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="bg-papel border-b border-linha px-8 py-4 flex items-center gap-4 sticky top-0 z-20">
      <div>
        <div className="kicker">{eyebrow}</div>
        <h1 className="font-disp text-xl font-semibold -mt-0.5">{title}</h1>
      </div>
    </header>
  );
}
