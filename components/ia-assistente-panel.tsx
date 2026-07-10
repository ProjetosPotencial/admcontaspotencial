"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; texto: string };

const SUGESTOES = [
  "O que está atrasado agora?",
  "Quais contratos vencem esse mês?",
  "Quanto já foi lançado esse mês?",
];

export default function IaAssistentePanel({ compacto = false }: { compacto?: boolean }) {
  const [mensagens, setMensagens] = useState<Msg[]>([
    { role: "assistant", texto: "Olá! Posso consultar contas, lançamentos, contratos, lojas, fornecedores e alertas do sistema. Pergunta o que precisar." },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, enviando]);

  async function enviar(pergunta: string) {
    if (!pergunta.trim() || enviando) return;
    setErro(null);
    const novasMsgs: Msg[] = [...mensagens, { role: "user", texto: pergunta }];
    setMensagens(novasMsgs);
    setTexto("");
    setEnviando(true);

    try {
      const resp = await fetch("/api/ia-assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: novasMsgs.map((m) => ({ role: m.role, content: m.texto })) }),
      });
      const json = await resp.json();
      if (!resp.ok || json.error) {
        setErro(json.error ?? "Erro ao consultar a IA.");
        setMensagens((m) => m.slice(0, -1));
        setTexto(pergunta);
      } else {
        setMensagens((m) => [...m, { role: "assistant", texto: json.resposta }]);
      }
    } catch {
      setErro("Não foi possível falar com a IA agora.");
      setMensagens((m) => m.slice(0, -1));
      setTexto(pergunta);
    }
    setEnviando(false);
  }

  return (
    <div className={`card flex flex-col ${compacto ? "h-full" : "h-[560px]"}`}>
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-linha2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ok" />
        </span>
        <div>
          <div className="text-[13.5px] font-bold text-[#1a1a1a]">Assistente do sistema</div>
          <div className="text-[11px] text-[#6c757d]">Online · vê contas, lançamentos, contratos, lojas e fornecedores</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {mensagens.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] whitespace-pre-wrap ${
              m.role === "user" ? "bg-amarelo text-ebano font-medium" : "bg-[#f1f3f5] text-[#1a1a1a]"
            }`}>
              {m.texto}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="bg-[#f1f3f5] rounded-xl px-3.5 py-2.5 text-[13px] text-[#6c757d]">buscando no sistema...</div>
          </div>
        )}
        {erro && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{erro}</div>}
        <div ref={fimRef} />
      </div>

      {mensagens.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {SUGESTOES.map((s) => (
            <button key={s} onClick={() => enviar(s)} className="text-[11.5px] border border-linha rounded-full px-3 py-1.5 text-[#6c757d] hover:border-amarelo hover:text-[#1a1a1a] transition">
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex items-center gap-2 px-3 py-3 border-t border-linha2 shrink-0">
        <input
          value={texto} onChange={(e) => setTexto(e.target.value)} disabled={enviando}
          placeholder="Digite sua pergunta..."
          className="flex-1 h-10 bg-[#f8f9fa] border border-linha rounded-lg px-3.5 text-[13px] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10 disabled:opacity-60"
        />
        <button type="submit" disabled={enviando || !texto.trim()} className="w-10 h-10 rounded-lg bg-amarelo text-ebano grid place-items-center disabled:opacity-40 hover:bg-amarelo-dark transition shrink-0">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h14M11 4l6 6-6 6" /></svg>
        </button>
      </form>
    </div>
  );
}
