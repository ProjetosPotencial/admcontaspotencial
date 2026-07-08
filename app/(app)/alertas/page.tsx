import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TIPOS } from "@/lib/types";

export const dynamic = "force-dynamic";
const ANO = 2026, MES_ATUAL = 7;

export default async function AlertasPage() {
  const supabase = createClient();

  const [{ data: lancJul }, { data: mapear }] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("id, situacao, contas!inner ( tipo, dia_vencimento, fornecedor_nome, lojas ( codigo ) )")
      .eq("ano", ANO).eq("mes", MES_ATUAL)
      .in("situacao", ["pendente", "lancado"]),
    supabase
      .from("contas")
      .select("id, tipo, fornecedor_nome, lojas ( codigo )")
      .eq("situacao_cadastro", "aprovada").eq("status", "ativo").eq("origem", "a_definir"),
  ]);

  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesJaPassou = hoje.getFullYear() > ANO || (hoje.getFullYear() === ANO && hoje.getMonth() + 1 > MES_ATUAL);
  const atrasadas = (lancJul ?? []).filter((l: any) => {
    const dv = l.contas?.dia_vencimento;
    if (mesJaPassou) return true;
    return dv && dv < diaAtual;
  });

  return (
    <>
      <div className="px-8 py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Alertas</h1>
        <p className="text-[14px] text-[#666] mt-2.5">O que precisa de atenção agora</p>
      </div>
      <div className="px-8 pb-8 max-w-[900px] space-y-8">
        <section>
          <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-alerr" /> Contas atrasadas ({atrasadas.length})
          </h2>
          <div className="card divide-y divide-[#f0f0f0]">
            {atrasadas.slice(0, 20).map((l: any) => (
              <Link key={l.id} href={`/contas?tipo=${l.contas.tipo}`} className="flex items-center gap-3 px-5 py-3 text-[13px] hover:bg-[#f9f9f9]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPOS[l.contas.tipo]?.c }} />
                <b className="font-semibold">{l.contas.lojas?.codigo}</b>
                <span className="text-[#666]">{TIPOS[l.contas.tipo]?.n} · {l.contas.fornecedor_nome ?? "—"}</span>
                <span className="ml-auto text-[11px] text-[#999] font-mono">dia {l.contas.dia_vencimento ?? "—"}</span>
              </Link>
            ))}
            {atrasadas.length === 0 && <div className="text-center py-10 text-[#999] text-[13px]">Nenhuma conta atrasada.</div>}
          </div>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amb" /> Origem a mapear ({(mapear ?? []).length})
          </h2>
          <div className="card divide-y divide-[#f0f0f0]">
            {(mapear ?? []).slice(0, 20).map((c: any) => (
              <Link key={c.id} href={`/contas?tipo=${c.tipo}`} className="flex items-center gap-3 px-5 py-3 text-[13px] hover:bg-[#f9f9f9]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPOS[c.tipo]?.c }} />
                <b className="font-semibold">{c.lojas?.codigo}</b>
                <span className="text-[#666]">{TIPOS[c.tipo]?.n} · {c.fornecedor_nome ?? "—"}</span>
              </Link>
            ))}
            {(mapear ?? []).length === 0 && <div className="text-center py-10 text-[#999] text-[13px]">Nenhuma conta sem origem.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
