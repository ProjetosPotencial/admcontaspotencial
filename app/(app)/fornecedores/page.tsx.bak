import { createClient } from "@/lib/supabase/server";
import FornecedoresClient from "./fornecedores-client";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";
import { obterPeriodoSelecionado } from "@/lib/periodo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const supabase = createClient();
  const { ano, mes } = obterPeriodoSelecionado();

  const [{ data: fornecedores }, { data: contas }, { data: lancMes }] = await Promise.all([
    supabase.from("fornecedores").select("id, nome, tipo_padrao, portal_padrao").order("nome"),
    supabase.from("contas").select("fornecedor_nome, status, tipo").eq("situacao_cadastro", "aprovada"),
    supabase.from("lancamentos").select("valor, contas!inner ( fornecedor_nome )").eq("ano", ano).eq("mes", mes).not("valor", "is", null),
  ]);

  const forns = fornecedores ?? [];
  const nomesComContaAtiva = new Set((contas ?? []).filter((c) => c.status === "ativo").map((c) => c.fornecedor_nome));
  const nomesComContaQualquer = new Set((contas ?? []).map((c) => c.fornecedor_nome));

  const ativos = forns.filter((f) => nomesComContaAtiva.has(f.nome)).length;
  const semPortal = forns.filter((f) => !f.portal_padrao).length;
  const semContaVinculada = forns.filter((f) => !nomesComContaQualquer.has(f.nome)).length;
  const inativos = forns.length - ativos;

  const porTipo: Record<string, number> = {};
  forns.forEach((f) => { if (f.tipo_padrao) porTipo[f.tipo_padrao] = (porTipo[f.tipo_padrao] ?? 0) + 1; });
  const totalComTipo = Object.values(porTipo).reduce((s, v) => s + v, 0) || 1;

  const porValor: Record<string, number> = {};
  (lancMes ?? []).forEach((l: any) => {
    const nome = l.contas?.fornecedor_nome ?? "Não identificado";
    porValor[nome] = (porValor[nome] ?? 0) + Number(l.valor ?? 0);
  });
  const topFornecedores = Object.entries(porValor).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Fornecedores</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">{forns.length} fornecedores cadastrados a partir das contas lançadas</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[1400px]">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div className="min-w-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiMini label="Cadastrados" value={forns.length} cor="#1976d2" bg="#e3f2fd" />
              <KpiMini label="Ativos" value={ativos} sub={`${inativos} inativos`} cor="#2E7D57" bg="#E4F1EA" />
              <KpiMini label="Sem portal definido" value={semPortal} cor="#c9922a" bg="#fdf3e3" />
              <KpiMini label="Sem conta vinculada" value={semContaVinculada} cor="#B23B3B" bg="#F7E4E2" />
            </div>
            <FornecedoresClient fornecedores={forns as any[]} nomesAtivos={Array.from(nomesComContaAtiva)} />
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Distribuição por tipo</h3>
              <div className="space-y-2.5">
                {Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => {
                  const T = TIPOS[tipo];
                  return (
                    <div key={tipo} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: T?.c }} />
                      <span className="text-[#1a1a1a]">{T?.n ?? tipo}</span>
                      <span className="ml-auto font-mono font-semibold">{qtd}</span>
                      <span className="text-[10.5px] text-[#adb5bd] w-9 text-right">{Math.round((qtd / totalComTipo) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Top fornecedores (mês atual)</h3>
              <div className="space-y-3">
                {topFornecedores.map(([nome, valor]) => (
                  <div key={nome} className="flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold text-[#1a1a1a] truncate max-w-[150px]">{nome}</span>
                    <span className="font-mono font-semibold shrink-0">{money(valor)}</span>
                  </div>
                ))}
                {topFornecedores.length === 0 && <div className="text-[12.5px] text-[#adb5bd]">Sem lançamentos com valor este mês.</div>}
              </div>
              <Link href="/lancamentos" className="block text-center mt-4 pt-3 border-t border-linha2 text-[12px] font-semibold text-info hover:underline">Ver lançamentos</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiMini({ label, value, sub, cor, bg }: { label: string; value: number; sub?: string; cor: string; bg: string }) {
  return (
    <div className="bg-white border border-linha rounded-xl p-4 shadow-leve">
      <div className="w-9 h-9 rounded-full grid place-items-center mb-2.5" style={{ background: bg }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
      </div>
      <div className="text-[11.5px] text-[#6c757d] font-medium">{label}</div>
      <div className="text-[22px] font-bold text-[#1a1a1a] leading-none mt-1">{value}</div>
      {sub && <div className="text-[10.5px] text-[#adb5bd] mt-1.5">{sub}</div>}
    </div>
  );
}
