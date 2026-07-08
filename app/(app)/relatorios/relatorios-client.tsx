"use client";

import { TIPOS, SITUACAO } from "@/lib/types";
import { MES } from "@/lib/format";

type Lanc = { ano: number; mes: number; valor: number | null; situacao: string; contas: { tipo: string; fornecedor_nome: string | null; lojas: { codigo: string; coban: string } | null } };
type CC = { valor: number | null; contas: { loja_id: string; lojas: { codigo: string; coban: string } | null } };

function baixarCsv(nome: string, linhas: string[]) {
  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosClient({ lancamentos, centrosCusto, ano }: { lancamentos: Lanc[]; centrosCusto: CC[]; ano: number }) {
  function exportarLancamentos() {
    const linhas = ["mes,loja,praca,tipo,fornecedor,valor,situacao"];
    lancamentos.forEach((l) => {
      linhas.push([
        MES[l.mes - 1], l.contas.lojas?.codigo ?? "", l.contas.lojas?.coban ?? "",
        TIPOS[l.contas.tipo]?.n ?? l.contas.tipo, l.contas.fornecedor_nome ?? "",
        l.valor ?? "", SITUACAO[l.situacao]?.label ?? l.situacao,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    baixarCsv(`lancamentos_${ano}.csv`, linhas);
  }

  function exportarCentrosCusto() {
    const porLoja: Record<string, { codigo: string; coban: string; total: number; qtd: number }> = {};
    centrosCusto.forEach((l) => {
      const lj = l.contas?.lojas; const id = l.contas?.loja_id;
      if (!lj || !id) return;
      if (!porLoja[id]) porLoja[id] = { codigo: lj.codigo, coban: lj.coban, total: 0, qtd: 0 };
      porLoja[id].total += Number(l.valor);
      porLoja[id].qtd += 1;
    });
    const linhas = ["loja,praca,lancamentos,total"];
    Object.values(porLoja).sort((a, b) => b.total - a.total).forEach((r) => {
      linhas.push(`"${r.codigo}","${r.coban}",${r.qtd},${r.total.toFixed(2)}`);
    });
    baixarCsv(`centros_de_custo_${ano}.csv`, linhas);
  }

  return (
    <div className="grid gap-4">
      <div className="card p-5 flex items-center justify-between">
        <div>
          <div className="text-[14px] font-semibold text-[#1a1a1a]">Lançamentos de {ano}</div>
          <div className="text-[12.5px] text-[#6c757d] mt-0.5">{lancamentos.length} lançamentos, com loja, fornecedor e situação</div>
        </div>
        <button onClick={exportarLancamentos} className="btn-primario shrink-0">Baixar CSV</button>
      </div>
      <div className="card p-5 flex items-center justify-between">
        <div>
          <div className="text-[14px] font-semibold text-[#1a1a1a]">Centros de custo de {ano}</div>
          <div className="text-[12.5px] text-[#6c757d] mt-0.5">Gasto acumulado por loja, do mesmo jeito que aparece no ranking</div>
        </div>
        <button onClick={exportarCentrosCusto} className="btn-primario shrink-0">Baixar CSV</button>
      </div>
      <div className="text-[12px] text-[#adb5bd] mt-1">
        Mais relatórios (por fornecedor, por tipo de conta) chegam conforme a necessidade for aparecendo — me avisa se precisar de algum específico.
      </div>
    </div>
  );
}
