"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { money } from "@/lib/format";

type Item = {
  id: string;
  valor: number | null;
  situacao: string;
  comprovante_url?: string | null;
  comprovante_drive_url?: string | null;
  codigo_barras?: string | null;
  contas: {
    tipo: string; fornecedor_nome: string | null; eh_rateio: boolean;
    lojas: { codigo: string; coban: string; cidade: string | null; uf: string | null; empresas: { nome: string } | null } | null;
  };
};

export default function AprovacoesClient({ itens }: { itens: Item[] }) {
  const supabase = createClient();
  const [fila, setFila] = useState<Item[]>(itens);
  const [toast, setToast] = useState<string | null>(null);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const total = itens.length;

  async function decidir(item: Item, aprovar: boolean) {
    setDecidindo(item.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("lancamentos")
      .update({
        situacao: aprovar ? "aprovado" : "contestado",
        aprovado_em: new Date().toISOString(),
        aprovado_por: user?.id ?? null,
      })
      .eq("id", item.id);
    setDecidindo(null);
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

  function copiarCodigo(codigo: string) {
    navigator.clipboard.writeText(codigo);
    setToast("Código de barras copiado.");
    setTimeout(() => setToast(null), 2000);
  }

  // agrupa por empresa (grupo bancário/correspondente da loja) e, dentro,
  // por loja - assim quem aprova consegue bater tudo de uma empresa de uma
  // vez, em vez de rolar uma lista comprida misturando tudo.
  const porEmpresa = useMemo(() => {
    const grupos = new Map<string, Map<string, Item[]>>();
    for (const item of fila) {
      const empresa = item.contas.lojas?.empresas?.nome ?? "Sem empresa";
      const loja = item.contas.lojas?.codigo ?? "Sem loja";
      if (!grupos.has(empresa)) grupos.set(empresa, new Map());
      const porLoja = grupos.get(empresa)!;
      if (!porLoja.has(loja)) porLoja.set(loja, []);
      porLoja.get(loja)!.push(item);
    }
    return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fila]);

  return (
    <>
      <div className="px-4 sm:px-8 py-6 sm:py-8 border-b border-linha bg-white">
        <h1 className="text-[32px] font-bold text-[#1a1a1a] leading-none">Aprovações</h1>
        <p className="text-[14px] text-[#6c757d] font-medium mt-2.5 flex items-center gap-2 flex-wrap">
          Aguardando sua decisão
          <span className="bg-amarelo text-[#1a1a1a] text-[12px] font-semibold rounded px-1.5 leading-5">{fila.length}</span>
          lançados, prontos para conferência
        </p>
      </div>

      <div className="px-4 sm:px-8 py-4 sm:py-6 max-w-[1400px]">
        {fila.length === 0 ? (
          <div className="card">
            <div className="text-center py-16 text-[#adb5bd]">
              <div className="w-14 h-14 rounded-full bg-ok-bg text-ok grid place-items-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
              </div>
              <b className="block text-[#1a1a1a] text-base mb-1">Tudo em dia por aqui.</b>
              Nenhum lançamento aguardando aprovação.
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {porEmpresa.map(([empresa, porLoja]) => {
              const totalEmpresa = Array.from(porLoja.values()).flat().length;
              return (
                <div key={empresa}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-ebano text-amarelo grid place-items-center text-[11px] font-bold shrink-0">
                      {empresa.slice(0, 2).toUpperCase()}
                    </div>
                    <h2 className="text-[16px] font-bold text-[#1a1a1a]">{empresa}</h2>
                    <span className="badge bg-[#f1f3f5] text-[#6c757d]">{totalEmpresa}</span>
                  </div>

                  <div className="space-y-5 pl-1">
                    {Array.from(porLoja.entries()).map(([loja, itensDaLoja]) => (
                      <div key={loja}>
                        <div className="text-[12.5px] font-semibold text-[#6c757d] mb-2.5 flex items-center gap-1.5">
                          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6"><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></svg>
                          {loja}
                          {itensDaLoja[0]?.contas.lojas?.cidade && (
                            <span className="text-[#adb5bd] font-normal">· {itensDaLoja[0].contas.lojas!.cidade}{itensDaLoja[0].contas.lojas!.uf ? `/${itensDaLoja[0].contas.lojas!.uf}` : ""}</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                          {itensDaLoja.map((item) => {
                            const T = TIPOS[item.contas.tipo];
                            const ocupado = decidindo === item.id;
                            return (
                              <div key={item.id} className="relative bg-white border border-linha rounded-xl shadow-leve hover:shadow-media transition p-4 flex flex-col">
                                <span className="absolute left-0 top-0 right-0 h-1 bg-amarelo rounded-t-xl" />

                                <div className="flex items-center gap-2.5 mb-3">
                                  <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 relative" style={{ background: T?.bg }}>
                                    <TipoIcon tipo={item.contas.tipo} size={18} color={T?.c} />
                                    {item.contas.eh_rateio && (
                                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-linha grid place-items-center text-[9px] font-bold" style={{ color: T?.c }}>÷</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[11.5px] font-bold text-[#1a1a1a] uppercase tracking-wide">{T?.n}</div>
                                    <div className="text-[11.5px] text-[#6c757d] truncate">{item.contas.fornecedor_nome ?? "—"}</div>
                                  </div>
                                </div>

                                {/* valor em destaque - é o dado que mais importa pra conferência */}
                                <div className="text-[24px] font-bold text-amarelo-dark leading-none mb-3">{money(item.valor)}</div>

                                {item.codigo_barras && (
                                  <button onClick={() => copiarCodigo(item.codigo_barras!)}
                                    className="text-left text-[10px] font-mono text-[#6c757d] bg-[#f8f9fa] rounded-md px-2 py-1.5 mb-3 hover:bg-[#f1f3f5] transition break-all leading-snug">
                                    {item.codigo_barras}
                                    <span className="block text-[9px] text-info font-sans font-semibold mt-0.5">toque para copiar</span>
                                  </button>
                                )}

                                <div className="flex items-center gap-3 mb-3.5 text-[11px]">
                                  {item.comprovante_url && (
                                    <button onClick={() => verBoleto(item.comprovante_url!)} className="text-info font-semibold hover:underline">Ver boleto</button>
                                  )}
                                  {item.comprovante_drive_url && (
                                    <a href={item.comprovante_drive_url} target="_blank" rel="noreferrer" className="text-[#6c757d] font-medium hover:underline">Drive</a>
                                  )}
                                </div>

                                <div className="mt-auto flex gap-2">
                                  <button onClick={() => decidir(item, true)} disabled={ocupado}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-ok hover:bg-ok-dark text-white rounded-md py-2 text-[12px] font-semibold transition-colors disabled:opacity-50">
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10.5l3.5 3.5L16 5.5" /></svg>
                                    Aprovar
                                  </button>
                                  <button onClick={() => decidir(item, false)} disabled={ocupado}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-alerr hover:bg-alerr-dark text-white rounded-md py-2 text-[12px] font-semibold transition-colors disabled:opacity-50">
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
                                    Recusar
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div className="text-center text-[12px] text-[#adb5bd] font-medium mt-6">
            Exibindo {fila.length} de {total} aprovações pendentes
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ebano text-white px-5 py-3 rounded-lg text-[13px] flex items-center gap-2.5 shadow-forte z-50">
          <span className="w-2 h-2 rounded-full bg-amarelo" />{toast}
        </div>
      )}
    </>
  );
}
