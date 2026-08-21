"use client";

import { useState } from "react";
import { TIPOS, type Conta } from "@/lib/types";
import { money } from "@/lib/format";

/**
 * Monta um grupo a partir das contas selecionadas.
 *
 * O total NASCE da soma dos valores por loja, em vez de ser digitado e depois
 * conferido contra a soma. Assim o estado "não bate" simplesmente não existe —
 * e o número na tela é sempre exatamente o que vai ser lançado.
 */
export default function CriarGrupoModal({ contas, ano, mes, onClose, onCriado }: {
  contas: Conta[];
  ano: number;
  mes: number;
  onClose: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipoServico, setTipoServico] = useState("");
  const [fornecedor, setFornecedor] = useState(contas[0]?.fornecedor_nome ?? "");
  const [vencimento, setVencimento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const numero = (s: string) => {
    const n = Number((s ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const total = contas.reduce((s, c) => s + numero(valores[c.id] ?? ""), 0);
  const semValor = contas.filter((c) => (valores[c.id] ?? "").trim() === "").length;

  /** Divide o total igualmente; os centavos da sobra vão na primeira loja. */
  function dividirIgual(totalTexto: string) {
    const alvo = numero(totalTexto);
    if (alvo <= 0) return;
    const base = Math.floor((alvo / contas.length) * 100) / 100;
    const sobra = Math.round((alvo - base * contas.length) * 100) / 100;
    const novo: Record<string, string> = {};
    contas.forEach((c, i) => {
      const v = i === 0 ? base + sobra : base;
      novo[c.id] = v.toFixed(2).replace(".", ",");
    });
    setValores(novo);
  }

  async function criar() {
    setErro(null);
    if (!nome.trim()) { setErro("Dê um nome ao grupo — é como ele aparece no lançamento."); return; }
    if (semValor > 0) { setErro(`Falta informar o valor de ${semValor} ${semValor === 1 ? "loja" : "lojas"}.`); return; }
    if (total <= 0) { setErro("O total do grupo precisa ser maior que zero."); return; }

    setSalvando(true);
    try {
      const resp = await fetch("/api/criar-grupo-contas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome, tipoServico, fornecedor, ano, mes, vencimento, observacao,
          itens: contas.map((c) => ({ contaId: c.id, valor: numero(valores[c.id] ?? "") })),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) { setErro(json.error ?? "Não foi possível criar o grupo."); setSalvando(false); return; }
      onCriado();
    } catch {
      setErro("Não foi possível criar o grupo agora.");
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-forte border border-linha w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-5">
        <div className="text-[16px] font-bold text-[#1a1a1a]">Criar grupo de contas</div>
        <p className="text-[12.5px] text-[#6c757d] mt-1 leading-relaxed">
          As {contas.length} contas viram <b>um lançamento só</b> — uma aprovação, um pagamento.
          O detalhe por loja fica guardado para conferência.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <label className="col-span-2">
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">
              Nome do grupo <span className="text-alerr">*</span>
            </div>
            <input value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="BOX CHIPS — AGOSTO/2026" className="input-padrao w-full" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Tipo de serviço</div>
            <input value={tipoServico} onChange={(e) => setTipoServico(e.target.value)}
              placeholder="Conta conjunta" className="input-padrao w-full text-[12.5px]" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Fornecedor</div>
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}
              className="input-padrao w-full text-[12.5px]" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Competência</div>
            <input value={`${String(mes).padStart(2, "0")}/${ano}`} disabled
              className="input-padrao w-full font-mono bg-off" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Vencimento</div>
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)}
              className="input-padrao w-full" />
          </label>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <label className="flex-1">
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Dividir igualmente a partir de</div>
            <input placeholder="5.000,00" className="input-padrao w-full font-mono"
              onChange={(e) => dividirIgual(e.target.value)} />
          </label>
          <span className="text-[11px] text-[#adb5bd] pb-2.5">atalho — dá pra ajustar loja a loja</span>
        </div>

        <div className="mt-3 border border-linha rounded-lg divide-y divide-linha2">
          {contas.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-[#1a1a1a] truncate">{c.lojas?.codigo ?? "—"}</div>
                <div className="text-[11px] text-[#6c757d] truncate">
                  {TIPOS[c.tipo]?.n ?? c.tipo}{c.fornecedor_nome ? ` · ${c.fornecedor_nome}` : ""}
                </div>
              </div>
              <input value={valores[c.id] ?? ""} placeholder="0,00"
                onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                className="input-padrao w-[110px] font-mono text-right text-[12.5px]" />
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2.5 bg-off">
            <span className="text-[12.5px] font-semibold text-[#1a1a1a]">Total do grupo</span>
            <span className="text-[15px] font-bold font-mono text-[#1a1a1a]">{money(total)}</span>
          </div>
        </div>

        {semValor > 0 && (
          <div className="text-[11.5px] text-amb bg-amb-bg rounded-md px-3 py-2 mt-3">
            Falta o valor de {semValor} {semValor === 1 ? "loja" : "lojas"}.
          </div>
        )}

        <label className="block mt-3">
          <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Observação</div>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2}
            className="input-padrao w-full text-[12.5px]" />
        </label>

        {erro && <div className="text-[11.5px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mt-3">{erro}</div>}

        <div className="flex gap-2 mt-4">
          <button onClick={criar} disabled={salvando} className="btn-primario flex-1 disabled:opacity-50">
            {salvando ? "Criando..." : `Criar grupo · ${money(total)}`}
          </button>
          <button onClick={onClose} className="btn-secundario">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
