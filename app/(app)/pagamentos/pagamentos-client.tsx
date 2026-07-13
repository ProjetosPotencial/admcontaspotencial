"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIPOS } from "@/lib/types";
import TipoIcon from "@/components/tipo-icon";
import { money } from "@/lib/format";

type Item = {
  id: string; valor: number | null; situacao: string; forma_pagamento?: string | null; pago_em?: string | null;
  contas: { tipo: string; fornecedor_nome: string | null; lojas: { codigo: string; coban: string } | null };
};

const FORMAS = [
  { valor: "pix", label: "PIX" },
  { valor: "boleto", label: "Boleto" },
  { valor: "debito", label: "Débito" },
  { valor: "transferencia", label: "Transferência" },
];

export default function PagamentosClient({ prontosPagar: prontosIniciais, pagos }: { prontosPagar: Item[]; pagos: Item[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [prontos, setProntos] = useState(prontosIniciais);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [formaEscolhida, setFormaEscolhida] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  async function marcarPago(item: Item) {
    const forma = formaEscolhida[item.id];
    if (!forma) return;
    setMarcando(item.id);
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("lancamentos").update({
      situacao: "pago", forma_pagamento: forma, pago_em: new Date().toISOString(), pago_por: user?.id ?? null,
    }).eq("id", item.id);
    setMarcando(null);
    if (error) { setErro(`Não foi possível marcar como pago: ${error.message}`); return; }
    setProntos((p) => p.filter((x) => x.id !== item.id));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-[16px] font-semibold text-[#1a1a1a]">Prontos para pagamento</h2>
          <span className="text-[13px] text-[#adb5bd]">{prontos.length} · {money(prontos.reduce((s, i) => s + Number(i.valor ?? 0), 0))}</span>
        </div>
        {erro && <div className="text-[12.5px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">{erro}</div>}
        <div className="card divide-y divide-[#f1f3f5]">
          {prontos.map((i) => {
            const T = TIPOS[i.contas.tipo];
            return (
              <div key={i.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 text-[13px]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TipoIcon tipo={i.contas.tipo} size={16} color={T?.c} />
                  <b className="font-semibold shrink-0">{i.contas.lojas?.codigo}</b>
                  <span className="text-[#6c757d] truncate">{i.contas.fornecedor_nome ?? "—"}</span>
                  <span className="ml-auto sm:hidden font-mono font-semibold shrink-0">{money(i.valor)}</span>
                </div>
                <span className="hidden sm:inline sm:ml-auto font-mono font-semibold shrink-0">{money(i.valor)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={formaEscolhida[i.id] ?? ""} onChange={(e) => setFormaEscolhida((f) => ({ ...f, [i.id]: e.target.value }))}
                    className="flex-1 sm:flex-initial border border-linha rounded-md px-2 py-1.5 text-[12px]">
                    <option value="">Forma de pagamento...</option>
                    {FORMAS.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
                  </select>
                  <button onClick={() => marcarPago(i)} disabled={!formaEscolhida[i.id] || marcando === i.id}
                    className="shrink-0 bg-ok hover:bg-ok-dark text-white rounded-md px-3.5 py-1.5 text-[12px] font-semibold disabled:opacity-40 transition-colors">
                    {marcando === i.id ? "Salvando..." : "Marcar pago"}
                  </button>
                </div>
              </div>
            );
          })}
          {prontos.length === 0 && <div className="text-center py-10 text-[#adb5bd] text-[13px]">Nada aprovado aguardando pagamento agora.</div>}
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-[16px] font-semibold text-[#1a1a1a]">Pagos</h2>
          <span className="text-[13px] text-[#adb5bd]">{pagos.length}</span>
        </div>
        <div className="card divide-y divide-[#f1f3f5]">
          {pagos.map((i) => {
            const T = TIPOS[i.contas.tipo];
            return (
              <div key={i.id} className="flex items-center gap-3 px-5 py-3 text-[13px] flex-wrap">
                <TipoIcon tipo={i.contas.tipo} size={16} color={T?.c} />
                <b className="font-semibold">{i.contas.lojas?.codigo}</b>
                <span className="text-[#6c757d]">{i.contas.fornecedor_nome ?? "—"}</span>
                {i.forma_pagamento && <span className="badge bg-info-bg text-info">{FORMAS.find((f) => f.valor === i.forma_pagamento)?.label ?? i.forma_pagamento}</span>}
                <span className="ml-auto font-mono font-semibold">{money(i.valor)}</span>
                <span className="badge bg-ok-bg text-ok">Pago</span>
              </div>
            );
          })}
          {pagos.length === 0 && <div className="text-center py-10 text-[#adb5bd] text-[13px]">Nenhum pagamento registrado ainda.</div>}
        </div>
      </section>
    </div>
  );
}
