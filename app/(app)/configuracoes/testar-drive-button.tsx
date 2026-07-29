"use client";

import { useState } from "react";

type Check = { nome: string; ok: boolean; detalhe: string };

export default function TestarDriveButton() {
  const [rodando, setRodando] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [conta, setConta] = useState<string | null>(null);

  async function testar() {
    setRodando(true);
    setChecks(null);
    setErroGeral(null);
    setConta(null);
    try {
      const resp = await fetch("/api/testar-drive", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok && !json.checks) {
        setErroGeral(json.error ?? "Erro ao testar.");
      } else {
        setChecks(json.checks ?? null);
        setConta(json.contaEmail ?? null);
      }
    } catch {
      setErroGeral("Não foi possível chamar a rota. Confere se o deploy mais recente já está no ar.");
    }
    setRodando(false);
  }

  return (
    <div className="card p-5">
      <button onClick={testar} disabled={rodando} className="btn-primario disabled:opacity-50">
        {rodando ? "Testando..." : "Testar conexão com o Drive"}
      </button>

      {erroGeral && (
        <div className="mt-3 text-[13px] rounded-md px-3 py-2.5 bg-alerr-bg text-alerr">{erroGeral}</div>
      )}

      {conta && (
        <div className="mt-3 text-[13px] rounded-md px-3 py-2.5 bg-info-bg text-info">
          Conectado como <strong>{conta}</strong> — confira se é a conta Google que você espera.
        </div>
      )}

      {checks && (
        <div className="mt-3 border border-linha rounded-lg divide-y divide-linha2">
          {checks.map((c) => (
            <div key={c.nome} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-[#1a1a1a]">{c.nome}</div>
                <div className={`text-[11.5px] break-all ${c.ok ? "text-[#6c757d]" : "text-alerr"}`}>{c.detalhe}</div>
              </div>
              <span className={`text-[13px] shrink-0 ${c.ok ? "text-ok" : "text-alerr"}`}>{c.ok ? "✓" : "✕"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
