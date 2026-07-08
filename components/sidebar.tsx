"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { label: "Painel", href: "/painel", icon: "painel" },
  { label: "Contas", href: "/contas", icon: "contas" },
  { label: "Lançamentos", href: "/lancamentos", icon: "lancamentos" },
  { label: "Aprovações", href: "/aprovacoes", icon: "aprovacoes" },
  { label: "Pagamentos", href: "/pagamentos", icon: "pagamentos" },
  { label: "Fornecedores", href: "/fornecedores", icon: "fornecedores" },
  { label: "Centros de Custo", href: "/centros-de-custo", icon: "centros" },
  { label: "Relatórios", href: "/relatorios", icon: "relatorios" },
  { label: "Cadastros", href: "/lojas", icon: "cadastros" },
  { label: "Cofre", href: "/cofre", icon: "cofre" },
  { label: "Configurações", href: "/configuracoes", icon: "config" },
];

const ICONS: Record<string, React.ReactNode> = {
  painel: <><rect x="2.5" y="2.5" width="6" height="6" rx="1.5" /><rect x="11.5" y="2.5" width="6" height="6" rx="1.5" /><rect x="2.5" y="11.5" width="6" height="6" rx="1.5" /><rect x="11.5" y="11.5" width="6" height="6" rx="1.5" /></>,
  contas: <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  lancamentos: <><circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v4l3 2" /></>,
  aprovacoes: <path d="M4 10.5l3.5 3.5L16 5.5" />,
  pagamentos: <><rect x="2.5" y="5" width="15" height="11" rx="2" /><path d="M2.5 9h15" /></>,
  fornecedores: <><circle cx="7" cy="7" r="2.6" /><circle cx="14" cy="8.5" r="2.1" /><path d="M2.5 17c0-3 2-5 4.5-5s4.5 2 4.5 5" /><path d="M12 17c.3-2.3 1.6-4 3-4.3" /></>,
  centros: <><rect x="3.5" y="3.5" width="13" height="13" rx="1.5" /><path d="M7 7h1M12 7h1M7 10h1M12 10h1M7 13h1M12 13h1" /></>,
  relatorios: <><path d="M4 16.5V10M10 16.5V4.5M16 16.5V8" /></>,
  cadastros: <><path d="M3 8.5L10 3l7 5.5" /><path d="M4.5 8v8h11V8" /><path d="M8 16v-4.5h4V16" /></>,
  cofre: <><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 017 0v2.5" /></>,
  config: <><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><circle cx="10" cy="13" r="1.6" /></>,
};

function Icon({ name }: { name: string }) {
  return (
    <svg className="w-[17px] h-[17px] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export default function Sidebar({ nome, email }: { nome: string; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuAberto, setMenuAberto] = useState(false);
  const iniciais = nome.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="bg-ebano w-[248px] shrink-0 h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/10">
        <svg width="30" height="30" viewBox="0 0 72 72" fill="none" className="shrink-0">
          <path d="M18 8h20c11 0 18 7 18 17s-7 17-18 17H30v22H18V8z" fill="#FFC107" />
          <path d="M30 20h7c4.5 0 7 2.2 7 5.5S41.5 31 37 31h-7V20z" fill="#1a1c1e" />
        </svg>
        <div>
          <div className="text-white font-disp font-bold text-[15px] leading-none">POTENCIAL</div>
          <div className="text-amarelo font-disp font-semibold text-[10px] tracking-[2px] mt-0.5">CONTAS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const on = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href) && item.href !== "/lojas") || pathname === item.href;
          const ativo = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-medium transition ${
                ativo ? "bg-amarelo text-ebano font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/10 p-3">
        <button onClick={() => setMenuAberto((v) => !v)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="w-9 h-9 rounded-full bg-amarelo text-ebano grid place-items-center font-disp font-bold text-[12.5px] shrink-0">{iniciais}</div>
          <div className="text-left min-w-0 flex-1">
            <div className="text-white text-[13px] font-semibold truncate">{nome}</div>
            <div className="text-white/45 text-[11px] truncate">{email}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.6"><path d="M6 8l4 4 4-4" /></svg>
        </button>
        {menuAberto && (
          <div className="absolute left-3 right-3 bottom-[64px] bg-white border border-linha rounded-lg shadow-media py-1.5 z-40">
            <button onClick={sair} className="w-full text-left px-4 py-2 text-[13px] text-txt hover:bg-off">Sair</button>
          </div>
        )}
      </div>
    </aside>
  );
}
