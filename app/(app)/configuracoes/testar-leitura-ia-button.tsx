"use client";

import { useState } from "react";

export default function TestarLeituraIaButton() {
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<any | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setRodando(true);
    setErro(null);
    setRes(null);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const resp = await fetch("/api/testar-leitura-ia", { method: "POST", body: form });
      const json = await resp.json();
      if (!resp.ok) setErro(json.error ?? "Erro ao ler.");
      else setRes(json);
    } catch {
      setErro("Não foi possível chamar a rota. Confira se o deploy mais recente está no ar.");
    }
    setRodando(false);
    e.target.value = "";
  }

  const ex = res?.extracao;
  const fmt = (v: any) => (v == null || v === "" ? "—" : String(v));

  return (
    <div className="card p-5">
      <label className="btn-primario inline-block cursor-pointer">
        {rodando ? "Lendo..." : "Testar leitura por IA"}
        <input type="file" accept=".pdf,image/*" onChange={onArquivo} disabled={rodando} className="hidden" />
      </label>
      <p className="text-[11.5px] text-[#adb5bd] mt-2">
        Suba uma nota (PDF ou imagem). O sistema lê com a Anthropic (Claude) e mostra o resultado aqui.
      </p>

      {nomeArquivo && !rodando && <div className="mt-3 text-[12px] text-[#6c757d]">Arquivo: <strong>{nomeArquivo}</strong></div>}

      {erro && <div className="mt-3 text-[13px] rounded-md px-3 py-2.5 bg-alerr-bg text-alerr">{erro}</div>}

      {res && ex && (
        <div className="mt-4 space-y-4">
          {/* Leitura principal (Anthropic) */}
          <div>
            <div className="text-[12px] font-semibold text-[#1a1a1a] mb-2">Leitura (Anthropic) · {res.duracao_ms} ms</div>
            {ex._raw_resposta != null && (
              <details className="mb-2">
                <summary className="text-[11px] text-info cursor-pointer">ver resposta bruta da IA (diagnóstico)</summary>
                <pre className="mt-1 text-[10.5px] bg-off rounded-md p-2 whitespace-pre-wrap break-all max-h-48 overflow-auto">{ex._raw_resposta || "(vazio)"}</pre>
              </details>
            )}
            <div className="border border-linha rounded-lg divide-y divide-linha2 text-[12.5px]">
              {[
                ["Classe", fmt(ex.classe_documento)],
                ["Valor", ex.valor != null ? `R$ ${Number(ex.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"],
                ["Fornecedor", fmt(ex.fornecedor)],
                ["CNPJ", fmt(ex.cnpj)],
                ["Nº documento", fmt(ex.numero_documento)],
                ["Chave de acesso", fmt(ex.chave_acesso)],
                ["Destinatário", fmt(ex.destinatario)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-3 py-1.5">
                  <span className="text-[#6c757d]">{k}</span>
                  <span className="font-medium text-right break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
