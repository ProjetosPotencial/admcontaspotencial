"use client";

import { useState } from "react";
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

function CardRelatorio({ titulo, descricao, icone, cor, onBaixar }: { titulo: string; descricao: string; icone: React.ReactNode; cor: string; onBaixar: () => void }) {
  const [estado, setEstado] = useState<"idle" | "baixando" | "ok">("idle");
  function baixar() {
    setEstado("baixando");
    onBaixar();
    setTimeout(() => setEstado("ok"), 400);
    setTimeout(() => setEstado("idle"), 2600);
  }
  return (
    <div className="card p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${cor}14`, color: cor }}>
          {icone}
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-txt">{titulo}</div>
          <div className="text-[12.5px] text-txt-2 mt-0.5">{descricao}</div>
        </div>
      </div>
      <button onClick={baixar} disabled={estado === "baixando"}
        className={`shrink-0 rounded-md px-4 py-2.5 text-[13px] font-medium transition ${estado === "ok" ? "bg-ok text-white" : "btn-primario"}`}>
        {estado === "baixando" ? "Gerando..." : estado === "ok" ? "✓ Baixado" : "Baixar CSV"}
      </button>
    </div>
  );
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
    <div className="grid gap-3">
      <CardRelatorio
        titulo={`Lançamentos de ${ano}`}
        descricao={`${lancamentos.length} lançamentos, com loja, fornecedor e situação`}
        cor="#2A74C4"
        icone={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16.5V9M10 16.5V4M16 16.5V11" /></svg>}
        onBaixar={exportarLancamentos}
      />
      <CardRelatorio
        titulo={`Centros de custo de ${ano}`}
        descricao="Gasto acumulado por loja, do mesmo jeito que aparece no ranking"
        cor="#2E7D32"
        icone={<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 7h6M7 10h6M7 13h3" /></svg>}
        onBaixar={exportarCentrosCusto}
      />
      <p className="text-[12px] text-txt-3 mt-1 px-1">
        Mais relatórios (por fornecedor, por tipo de conta) chegam conforme a necessidade for aparecendo — me avisa se precisar de algum específico.
      </p>
    </div>
  );
}
