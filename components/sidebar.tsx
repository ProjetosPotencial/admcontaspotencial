"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMenuMobile } from "@/components/app-shell";

type MenuItem = { id: string; label: string; href: string; icone: string };

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
  empresas: <><rect x="3" y="6" width="14" height="11" rx="1.5" /><path d="M3 6l7-3 7 3" /><path d="M8 17v-3.5h4V17" /></>,
  contratos: <><path d="M6 2.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V3.5a1 1 0 011-1z" /><path d="M7.5 8h5M7.5 11h5M7.5 14h3" /></>,
};

function Icon({ name }: { name: string }) {
  return (
    <svg className="w-[17px] h-[17px] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] ?? <circle cx="10" cy="10" r="7" />}
    </svg>
  );
}

export default function Sidebar({ nome, email, itens }: { nome: string; email: string; itens: MenuItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { aberto, setAberto } = useMenuMobile();
  const [menuPerfilAberto, setMenuPerfilAberto] = useState(false);
  const iniciais = nome.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* fundo escurecido atrás da sidebar no mobile */}
      {aberto && (
        <div onClick={() => setAberto(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden" />
      )}

      <aside className={`bg-ebano w-[248px] shrink-0 h-screen flex flex-col fixed md:sticky top-0 left-0 z-50 transition-transform duration-200 ${
        aberto ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/10">
          <svg width="30" height="30" viewBox="0 0 72 72" fill="none" className="shrink-0">
            <path d="M18 8h20c11 0 18 7 18 17s-7 17-18 17H30v22H18V8z" fill="#FFC107" />
            <path d="M30 20h7c4.5 0 7 2.2 7 5.5S41.5 31 37 31h-7V20z" fill="#1a1c1e" />
          </svg>
          <div>
            <div className="text-white font-disp font-bold text-[15px] leading-none">POTENCIAL</div>
            <div className="text-amarelo font-disp font-semibold text-[10px] tracking-[2px] mt-0.5">CONTAS</div>
          </div>
          <button onClick={() => setAberto(false)} className="ml-auto text-white/60 hover:text-white md:hidden">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {itens.length === 0 && (
            <div className="px-3.5 py-2.5 text-[12px] text-white/40 leading-snug">
              Nenhum item de menu liberado para o seu papel.
            </div>
          )}
          {itens.map((item) => {
            const ativo = pathname.startsWith(item.href);
            return (
              <Link key={item.id} href={item.href} onClick={() => setAberto(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-medium transition ${
                  ativo ? "bg-amarelo text-ebano font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}>
                <Icon name={item.icone} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-white/10 p-3">
          <button onClick={() => setMenuPerfilAberto((v) => !v)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition">
            <div className="w-9 h-9 rounded-full bg-amarelo text-ebano grid place-items-center font-disp font-bold text-[12.5px] shrink-0">{iniciais}</div>
            <div className="text-left min-w-0 flex-1">
              <div className="text-white text-[13px] font-semibold truncate">{nome}</div>
              <div className="text-white/45 text-[11px] truncate">{email}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.6"><path d="M6 8l4 4 4-4" /></svg>
          </button>
          {menuPerfilAberto && (
            <div className="absolute left-3 right-3 bottom-[64px] bg-white border border-linha rounded-lg shadow-media py-1.5 z-40">
              <button onClick={sair} className="w-full text-left px-4 py-2 text-[13px] text-txt hover:bg-off">Sair</button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
