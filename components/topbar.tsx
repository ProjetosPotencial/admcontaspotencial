export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-8 pt-8 pb-2">
      <h1 className="font-disp text-[32px] font-bold text-[#1a1a1a] leading-none">{title}</h1>
      {subtitle && <p className="text-[#6c757d] text-sm mt-2">{subtitle}</p>}
    </div>
  );
}
