"use client";

import { useState } from "react";

export default function TestarSlackButton() {
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  async function testar() {
    setRodando(true);
    setResultado(null);
    setErro(false);
    try {
      const resp = await fetch("/api/notificar-slack/testar", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok || json.error) {
        setErro(true);
        setResultado(json.error ?? "Erro desconhecido.");
      } else if (json.enviado) {
        setResultado(`Enviado! ${json.venceHoje} vencendo hoje, ${json.atrasadas} atrasada(s). Confere o canal do Slack.`);
      } else {
        setResultado("Rodou certinho, mas não tinha nada vencendo ou atrasado hoje — por isso não mandou mensagem.");
      }
    } catch {
      setErro(true);
      setResultado("Não foi possível chamar a rota. Confere se o deploy mais recente já está no ar.");
    }
    setRodando(false);
  }

  return (
    <div className="card p-5">
      <button onClick={testar} disabled={rodando} className="btn-primario disabled:opacity-50">
        {rodando ? "Enviando..." : "Testar agora"}
      </button>
      {resultado && (
        <div className={`mt-3 text-[13px] rounded-md px-3 py-2.5 ${erro ? "bg-alerr-bg text-alerr" : "bg-ok-bg text-ok"}`}>
          {resultado}
        </div>
      )}
    </div>
  );
}
