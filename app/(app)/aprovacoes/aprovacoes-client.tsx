"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS } from "@/lib/types";
import { money } from "@/lib/format";

type Item = {
  id: string;
  valor: number | null;
  situacao: string;
  contas: { tipo: string; fornecedor_nome: string | null; eh_rateio: boolean; lojas: { codigo: string; coban: string } | null };
};

export default function AprovacoesClient({ itens }: { itens: Item[] }) {
  const supabase = createClient();
  const [fila, setFila] = useState<Item[]>(itens);
  const [toast, setToast] = useState<string | null>(null);

  async function decidir(item: Item, aprovar: boolean) {
    const { error } = await supabase
      .from("lancamentos")
      .update({ situacao: aprovar ? "aprovado" : "contestado", aprovado_em: new Date().toISOString() })
      .eq("id", item.id);
    if (error) { setToast("Sem permissão para decidir."); return; }
    setFila((f) => f.filter((x) => x.id !== item.id));
    setToast(`${aprovar ? "Aprovado" : "Recusado"}: ${item.contas.lojas?.codigo}.`);
    setTimeout(() => setToast(null), 2600);
  }

  if (fila.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-14 text-txt-3">
          <b className="block font-disp text-txt-2 text-[15px] mb-1">Tudo em dia por aqui.</b>
          Nenhum lançamento aguardando aprovação.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-baseline gap-3 mb-3.5">
        <h2 className="font-disp text-[15px] font-semibold">Aguardando sua decisão</h2>
        <span className="text-xs text-txt-3">lançados no SIP, prontos para pagamento</span>
      </div>
      <div className="grid gap-3.5">
        {fila.map((item) => {
          const T = TIPOS[item.contas.tipo];
          return (
            <div key={item.id} className="card p-[18px] px-5 flex gap-[18px] items-center">
              <div className="w-[42px] h-[42px] rounded-[11px] grid place-items-center shrink-0 font-disp font-semibold text-white" style={{ background: T?.c }}>
                {item.contas.eh_rateio ? "÷" : "R$"}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] tracking-[1.4px] uppercase font-bold" style={{ color: T?.c }}>
                  {item.contas.eh_rateio ? "Valor com rateio" : "Valor mensal"}
                </div>
                <h4 className="font-disp text-[14.5px] font-semibold my-0.5">
                  {T?.n} · {item.contas.lojas?.codigo}
                </h4>
                <p className="text-[12.5px] text-txt-2 leading-snug">
                  {item.contas.fornecedor_nome} lançou <b className="font-mono text-txt">{money(item.valor)}</b> para julho.
                  {item.contas.eh_rateio ? " Confira o rateio antes de liberar." : " Confira antes de liberar o pagamento."}
                </p>
              </div>
              <div className="ml-auto flex gap-2 shrink-0">
                <button onClick={() => decidir(item, true)} className="bg-petroleo text-white rounded-[9px] px-[15px] py-2.5 text-[12.5px] font-semibold hover:bg-petroleo-dark">Aprovar</button>
                <button onClick={() => decidir(item, false)} className="bg-white border border-linha text-txt-2 rounded-[9px] px-[15px] py-2.5 text-[12.5px] font-semibold hover:border-alerr hover:text-alerr">Recusar</button>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ebano text-white px-5 py-3 rounded-[11px] text-[13px] flex items-center gap-2.5 shadow-lg z-50">
          <span className="w-2 h-2 rounded-full bg-amarelo" />{toast}
        </div>
      )}
    </>
  );
}
