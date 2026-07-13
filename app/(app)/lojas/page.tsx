import { createClient } from "@/lib/supabase/server";
import LojasClient from "./lojas-client";
import type { Loja } from "@/lib/loja-types";

export const dynamic = "force-dynamic";

export default async function LojasPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient();
  const [{ data }, { data: empresas }] = await Promise.all([
    supabase
      .from("lojas")
      .select("id, codigo, coban, tipo_pdv, setor, empresa, empresa_id, cnpj, contrato, endereco, cidade, uf, responsavel, contato, status, encerrada_em, motivo_encerramento")
      .order("codigo"),
    supabase.from("empresas").select("id, nome").eq("ativa", true).order("nome"),
  ]);

  const lojas = (data ?? []) as Loja[];
  const ativas = lojas.filter((l) => l.status === "ativo").length;
  const inativas = lojas.filter((l) => l.status === "inativo").length;
  const encerradas = lojas.filter((l) => l.status === "encerrada").length;
  const cidades = new Set(lojas.filter((l) => l.cidade).map((l) => l.cidade)).size;

  const porPraca: Record<string, number> = {};
  lojas.forEach((l) => { if (l.coban) porPraca[l.coban] = (porPraca[l.coban] ?? 0) + 1; });
  const rankingPraca = Object.entries(porPraca).sort((a, b) => b[1] - a[1]);

  const porEmpresa: Record<string, number> = {};
  lojas.forEach((l) => {
    const nome = empresas?.find((e) => e.id === l.empresa_id)?.nome ?? "Sem empresa";
    porEmpresa[nome] = (porEmpresa[nome] ?? 0) + 1;
  });
  const rankingEmpresa = Object.entries(porEmpresa).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Lojas</h1>
        <p className="text-[14px] text-[#6c757d] mt-2.5">Gerencie todas as lojas e acompanhe seu status e informações.</p>
      </div>
      <div className="px-4 sm:px-8 pb-6 sm:pb-8 max-w-[1500px]">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
          <div className="min-w-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiMini label="Total de lojas" value={lojas.length} cor="#1976d2" bg="#e3f2fd" />
              <KpiMini label="Ativas" value={ativas} sub={`${lojas.length ? Math.round((ativas / lojas.length) * 100) : 0}% do total`} cor="#2E7D57" bg="#E4F1EA" />
              <KpiMini label="Inativas" value={inativas} cor="#c9922a" bg="#fdf3e3" />
              <KpiMini label="Encerradas" value={encerradas} cor="#B23B3B" bg="#F7E4E2" />
            </div>
            <LojasClient lojas={lojas} statusInicial={searchParams.status} empresas={empresas ?? []} />
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Lojas por praça</h3>
              <div className="space-y-2.5">
                {rankingPraca.map(([praca, qtd]) => (
                  <div key={praca} className="flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold text-[#1a1a1a]">{praca}</span>
                    <span className="font-mono font-semibold">{qtd}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Lojas por empresa</h3>
              <div className="space-y-2.5">
                {rankingEmpresa.map(([nome, qtd]) => (
                  <div key={nome} className="flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold text-[#1a1a1a] truncate max-w-[160px]">{nome}</span>
                    <span className="font-mono font-semibold shrink-0">{qtd}</span>
                  </div>
                ))}
              </div>
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
