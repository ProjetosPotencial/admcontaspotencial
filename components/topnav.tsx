"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ABAS = [
  { href: "/painel", label: "PAINEL" },
  { href: "/contas", label: "CONTAS" },
  { href: "/aprovacoes", label: "APROVAÇÕES" },
  { href: "/cofre", label: "COFRE" },
];

export default function TopNav({ nome, notificacoes = 0 }: { nome: string; notificacoes?: number }) {
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
    <header className="h-16 bg-[#1a1a1a] px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-10">
        <Link href="/painel" className="flex items-center gap-2.5 shrink-0">
          <svg width="26" height="26" viewBox="0 0 72 72" fill="none">
            <path d="M18 8h20c11 0 18 7 18 17s-7 17-18 17H30v22H18V8z" fill="#FFC107" />
            <path d="M30 20h7c4.5 0 7 2.2 7 5.5S41.5 31 37 31h-7V20z" fill="#1a1a1a" />
          </svg>
          <span className="text-white font-disp font-bold text-[15px] tracking-tight leading-none">POTENCIAL <span className="text-amarelo">CONTAS</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {ABAS.map((a) => {
            const on = pathname.startsWith(a.href);
            return (
              <Link key={a.href} href={a.href}
                className={`relative text-sm font-medium py-5 transition ${on ? "text-white" : "text-white/70 hover:text-amarelo/80"}`}>
                {a.label}
                {on && <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-amarelo rounded-t" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <button className="relative text-white/80 hover:text-white">
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 8a5 5 0 0110 0c0 4 1.5 5 1.5 5h-13S5 12 5 8z" /><path d="M8 16a2 2 0 004 0" /></svg>
          {notificacoes > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-amarelo text-[#1a1a1a] text-[10px] font-bold w-4 h-4 rounded-full grid place-items-center">{notificacoes}</span>
          )}
        </button>
        <div className="relative">
          <button onClick={() => setMenuAberto((v) => !v)} className="flex items-center gap-2">
            <span className="text-white/80 text-sm hidden sm:inline">Olá, {nome.split(" ")[0]}</span>
            <div className="w-8 h-8 rounded-full bg-[#e0e0e0] text-[#1a1a1a] grid place-items-center font-disp font-semibold text-[12px]">{iniciais}</div>
          </button>
          {menuAberto && (
            <div className="absolute right-0 top-11 bg-white border border-linha rounded-md shadow-media w-40 py-1.5 z-40">
              <button onClick={sair} className="w-full text-left px-4 py-2 text-[13px] text-txt hover:bg-off">Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
