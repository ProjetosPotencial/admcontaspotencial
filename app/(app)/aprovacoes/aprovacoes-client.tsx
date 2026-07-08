"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { money } from "@/lib/format";

type Item = {
  id: string;
  valor: number | null;
  situacao: string;
  comprovante_url?: string | null;
  contas: { tipo: string; fornecedor_nome: string | null; eh_rateio: boolean; lojas: { codigo: string; coban: string; cidade: string | null; uf: string | null } | null };
};

export default function AprovacoesClient({ itens }: { itens: Item[] }) {
  const supabase = createClient();
  const [fila, setFila] = useState<Item[]>(itens);
  const [toast, setToast] = useState<string | null>(null);
  const total = itens.length;

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

  async function verBoleto(caminho: string) {
    const { data, error } = await supabase.storage.from("boletos").createSignedUrl(caminho, 300);
    if (error || !data) { setToast("Não foi possível abrir o boleto."); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <>
      <div className="px-8 py-8 border-b border-linha bg-white">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Aprovações</h1>
        <p className="text-[14px] text-[#666] font-medium mt-2.5 flex items-center gap-2">
          Aguardando sua decisão
          <span className="bg-amarelo text-[#1a1a1a] text-[12px] font-semibold rounded px-1.5 leading-5">{fila.length}</span>
          lançados no SIP, prontos para pagamento
        </p>
      </div>

      <div className="px-8 py-6 max-w-[1100px]">
        {fila.length === 0 ? (
          <div className="card">
            <div className="text-center py-16 text-[#999]">
              <div className="w-14 h-14 rounded-full bg-ok-bg text-ok grid place-items-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
              </div>
              <b className="block text-[#1a1a1a] text-base mb-1">Tudo em dia por aqui.</b>
              Nenhum lançamento aguardando aprovação.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {fila.map((item) => {
              const T = TIPOS[item.contas.tipo];
              return (
                <div key={item.id} className="relative bg-white border border-linha rounded-lg shadow-leve hover:shadow-media transition p-5 flex items-center gap-5">
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-amarelo rounded-l-lg" />

                  <div className="w-14 h-14 rounded-full grid place-items-center shrink-0 relative" style={{ background: T?.bg }}>
                    <TipoIcon tipo={item.contas.tipo} size={26} color={T?.c} />
                    {item.contas.eh_rateio && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-linha grid place-items-center text-[11px] font-bold" style={{ color: T?.c }}>÷</span>
                    )}
                  </div>

                  <div className="w-[140px] shrink-0">
                    <div className="text-[12px] font-bold text-[#1a1a1a] uppercase tracking-wide">{T?.n}</div>
                    <div className="text-[13px] text-[#666] font-medium mt-0.5">{item.contas.eh_rateio ? "Conta com rateio" : "Conta de Consumo"}</div>
                  </div>

                  <div className="w-[170px] shrink-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1a1a1a]">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#999" strokeWidth="1.6" className="shrink-0"><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></svg>
                      <span className="truncate">{item.contas.lojas?.codigo}</span>
                    </div>
                    {item.contas.lojas?.cidade && (
                      <div className="text-[12px] text-[#999] mt-0.5 ml-[19px]">{item.contas.lojas.cidade}{item.contas.lojas.uf ? ` - ${item.contas.lojas.uf}` : ""}</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1a1a1a]">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#999" strokeWidth="1.6" className="shrink-0"><rect x="3" y="4" width="14" height="13" rx="1.5" /><path d="M3 8h14" /></svg>
                      <span className="truncate">{item.contas.fornecedor_nome ?? "—"}</span>
                    </div>
                    {item.comprovante_url && (
                      <button onClick={() => verBoleto(item.comprovante_url!)}
                        className="flex items-center gap-1.5 text-[12px] text-info font-semibold mt-1 ml-[19px] hover:underline">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></svg>
                        Ver boleto anexado
                      </button>
                    )}
                  </div>

                  <div className="w-[130px] shrink-0 text-right">
                    <div className="text-[11px] font-medium text-[#999]">Valor</div>
                    <div className="text-[22px] font-bold text-amarelo">{money(item.valor)}</div>
                  </div>

                  <div className="w-[200px] shrink-0 flex gap-2 justify-end">
                    <button onClick={() => decidir(item, true)}
                      className="flex items-center gap-1.5 bg-ok hover:bg-ok-dark text-white rounded-md px-4 py-2.5 text-[13px] font-semibold transition-colors">
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
                      Aprovar
                    </button>
                    <button onClick={() => decidir(item, false)}
                      className="flex items-center gap-1.5 bg-alerr hover:bg-alerr-dark text-white rounded-md px-4 py-2.5 text-[13px] font-semibold transition-colors">
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
                      Recusar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div className="text-center text-[12px] text-[#999] font-medium mt-6">
            Exibindo {fila.length} de {total} aprovações pendentes
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white px-5 py-3 rounded-lg text-[13px] flex items-center gap-2.5 shadow-forte z-50">
          <span className="w-2 h-2 rounded-full bg-amarelo" />{toast}
        </div>
      )}
    </>
  );
}
