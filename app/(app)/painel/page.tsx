import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/topbar";
import { TIPOS } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ANO = 2026;
const MES_ATUAL = 7;

export default async function PainelPage() {
  const supabase = createClient();

  const [
    { data: contas },
    { data: lancJul },
    { data: lojasEncerradas },
    { count: totalLojasEncerradas },
  ] = await Promise.all([
    supabase
      .from("contas")
      .select("id, tipo, status, origem, dia_vencimento")
      .eq("situacao_cadastro", "aprovada"),
    supabase
      .from("lancamentos")
      .select("conta_id, situacao, contas!inner(tipo, dia_vencimento)")
      .eq("ano", ANO)
      .eq("mes", MES_ATUAL),
    supabase
      .from("lojas")
      .select("codigo, coban, empresa, cidade, uf, encerrada_em")
      .eq("status", "encerrada")
      .order("encerrada_em", { ascending: false })
      .limit(6),
    supabase
      .from("lojas")
      .select("id", { count: "exact", head: true })
      .eq("status", "encerrada"),
  ]);

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
    const abertoTotal = lanc.filter((l) => l.situacao === "pendente").length;
    const lancadoTotal = lanc.filter((l) => l.situacao === "lancado").length;
    const aberto = abertoTotal - lanc.filter((l: any) => l.situacao === "pendente" && estaAtrasada(l.situacao, l.contas?.dia_vencimento)).length;
    const lancado = lancadoTotal - lanc.filter((l: any) => l.situacao === "lancado" && estaAtrasada(l.situacao, l.contas?.dia_vencimento)).length;
    return { t, ativas, mapear, aberto: Math.max(aberto, 0), lancado: Math.max(lancado, 0), atrasadas };
  });

  const totAtivas = porTipo.reduce((s, x) => s + x.ativas, 0);
  const totAberto = porTipo.reduce((s, x) => s + x.aberto, 0);
  const totLancado = porTipo.reduce((s, x) => s + x.lancado, 0);
  const totMapear = porTipo.reduce((s, x) => s + x.mapear, 0);

  return (
    <>
      <Topbar title="Painel" />
      <div className="px-8 py-8 max-w-[1240px] w-full">
        {/* KPIs - grid 4 colunas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <KpiCard icon="doc" value={totAtivas} label="Contas ativas" variacao={null} />
          <KpiCard icon="calendar" value={totAberto} label="A lançar em julho" variacao={null} />
          <KpiCard icon="hourglass" value={totLancado} label="Aguardando pagamento" variacao={null} />
          <KpiCard icon="pin" value={totMapear} label="Origem a mapear" variacao={null} />
        </div>

        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-[20px] font-semibold text-[#1a1a1a]">Situação por tipo de conta</h2>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#999" strokeWidth="1.6"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.7v.1" /></svg>
          <span className="ml-auto text-[13px] text-[#666] flex items-center gap-1.5 border border-linha rounded-md px-3 py-1.5 bg-white">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#666" strokeWidth="1.6"><rect x="3.5" y="5" width="13" height="12" rx="1.5" /><path d="M3.5 8.5h13" /></svg>
            Este mês (Julho/2026)
          </span>
        </div>

        {/* grid 2 linhas x 3 colunas (7 tipos, o ultimo quebra pra proxima linha) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {porTipo.map(({ t, ativas, mapear, aberto, lancado, atrasadas }) => {
            const T = TIPOS[t];
            const base = ativas || 1;
            return (
              <Link href={`/contas?tipo=${t}`} key={t}
                className="bg-white border border-linha rounded-lg p-6 shadow-leve hover:shadow-media transition block">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-lg grid place-items-center shrink-0" style={{ background: T.bg }}>
                    <span className="w-3.5 h-3.5 rounded-full" style={{ background: T.c }} />
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold text-[#1a1a1a] leading-tight">{T.n}</div>
                    <div className="text-[28px] font-bold text-[#1a1a1a] leading-tight">{ativas}</div>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <LinhaProgresso cor="#FFC107" label="A lançar" valor={aberto} base={base} />
                  <LinhaProgresso cor="#4caf50" label="Aguardando pagamento" valor={lancado} base={base} />
                  <LinhaProgresso cor="#f44336" label="Atrasadas" valor={atrasadas} base={base} />
                </div>
                {mapear > 0 && (
                  <div className="mt-3 pt-3 border-t border-linha2 text-[11px] text-alerr font-medium">{mapear} sem origem mapeada</div>
                )}
              </Link>
            );
          })}
        </div>

        {(lojasEncerradas ?? []).length > 0 && (
          <>
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-[20px] font-semibold text-[#1a1a1a]">Lojas encerradas recentemente</h2>
              <Link href="/lojas?status=encerrada" className="text-xs text-[#1976d2] hover:underline">ver todas</Link>
            </div>
            <div className="card overflow-hidden">
              <ul>
                {(lojasEncerradas ?? []).map((l: any, i: number) => (
                  <li key={i} className="flex items-center gap-3.5 px-5 py-3 border-b border-linha2 last:border-0 text-[13px]">
                    <div className="w-8 h-8 rounded-lg bg-alerr-bg text-alerr grid place-items-center text-[11px] font-bold shrink-0">
                      {l.coban?.slice(0, 2) ?? "—"}
                    </div>
                    <div className="min-w-0">
                      <b className="font-semibold">{l.codigo}</b>
                      <small className="block text-[#999] text-[11px] mt-0.5 truncate">
                        {[l.empresa, l.cidade && l.uf ? `${l.cidade}/${l.uf}` : null].filter(Boolean).join(" · ") || "sem dados adicionais"}
                      </small>
                    </div>
                    <span className="ml-auto text-[11px] text-[#999] font-mono shrink-0">
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

function LinhaProgresso({ cor, label, valor, base }: { cor: string; label: string; valor: number; base: number }) {
  const pct = Math.round((valor / base) * 100);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
        <span className="text-[12px] text-[#666] font-medium">{label}</span>
        <span className="ml-auto text-[12px] font-semibold text-[#1a1a1a]">{valor}</span>
        <span className="text-[12px] text-[#999]">({pct}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
      </div>
    </div>
  );
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  doc: <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  calendar: <><rect x="3.5" y="5" width="15" height="13.5" rx="2" /><path d="M3.5 9.5h15M7 3v3.5M15 3v3.5" /></>,
  hourglass: <><path d="M6 3.5h10M6 18.5h10M6.5 3.5c0 4 3 4.5 3 6.5s-3 2.5-3 6.5M15.5 3.5c0 4-3 4.5-3 6.5s3 2.5 3 6.5" /></>,
  pin: <><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></>,
};

function KpiCard({ icon, value, label, variacao }: { icon: string; value: number; label: string; variacao: number | null }) {
  return (
    <div className="relative bg-white border border-linha rounded-lg p-6 shadow-leve overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-amarelo" />
      <div className="w-12 h-12 rounded-lg grid place-items-center mb-4" style={{ background: "#fff3cd" }}>
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="#999" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{KPI_ICONS[icon]}</svg>
      </div>
      <div className="text-[40px] font-bold text-[#1a1a1a] leading-none">{value}</div>
      <div className="text-[13px] text-[#666] font-medium mt-2">{label}</div>
      {variacao !== null && (
        <div className={`text-[12px] font-medium mt-1.5 flex items-center gap-1 ${variacao > 0 ? "text-ok" : variacao < 0 ? "text-alerr" : "text-[#999]"}`}>
          {variacao > 0 ? "↑" : variacao < 0 ? "↓" : "—"} {Math.abs(variacao)}% <span className="text-[#999] font-normal">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
}
