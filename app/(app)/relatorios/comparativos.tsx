"use client";

import { useMemo, useState } from "react";
import { TIPOS } from "@/lib/types";
import { money, MES } from "@/lib/format";

type Lanc = {
  ano: number; mes: number; valor: number | null; situacao: string;
  contas: { tipo: string; fornecedor_nome: string | null; lojas: { codigo: string; coban: string } | null };
};

const CORES: Record<string, string> = {
  agua: "#2A74C4", energia: "#E6A600", telefone: "#7B4FC4", aluguel: "#2E7D32",
  iptu: "#C4682A", condominio: "#4AA3A3", custo_geral: "#8A8A8A",
};
const PALETA = ["#E6A600", "#2A74C4", "#2E7D32", "#7B4FC4", "#C4682A", "#4AA3A3", "#8A8A8A"];

function variacao(atual: number, anterior: number) {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

function Seta({ pct }: { pct: number | null }) {
  if (pct === null || Math.abs(pct) < 0.5) return <span className="text-[10.5px] text-[#adb5bd]">—</span>;
  const sobe = pct > 0;
  return (
    <span className={`text-[10.5px] font-semibold ${sobe ? "text-alerr" : "text-ok"}`}>
      {sobe ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Barra horizontal com rótulo, valor e participação */
function BarraLinha({ rotulo, valor, maximo, total, cor, extra }: {
  rotulo: string; valor: number; maximo: number; total: number; cor: string; extra?: React.ReactNode;
}) {
  const larg = maximo > 0 ? (valor / maximo) * 100 : 0;
  const part = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[12.5px] font-medium text-[#1a1a1a] truncate flex-1">{rotulo}</span>
        {extra}
        <span className="text-[10.5px] text-[#adb5bd] font-mono w-[42px] text-right">{part.toFixed(1)}%</span>
        <span className="text-[12px] font-mono font-semibold text-[#1a1a1a] w-[95px] text-right">{money(valor)}</span>
      </div>
      <div className="h-[6px] rounded-full bg-[#f1f3f5] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${larg}%`, background: cor }} />
      </div>
    </div>
  );
}

export default function Comparativos({ lancamentos, ano }: { lancamentos: Lanc[]; ano: number }) {
  const [mesFoco, setMesFoco] = useState<number | "ano">("ano");

  const comValor = useMemo(() => lancamentos.filter((l) => l.valor), [lancamentos]);

  const doPeriodo = useMemo(
    () => (mesFoco === "ano" ? comValor : comValor.filter((l) => l.mes === mesFoco)),
    [comValor, mesFoco]
  );
  const anterior = useMemo(
    () => (mesFoco === "ano" ? [] : comValor.filter((l) => l.mes === (mesFoco as number) - 1)),
    [comValor, mesFoco]
  );

  const soma = (ls: Lanc[]) => ls.reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const total = soma(doPeriodo);
  const totalAnterior = soma(anterior);

  // evolução mês a mês
  const porMes = useMemo(() => {
    const m = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, valor: 0 }));
    comValor.forEach((l) => { m[l.mes - 1].valor += Number(l.valor ?? 0); });
    return m.filter((x) => x.valor > 0);
  }, [comValor]);
  const maxMes = Math.max(...porMes.map((m) => m.valor), 1);

  function agrupar(ls: Lanc[], chave: (l: Lanc) => string | null) {
    const m = new Map<string, number>();
    ls.forEach((l) => {
      const k = chave(l);
      if (!k) return;
      m.set(k, (m.get(k) ?? 0) + Number(l.valor ?? 0));
    });
    return m;
  }

  const porPraca = useMemo(() => agrupar(doPeriodo, (l) => l.contas.lojas?.coban ?? null), [doPeriodo]);
  const pracaAnt = useMemo(() => agrupar(anterior, (l) => l.contas.lojas?.coban ?? null), [anterior]);

  const porTipo = useMemo(() => agrupar(doPeriodo, (l) => l.contas.tipo), [doPeriodo]);
  const tipoAnt = useMemo(() => agrupar(anterior, (l) => l.contas.tipo), [anterior]);

  const porFornecedor = useMemo(() => agrupar(doPeriodo, (l) => l.contas.fornecedor_nome), [doPeriodo]);
  const fornAnt = useMemo(() => agrupar(anterior, (l) => l.contas.fornecedor_nome), [anterior]);

  const porLoja = useMemo(() => agrupar(doPeriodo, (l) => l.contas.lojas?.codigo ?? null), [doPeriodo]);

  const ordenado = (m: Map<string, number>, n = 99) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);

  const rotuloPeriodo = mesFoco === "ano" ? `${ano}` : `${MES[(mesFoco as number) - 1]}/${ano}`;

  return (
    <div className="space-y-4">
      {/* seletor de período */}
      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-[#6c757d] mr-1">Período:</span>
          <button onClick={() => setMesFoco("ano")}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${mesFoco === "ano" ? "bg-amarelo text-[#1a1a1a]" : "bg-[#f1f3f5] text-[#6c757d] hover:bg-[#e9ecef]"}`}>
            Ano todo
          </button>
          {porMes.map((m) => (
            <button key={m.mes} onClick={() => setMesFoco(m.mes)}
              className={`px-2.5 py-1.5 rounded-full text-[12px] font-semibold transition ${mesFoco === m.mes ? "bg-amarelo text-[#1a1a1a]" : "bg-[#f1f3f5] text-[#6c757d] hover:bg-[#e9ecef]"}`}>
              {MES[m.mes - 1]}
            </button>
          ))}
        </div>
        <div className="flex items-baseline gap-3 mt-3.5 pt-3.5 border-t border-linha2">
          <span className="text-[12px] text-[#6c757d]">Total em {rotuloPeriodo}</span>
          <span className="font-disp text-[24px] font-bold text-[#1a1a1a] leading-none">{money(total)}</span>
          {mesFoco !== "ano" && totalAnterior > 0 && (
            <span className="text-[11.5px] text-[#6c757d]">
              vs {MES[(mesFoco as number) - 2]}: <Seta pct={variacao(total, totalAnterior)} />
            </span>
          )}
          <span className="ml-auto text-[11.5px] text-[#adb5bd]">{doPeriodo.length} lançamentos</span>
        </div>
      </div>

      {/* evolução mensal */}
      <div className="card p-4">
        <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-3.5">Evolução do consumo em {ano}</h3>
        <div className="flex items-end gap-1.5 h-[130px]">
          {porMes.map((m) => {
            const h = (m.valor / maxMes) * 100;
            const ativo = mesFoco === m.mes;
            return (
              <button key={m.mes} onClick={() => setMesFoco(ativo ? "ano" : m.mes)}
                className="flex-1 h-full flex flex-col justify-end items-center gap-1 group">
                <span className="text-[9.5px] font-mono text-[#adb5bd] opacity-0 group-hover:opacity-100 transition">
                  {(m.valor / 1000).toFixed(0)}k
                </span>
                <div className="w-full rounded-t-sm transition-all"
                  style={{ height: `${Math.max(h, 2)}%`, background: ativo ? "#E6A600" : "#FFD980" }} />
                <span className={`text-[10px] ${ativo ? "font-bold text-[#1a1a1a]" : "text-[#adb5bd]"}`}>{MES[m.mes - 1]}</span>
              </button>
            );
          })}
          {porMes.length === 0 && <div className="text-[12px] text-[#adb5bd]">Sem lançamentos com valor em {ano}.</div>}
        </div>
      </div>

      {/* praça + tipo lado a lado */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-2">Por praça</h3>
          {ordenado(porPraca).map(([k, v], i) => (
            <BarraLinha key={k} rotulo={k} valor={v} total={total}
              maximo={ordenado(porPraca)[0]?.[1] ?? 1} cor={PALETA[i % PALETA.length]}
              extra={mesFoco !== "ano" ? <Seta pct={variacao(v, pracaAnt.get(k) ?? 0)} /> : undefined} />
          ))}
          {porPraca.size === 0 && <div className="text-[12px] text-[#adb5bd]">Sem dados no período.</div>}
        </div>

        <div className="card p-4">
          <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-2">Por tipo de despesa</h3>
          {ordenado(porTipo).map(([k, v]) => (
            <BarraLinha key={k} rotulo={TIPOS[k]?.n ?? k} valor={v} total={total}
              maximo={ordenado(porTipo)[0]?.[1] ?? 1} cor={CORES[k] ?? "#adb5bd"}
              extra={mesFoco !== "ano" ? <Seta pct={variacao(v, tipoAnt.get(k) ?? 0)} /> : undefined} />
          ))}
          {porTipo.size === 0 && <div className="text-[12px] text-[#adb5bd]">Sem dados no período.</div>}
        </div>
      </div>

      {/* fornecedores + lojas */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-1">Top 10 fornecedores</h3>
          <p className="text-[11.5px] text-[#6c757d] mb-2">onde o dinheiro está indo</p>
          {ordenado(porFornecedor, 10).map(([k, v], i) => (
            <BarraLinha key={k} rotulo={k} valor={v} total={total}
              maximo={ordenado(porFornecedor, 10)[0]?.[1] ?? 1} cor={PALETA[i % PALETA.length]}
              extra={mesFoco !== "ano" ? <Seta pct={variacao(v, fornAnt.get(k) ?? 0)} /> : undefined} />
          ))}
          {porFornecedor.size === 0 && <div className="text-[12px] text-[#adb5bd]">Sem dados no período.</div>}
        </div>

        <div className="card p-4">
          <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-1">Top 10 lojas</h3>
          <p className="text-[11.5px] text-[#6c757d] mb-2">maiores custos de operação</p>
          {ordenado(porLoja, 10).map(([k, v], i) => (
            <BarraLinha key={k} rotulo={k} valor={v} total={total}
              maximo={ordenado(porLoja, 10)[0]?.[1] ?? 1} cor={PALETA[i % PALETA.length]} />
          ))}
          {porLoja.size === 0 && <div className="text-[12px] text-[#adb5bd]">Sem dados no período.</div>}
        </div>
      </div>
    </div>
  );
}
