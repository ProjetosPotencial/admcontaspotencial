import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import { TIPOS } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ANO = 2026;
const MES_ATUAL = 7;

export default async function PainelPage() {
  const supabase = createClient();

  const { data: contas } = await supabase
    .from("contas")
    .select("id, tipo, status, origem, dia_vencimento")
    .eq("situacao_cadastro", "aprovada");

  const { data: lancJul } = await supabase
    .from("lancamentos")
    .select("conta_id, situacao, contas!inner(tipo, dia_vencimento)")
    .eq("ano", ANO)
    .eq("mes", MES_ATUAL);

  const { data: lojasEncerradas } = await supabase
    .from("lojas")
    .select("codigo, coban, empresa, cidade, uf, encerrada_em, motivo_encerramento")
    .eq("status", "encerrada")
    .order("encerrada_em", { ascending: false })
    .limit(6);

  const { count: totalLojasEncerradas } = await supabase
    .from("lojas")
    .select("id", { count: "exact", head: true })
    .eq("status", "encerrada");

  // "atrasada" = pendente/lançada com vencimento já passado dentro do mês corrente
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesJaPassou = hoje.getFullYear() > ANO || (hoje.getFullYear() === ANO && hoje.getMonth() + 1 > MES_ATUAL);
  function estaAtrasada(situacao: string, diaVenc: number | null) {
    if (situacao !== "pendente" && situacao !== "lancado") return false;
    if (mesJaPassou) return true;
    if (!diaVenc) return false;
    return diaVenc < diaAtual;
  }

  const tipos = Object.keys(TIPOS);
  const porTipo = tipos.map((t) => {
    const doTipo = (contas ?? []).filter((c) => c.tipo === t && c.status === "ativo");
    const ativas = doTipo.length;
    const mapear = doTipo.filter((c) => c.origem === "a_definir").length;
    const lanc = (lancJul ?? []).filter((l: any) => l.contas?.tipo === t);
    const atrasadas = lanc.filter((l: any) => estaAtrasada(l.situacao, l.contas?.dia_vencimento)).length;
    const aberto = lanc.filter((l) => l.situacao === "pendente").length - lanc.filter((l: any) => l.situacao === "pendente" && estaAtrasada(l.situacao, l.contas?.dia_vencimento)).length;
    const lancado = lanc.filter((l) => l.situacao === "lancado").length - lanc.filter((l: any) => l.situacao === "lancado" && estaAtrasada(l.situacao, l.contas?.dia_vencimento)).length;
    const pago = lanc.filter((l) => l.situacao === "pago").length;
    return { t, ativas, mapear, aberto: Math.max(aberto, 0), lancado: Math.max(lancado, 0), pago, atrasadas };
  });

  const totAtivas = porTipo.reduce((s, x) => s + x.ativas, 0);
  const totAberto = porTipo.reduce((s, x) => s + x.aberto, 0);
  const totMapear = porTipo.reduce((s, x) => s + x.mapear, 0);
  const totLancado = porTipo.reduce((s, x) => s + x.lancado, 0);
  const totAtrasadas = porTipo.reduce((s, x) => s + x.atrasadas, 0);

  return (
    <>
      <Topbar eyebrow="Operação" title="Painel" />
      <div className="px-8 py-7 max-w-[1220px] w-full">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-7">
          <Kpi icon="doc" value={totAtivas} label="Contas ativas" iconBg="#FFF3D6" iconColor="#B5860A" />
          <Kpi icon="calendar" value={totAberto} label="A lançar em julho" iconBg="#FFF3D6" iconColor="#B5860A" />
          <Kpi icon="hourglass" value={totLancado} label="Aguardando pagamento" iconBg="#E4F1EA" iconColor="#2E7D57" />
          <Kpi icon="alert" value={totAtrasadas} label="Atrasadas" iconBg="#F7E4E2" iconColor="#B23B3B" />
          <Link href="/lojas?status=encerrada" className="block">
            <Kpi icon="pin" value={totalLojasEncerradas ?? 0} label="Lojas encerradas" iconBg="#F7E4E2" iconColor="#B23B3B" />
          </Link>
        </div>

        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="font-disp text-lg font-bold">Situação por tipo de conta</h2>
          <span className="text-xs text-txt-3">julho / 2026 · percentuais sobre o total ativo do tipo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {porTipo.map(({ t, ativas, mapear, aberto, lancado, atrasadas }) => {
            const T = TIPOS[t];
            const base = ativas || 1;
            const pAberto = (aberto / base) * 100;
            const pLancado = (lancado / base) * 100;
            const pAtrasada = (atrasadas / base) * 100;
            return (
              <Link href={`/contas?tipo=${t}`} key={t}
                className="bg-white border border-linha rounded-2xl p-5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition block">
                <div className="flex items-center gap-3.5 mb-1">
                  <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${T.c}20` }}>
                    <span className="w-3 h-3 rounded-full" style={{ background: T.c }} />
                  </div>
                  <div>
                    <div className="font-disp font-bold text-[15px]">{T.n}</div>
                    <div className="font-disp text-2xl font-extrabold tracking-tight -mt-0.5">{ativas}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <BarraLinha cor="#B5860A" label="A lançar" valor={aberto} pct={pAberto} />
                  <BarraLinha cor="#2E7D57" label="Aguardando pagamento" valor={lancado} pct={pLancado} />
                  <BarraLinha cor="#B23B3B" label="Atrasadas" valor={atrasadas} pct={pAtrasada} />
                </div>
                {mapear > 0 && (
                  <div className="mt-3 pt-3 border-t border-linha2 text-[11px] text-alerr font-medium">
                    {mapear} sem origem mapeada
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {(lojasEncerradas ?? []).length > 0 && (
          <>
            <div className="flex items-baseline gap-3 mb-3.5 mt-7">
              <h2 className="font-disp text-lg font-bold">Lojas encerradas recentemente</h2>
              <Link href="/lojas?status=encerrada" className="text-xs text-petroleo hover:underline">ver todas</Link>
            </div>
            <div className="card overflow-hidden">
              <ul>
                {(lojasEncerradas ?? []).map((l: any, i: number) => (
                  <li key={i} className="flex items-center gap-3.5 px-[18px] py-3 border-b border-linha2 last:border-0 text-[13px]">
                    <div className="w-8 h-8 rounded-xl bg-alerr-bg text-alerr grid place-items-center text-[11px] font-bold font-disp shrink-0">
                      {l.coban?.slice(0, 2) ?? "—"}
                    </div>
                    <div className="min-w-0">
                      <b className="font-semibold">{l.codigo}</b>
                      <small className="block text-txt-3 text-[11px] mt-0.5 truncate">
                        {[l.empresa, l.cidade && l.uf ? `${l.cidade}/${l.uf}` : null].filter(Boolean).join(" · ") || "sem dados adicionais"}
                      </small>
                    </div>
                    <span className="ml-auto text-[11px] text-txt-3 font-mono shrink-0">
                      {l.encerrada_em ? new Date(l.encerrada_em).toLocaleDateString("pt-br") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function BarraLinha({ cor, label, valor, pct }: { cor: string; label: string; valor: number; pct: number }) {
  return (
    <div className="flex items-center gap-2.5 text-[11.5px]">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
      <span className="text-txt-2 w-[126px] shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-linha2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
      </div>
      <span className="font-mono text-txt-3 w-6 text-right shrink-0">{valor}</span>
    </div>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  doc: <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  calendar: <><rect x="3.5" y="5" width="15" height="13.5" rx="2" /><path d="M3.5 9.5h15M7 3v3.5M15 3v3.5" /></>,
  hourglass: <><path d="M6 3.5h10M6 18.5h10M6.5 3.5c0 4 3 4.5 3 6.5s-3 2.5-3 6.5M15.5 3.5c0 4-3 4.5-3 6.5s3 2.5 3 6.5" /></>,
  alert: <><path d="M10.9 3.6l7.6 13a1 1 0 01-.9 1.5H2.4a1 1 0 01-.9-1.5l7.6-13a1 1 0 011.8 0z" /><path d="M10 8.5v4M10 15.2v.1" /></>,
  pin: <><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></>,
};

function Kpi({ icon, value, label, iconBg, iconColor }: {
  icon: string; value: number; label: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white border border-linha rounded-2xl p-5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.05)] transition">
      <div className="w-11 h-11 rounded-full grid place-items-center mb-3.5" style={{ background: iconBg }}>
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke={iconColor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          {ICONS[icon]}
        </svg>
      </div>
      <div className="font-disp text-[32px] font-extrabold leading-none tracking-tight">{value}</div>
      <div className="text-[12.5px] text-txt-2 font-medium mt-1.5">{label}</div>
    </div>
  );
}
