import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TIPOS } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { carregarCalendario } from "@/lib/calendario-server";
import { obterPeriodoAtual, estaAtrasada } from "@/lib/date-utils";
import { podeAcessar, SemPermissao } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

function agruparPorTipo(itens: any[]): [string, any[]][] {
  const grupos = new Map<string, any[]>();
  for (const item of itens) {
    const tipo = (item as any).contas?.tipo ?? (item as any).tipo ?? "custo_geral";
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo)!.push(item);
  }
  // ordena pela ordem natural dos tipos (mesma ordem do TIPOS), não alfabética
  return Object.keys(TIPOS)
    .filter((t) => grupos.has(t))
    .map((t) => [t, grupos.get(t)!] as [string, any[]]);
}

export default async function AlertasPage() {
  if (!(await podeAcessar("/alertas"))) return <SemPermissao modulo="Alertas" />;
  const supabase = createClient();
  const { ano, mes } = obterPeriodoAtual();
  const cal = await carregarCalendario(ano);

  await supabase.rpc("garantir_lancamentos_pendentes", { p_ano: ano, p_mes: mes });

  const [{ data: lancMes }, { data: mapear }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("id, situacao, contas!inner ( id, tipo, dia_vencimento, fornecedor_nome, lojas ( codigo ) )")
      .eq("ano", ano).eq("mes", mes)
      .in("situacao", ["pendente", "lancado"]),
    supabase
      .from("contas")
      .select("id, tipo, fornecedor_nome, lojas ( codigo )")
      .eq("situacao_cadastro", "aprovada").eq("status", "ativo").eq("origem", "a_definir"),
  ]);

  const atrasadas = (lancMes ?? []).filter((l: any) =>
    estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano, undefined, cal)
  );
  const atrasadasPorTipo = agruparPorTipo(atrasadas);
  const mapearPorTipo = agruparPorTipo(mapear ?? []);

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Alertas</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">O que precisa de atenção agora</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[900px] space-y-8">
        <section>
          <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-alerr" /> Contas atrasadas ({atrasadas.length})
          </h2>
          {atrasadas.length === 0 ? (
            <div className="card text-center py-10 text-[#adb5bd] text-[13px]">Nenhuma conta atrasada.</div>
          ) : (
            <div className="space-y-5">
              {atrasadasPorTipo.map(([tipo, itens]) => (
                <div key={tipo}>
                  <div className="flex items-center gap-2 mb-2 text-[12.5px] font-semibold text-[#6c757d]">
                    <TipoIcon tipo={tipo} size={14} color={TIPOS[tipo]?.c} />
                    {TIPOS[tipo]?.n}
                    <span className="badge bg-[#f1f3f5] text-[#6c757d]">{itens.length}</span>
                  </div>
                  <div className="card divide-y divide-[#f1f3f5]">
                    {(itens as any[]).map((l) => (
                      <Link key={l.id} href={`/contas?conta=${l.contas.id}`} className="flex items-center gap-3 px-5 py-3 text-[13px] hover:bg-[#f8f9fa]">
                        <b className="font-semibold">{l.contas.lojas?.codigo}</b>
                        <span className="text-[#6c757d]">{l.contas.fornecedor_nome ?? "—"}</span>
                        <span className="ml-auto text-[11px] text-[#adb5bd] font-mono">dia {l.contas.dia_vencimento ?? "—"}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amb" /> Origem a mapear ({(mapear ?? []).length})
          </h2>
          {(mapear ?? []).length === 0 ? (
            <div className="card text-center py-10 text-[#adb5bd] text-[13px]">Nenhuma conta sem origem.</div>
          ) : (
            <div className="space-y-5">
              {mapearPorTipo.map(([tipo, itens]) => (
                <div key={tipo}>
                  <div className="flex items-center gap-2 mb-2 text-[12.5px] font-semibold text-[#6c757d]">
                    <TipoIcon tipo={tipo} size={14} color={TIPOS[tipo]?.c} />
                    {TIPOS[tipo]?.n}
                    <span className="badge bg-[#f1f3f5] text-[#6c757d]">{itens.length}</span>
                  </div>
                  <div className="card divide-y divide-[#f1f3f5]">
                    {(itens as any[]).map((c) => (
                      <Link key={c.id} href={`/contas?conta=${c.id}`} className="flex items-center gap-3 px-5 py-3 text-[13px] hover:bg-[#f8f9fa]">
                        <b className="font-semibold">{c.lojas?.codigo}</b>
                        <span className="text-[#6c757d]">{c.fornecedor_nome ?? "—"}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}