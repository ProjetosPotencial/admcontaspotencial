"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = { label: string; href: string };
type Grupo = { titulo: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "VISÃO GERAL",
    itens: [
      { label: "Dashboard", href: "/painel" },
      { label: "Calendário", href: "/calendario" },
      { label: "Alertas", href: "/alertas" },
    ],
  },
  {
    titulo: "CONTAS",
    itens: [
      { label: "Todas as contas", href: "/contas" },
      { label: "Lançamentos", href: "/lancamentos" },
      { label: "A lançar", href: "/contas?situacao=pendente" },
      { label: "Aguardando pagamento", href: "/contas?situacao=lancado" },
      { label: "Pagamentos", href: "/pagamentos" },
      { label: "Pagas", href: "/contas?situacao=pago" },
      { label: "Canceladas", href: "/contas?status=encerrado" },
    ],
  },
  {
    titulo: "CADASTROS",
    itens: [
      { label: "Fornecedores", href: "/fornecedores" },
      { label: "Categorias", href: "/categorias" },
      { label: "Centros de custo", href: "/centros-de-custo" },
      { label: "Locais / Lojas", href: "/lojas" },
    ],
  },
  {
    titulo: "CONFIGURAÇÕES",
    itens: [
      { label: "Regras de aprovação", href: "/regras-aprovacao" },
      { label: "Usuários", href: "/usuarios" },
      { label: "Configurações", href: "/configuracoes" },
    ],
  },
];

const ICON_GRUPO: Record<string, React.ReactNode> = {
  "VISÃO GERAL": <><path d="M3 8.5L10 3l7 5.5" /><path d="M4.5 8v8h11V8" /><path d="M8 16v-4.5h4V16" /></>,
  "CONTAS": <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  "CADASTROS": <><circle cx="7" cy="7" r="2.6" /><circle cx="14" cy="8.5" r="2.1" /><path d="M2.5 17c0-3 2-5 4.5-5s4.5 2 4.5 5" /><path d="M12 17c.3-2.3 1.6-4 3-4.3" /></>,
  "CONFIGURAÇÕES": <><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 017 0v2.5" /></>,
};

function IconGrupo({ titulo }: { titulo: string }) {
  return (
    <svg className="w-[15px] h-[15px] shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICON_GRUPO[titulo]}
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const atual = pathname + (search.toString() ? "?" + search.toString() : "");

  return (
    <aside className="bg-ebano-2 w-[232px] shrink-0 h-[calc(100vh-64px)] sticky top-16 overflow-y-auto py-6">
      <nav className="flex flex-col">
        {GRUPOS.map((g) => (
          <div key={g.titulo} className="mb-1">
            <div className="flex items-center gap-2 text-amarelo text-[11px] font-semibold tracking-wide px-6 mt-5 mb-1.5 first:mt-0">
              <IconGrupo titulo={g.titulo} /> {g.titulo}
            </div>
            {g.itens.map((item) => {
              const on = atual === item.href || (item.href.indexOf("?") === -1 && pathname === item.href && search.toString() === "");
              return (
                <Link key={item.label} href={item.href}
                  className={`relative flex items-center gap-2.5 px-6 py-2.5 text-[13px] font-medium transition ${
                    on ? "text-amarelo bg-ebano-3" : "text-white/85 hover:bg-ebano-3 hover:text-white"
                  }`}>
                  {on && <span className="absolute left-0 top-0 bottom-0 w-1 bg-amarelo" />}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-8 mx-4 pt-4 border-t border-white/10 px-2">
        <div className="flex items-center gap-2 text-white/80 text-[13px] font-medium mb-1">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="7.5" /><path d="M7.8 7.8a2.2 2.2 0 114 1.3c-.5.5-1.3.9-1.3 1.9" /><circle cx="10" cy="14" r=".2" /></svg>
          Ajuda
        </div>
        <a href="mailto:suporte@potencialgrupo.com.br" className="text-white/40 text-[11.5px] hover:text-amarelo transition">
          Precisa de ajuda? Fale com o suporte
        </a>
      </div>
    </aside>
  );
}
