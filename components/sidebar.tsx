"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/painel", label: "Painel", group: "Operação" },
  { href: "/lojas", label: "Lojas", group: "Operação" },
  { href: "/contas", label: "Contas", group: "Operação" },
  { href: "/aprovacoes", label: "Aprovações", group: "Operação" },
  { href: "/cofre", label: "Cofre", group: "Segurança" },
];

function Icon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    "/painel": (<><rect x="2.5" y="2.5" width="6" height="6" rx="1.5" /><rect x="11.5" y="2.5" width="6" height="6" rx="1.5" /><rect x="2.5" y="11.5" width="6" height="6" rx="1.5" /><rect x="11.5" y="11.5" width="6" height="6" rx="1.5" /></>),
    "/lojas": (<><path d="M3 8.5L10 3l7 5.5" /><path d="M4.5 8v8h11V8" /><path d="M8 16v-4.5h4V16" /></>),
    "/contas": (<><rect x="2.5" y="3.5" width="15" height="13" rx="2" /><path d="M2.5 8h15M7 8v8.5" /></>),
    "/aprovacoes": <path d="M4 10.5l3.5 3.5L16 5.5" />,
    "/cofre": (<><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 017 0v2.5" /></>),
  };
  return (
    <svg className="w-[17px] h-[17px] opacity-85" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      {p[name]}
    </svg>
  );
}

export default function Sidebar({ nome, papel }: { nome: string; papel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const iniciais = nome.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <aside className="bg-ebano text-[#cfcdc7] flex flex-col sticky top-0 h-screen w-[236px] shrink-0">
      <div className="px-[22px] py-5 flex items-center gap-3 border-b border-[#242424]">
        <div className="w-[30px] h-[30px] rounded-lg bg-amarelo relative shrink-0">
          <span className="absolute inset-[9px] rounded-[2px] bg-ebano block" />
        </div>
        <div>
          <b className="font-disp text-white font-bold text-[15px] leading-none block">Potencial</b>
          <span className="text-amarelo text-[10px] tracking-[2px] uppercase font-semibold">Contas</span>
        </div>
      </div>

      <nav className="px-3 py-4 flex flex-col gap-[3px] flex-1">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[10px] tracking-[1.6px] uppercase text-[#6a6862] px-3 pt-3 pb-1.5">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => {
              const on = pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13.5px] font-medium transition ${
                    on ? "bg-ebano-3 text-white" : "text-[#c9c7c1] hover:bg-ebano-3 hover:text-white"
                  }`}>
                  {on && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-amarelo" />}
                  <Icon name={n.href} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <button onClick={sair} className="text-left px-4 py-3.5 border-t border-[#242424] flex items-center gap-2.5 hover:bg-ebano-2 transition">
        <div className="w-8 h-8 rounded-[9px] bg-petroleo text-white grid place-items-center font-disp font-semibold text-[13px]">{iniciais}</div>
        <div className="min-w-0">
          <b className="text-[#eee] text-[13px] font-medium block truncate">{nome}</b>
          <small className="text-[#6a6862] text-[11px] capitalize">{papel} · sair</small>
        </div>
      </button>
    </aside>
  );
}
