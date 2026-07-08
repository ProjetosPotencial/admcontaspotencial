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
        <div className="text-center py-16 text-txt-3">
          <div className="w-14 h-14 rounded-full bg-ok-bg text-ok grid place-items-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
          </div>
          <b className="block font-disp text-txt text-base mb-1">Tudo em dia por aqui.</b>
          Nenhum lançamento aguardando aprovação.
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-txt-2 text-sm mb-5">
        Aguardando sua decisão · <span className="inline-flex items-center justify-center bg-amarelo text-ebano font-bold text-xs w-5 h-5 rounded-full align-middle">{fila.length}</span> lançados no SIP, prontos para pagamento
      </p>
      <div className="grid gap-4">
        {fila.map((item) => {
          const T = TIPOS[item.contas.tipo];
          return (
            <div key={item.id} className="bg-white border border-linha rounded-2xl p-5 flex items-center gap-5 border-l-4" style={{ borderLeftColor: "#FFB600" }}>
              <div className="w-14 h-14 rounded-full grid place-items-center shrink-0" style={{ background: `${T?.c}20` }}>
                <span className="font-disp font-extrabold text-lg" style={{ color: T?.c }}>
                  {item.contas.eh_rateio ? "÷" : T?.n.slice(0, 2)}
                </span>
              </div>

              <div className="min-w-0 flex-1 grid grid-cols-[1fr_1fr] gap-4 items-center">
                <div>
                  <div className="font-disp font-extrabold text-[13px] uppercase tracking-wide">{T?.n}</div>
                  <div className="text-[12.5px] text-txt-2 mt-0.5">{item.contas.eh_rateio ? "Conta com rateio" : "Conta de consumo"}</div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold mt-1.5">
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#8a8880" strokeWidth="1.6"><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></svg>
                    {item.contas.lojas?.codigo}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#8a8880" strokeWidth="1.6"><rect x="3" y="4" width="14" height="13" rx="1.5" /><path d="M3 8h14" /></svg>
                    {item.contas.fornecedor_nome ?? "—"}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10.5px] text-txt-3 uppercase tracking-wide font-medium">Valor</div>
                <div className="font-disp text-xl font-extrabold" style={{ color: "#B5860A" }}>{money(item.valor)}</div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button onClick={() => decidir(item, true)}
                  className="flex items-center gap-1.5 bg-ok text-white rounded-xl px-4 py-2.5 text-[12.5px] font-bold hover:brightness-95">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
                  Aprovar
                </button>
                <button onClick={() => decidir(item, false)}
                  className="flex items-center gap-1.5 bg-alerr text-white rounded-xl px-4 py-2.5 text-[12.5px] font-bold hover:brightness-95">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
                  Recusar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ebano text-white px-5 py-3 rounded-xl text-[13px] flex items-center gap-2.5 shadow-lg z-50">
          <span className="w-2 h-2 rounded-full bg-amarelo" />{toast}
        </div>
      )}
    </>
  );
}
