import { createClient } from "@/lib/supabase/server";
import { TIPOS } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("contas")
    .select("tipo, status")
    .eq("situacao_cadastro", "aprovada");

  const contagem: Record<string, { total: number; ativas: number }> = {};
  Object.keys(TIPOS).forEach((t) => (contagem[t] = { total: 0, ativas: 0 }));
  (data ?? []).forEach((c) => {
    if (!contagem[c.tipo]) return;
    contagem[c.tipo].total++;
    if (c.status === "ativo") contagem[c.tipo].ativas++;
  });

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Categorias</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Os 7 tipos de conta usados no controle de consumo</p>
      </div>
      <div className="px-8 pb-8 max-w-[900px] grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(TIPOS).map(([k, T]) => {
          const c = contagem[k];
          return (
            <div key={k} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-lg grid place-items-center shrink-0" style={{ background: T.bg }}>
                  <TipoIcon tipo={k} size={20} color={T.c} />
                </div>
                <div className="font-semibold text-[15px] text-[#1a1a1a]">{T.n}</div>
              </div>
              <div className="text-[28px] font-bold text-[#1a1a1a] leading-none">{c.total}</div>
              <div className="text-[12px] text-[#6c757d] mt-1">{c.ativas} ativas de {c.total} cadastradas</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
