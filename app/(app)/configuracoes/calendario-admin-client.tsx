"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { feriadosNacionais, type Feriado, type RegraVencimento } from "@/lib/calendario";
import { formatarDataSemFuso } from "@/lib/format";

const UFS = ["MG", "SP", "MS", "RJ", "PR", "SC", "RS", "GO", "BA", "CE", "PE", "MA", "MT", "ES", "PB", "RN", "PA", "AM", "DF"];

const REGRAS: { valor: RegraVencimento; rotulo: string; ajuda: string }[] = [
  { valor: "adiar", rotulo: "Adiar", ajuda: "vence no próximo dia útil" },
  { valor: "antecipar", rotulo: "Antecipar", ajuda: "vence no dia útil anterior" },
  { valor: "confirmar", rotulo: "Perguntar", ajuda: "o sistema pede a decisão" },
];

type FeriadoDb = Feriado & { id: string };

export default function CalendarioAdminClient({
  feriados: iniciais, regra: regraInicial, facultativos: facInicial, ano,
}: {
  feriados: FeriadoDb[]; regra: RegraVencimento; facultativos: boolean; ano: number;
}) {
  const supabase = createClient();
  const [feriados, setFeriados] = useState(iniciais);
  const [regra, setRegra] = useState<RegraVencimento>(regraInicial);
  const [facultativos, setFacultativos] = useState(facInicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // formulário de novo feriado
  const [aberto, setAberto] = useState(false);
  const [nData, setNData] = useState("");
  const [nNome, setNNome] = useState("");
  const [nEscopo, setNEscopo] = useState<"estadual" | "municipal" | "empresa">("estadual");
  const [nUf, setNUf] = useState("MG");
  const [nMunicipio, setNMunicipio] = useState("");
  const [nFacult, setNFacult] = useState(false);

  const nacionais = feriadosNacionais(ano).sort((a, b) => a.data.localeCompare(b.data));

  async function salvarConfig(novaRegra: RegraVencimento, novoFac: boolean) {
    setSalvando(true); setAviso(null);
    const { error } = await supabase.from("config_calendario")
      .update({ regra_vencimento: novaRegra, considerar_facultativos: novoFac, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSalvando(false);
    if (error) { setAviso("Só admin pode alterar a regra do calendário."); return; }
    setRegra(novaRegra); setFacultativos(novoFac);
    setAviso("Regra atualizada.");
    setTimeout(() => setAviso(null), 4000);
  }

  async function adicionar() {
    if (!nData || !nNome.trim()) return;
    setSalvando(true); setAviso(null);
    const linha = {
      data: nData, nome: nNome.trim(), escopo: nEscopo,
      uf: nEscopo === "empresa" ? null : nUf,
      municipio: nEscopo === "municipal" ? (nMunicipio.trim() || null) : null,
      facultativo: nFacult,
    };
    const { data, error } = await supabase.from("feriados").insert(linha).select().single();
    setSalvando(false);
    if (error) {
      setAviso(/duplicate|unique/i.test(error.message) ? "Esse feriado já está cadastrado." : "Não foi possível salvar o feriado.");
      return;
    }
    setFeriados((f) => [...f, data as FeriadoDb].sort((a, b) => a.data.localeCompare(b.data)));
    setAberto(false); setNData(""); setNNome(""); setNMunicipio(""); setNFacult(false);
  }

  async function remover(id: string) {
    const { error } = await supabase.from("feriados").delete().eq("id", id);
    if (error) { setAviso("Só admin pode remover feriados."); return; }
    setFeriados((f) => f.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* regra de vencimento */}
      <div>
        <div className="text-[12.5px] font-semibold text-[#1a1a1a] mb-1.5">
          Quando o vencimento cai em fim de semana ou feriado
        </div>
        <div className="flex flex-wrap gap-2">
          {REGRAS.map((r) => (
            <button key={r.valor} onClick={() => salvarConfig(r.valor, facultativos)} disabled={salvando}
              className={`text-left rounded-lg border px-3 py-2 transition disabled:opacity-60 ${
                regra === r.valor ? "border-amarelo bg-amb-bg" : "border-linha bg-white hover:border-[#d5d3cd]"}`}>
              <div className="text-[12.5px] font-semibold text-[#1a1a1a]">{r.rotulo}</div>
              <div className="text-[10.5px] text-[#6c757d]">{r.ajuda}</div>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
          <input type="checkbox" checked={facultativos} disabled={salvando}
            onChange={(e) => salvarConfig(regra, e.target.checked)} className="w-4 h-4" />
          <span className="text-[12.5px] text-[#495057]">
            Tratar ponto facultativo como dia não útil
            <span className="text-[#adb5bd]"> (Carnaval, Corpus Christi)</span>
          </span>
        </label>
      </div>

      {aviso && <div className="text-[12px] text-info bg-info-bg rounded-md px-3 py-2">{aviso}</div>}

      {/* feriados nacionais (automáticos) */}
      <div>
        <div className="text-[12.5px] font-semibold text-[#1a1a1a] mb-1">Feriados nacionais de {ano}</div>
        <p className="text-[11.5px] text-[#6c757d] mb-2">
          Calculados automaticamente, inclusive os móveis. Não precisam ser cadastrados.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {nacionais.map((f) => (
            <span key={f.data + f.nome}
              className={`text-[11px] rounded-full px-2.5 py-1 border ${
                f.facultativo ? "bg-[#f8f9fa] border-linha text-[#8A8A8A]" : "bg-white border-linha text-[#495057]"}`}>
              {formatarDataSemFuso(f.data)} · {f.nome}
              {f.facultativo && <span className="text-[9.5px]"> (facultativo)</span>}
            </span>
          ))}
        </div>
      </div>

      {/* feriados locais */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[12.5px] font-semibold text-[#1a1a1a]">Feriados estaduais, municipais e da empresa</div>
          {!aberto && (
            <button onClick={() => setAberto(true)} className="text-[12px] font-semibold text-info hover:underline">
              + Adicionar
            </button>
          )}
        </div>
        <p className="text-[11.5px] text-[#6c757d] mb-2">
          Cada loja usa só os feriados da própria UF e cidade.
        </p>

        {aberto && (
          <div className="border border-linha rounded-lg p-3 mb-3 bg-[#fcfcfb]">
            <div className="grid sm:grid-cols-2 gap-2">
              <label>
                <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Data</div>
                <input type="date" value={nData} onChange={(e) => setNData(e.target.value)}
                  className="w-full h-9 border border-linha rounded-md px-2 text-[12.5px]" />
              </label>
              <label>
                <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Nome</div>
                <input value={nNome} onChange={(e) => setNNome(e.target.value)} placeholder="Ex.: Aniversário da cidade"
                  className="w-full h-9 border border-linha rounded-md px-2 text-[12.5px]" />
              </label>
              <label>
                <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Abrangência</div>
                <select value={nEscopo} onChange={(e) => setNEscopo(e.target.value as any)}
                  className="w-full h-9 border border-linha rounded-md px-2 text-[12.5px]">
                  <option value="estadual">Estadual</option>
                  <option value="municipal">Municipal</option>
                  <option value="empresa">Interno da empresa</option>
                </select>
              </label>
              {nEscopo !== "empresa" && (
                <label>
                  <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Estado</div>
                  <select value={nUf} onChange={(e) => setNUf(e.target.value)}
                    className="w-full h-9 border border-linha rounded-md px-2 text-[12.5px]">
                    {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              )}
              {nEscopo === "municipal" && (
                <label className="sm:col-span-2">
                  <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Cidade</div>
                  <input value={nMunicipio} onChange={(e) => setNMunicipio(e.target.value)}
                    placeholder="Exatamente como está no cadastro da loja"
                    className="w-full h-9 border border-linha rounded-md px-2 text-[12.5px]" />
                </label>
              )}
            </div>
            <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
              <input type="checkbox" checked={nFacult} onChange={(e) => setNFacult(e.target.checked)} className="w-4 h-4" />
              <span className="text-[12px] text-[#495057]">É ponto facultativo</span>
            </label>
            <div className="flex gap-2 mt-3">
              <button onClick={adicionar} disabled={!nData || !nNome.trim() || salvando}
                className="btn-primario flex-1 disabled:opacity-50">
                {salvando ? "Salvando..." : "Adicionar feriado"}
              </button>
              <button onClick={() => setAberto(false)} className="btn-secundario">Cancelar</button>
            </div>
          </div>
        )}

        {feriados.length === 0 && !aberto && (
          <div className="text-[12px] text-[#adb5bd]">Nenhum feriado local cadastrado ainda.</div>
        )}
        {feriados.map((f) => (
          <div key={f.id} className="flex items-center gap-2.5 py-2 border-b border-linha2 last:border-0 text-[12.5px]">
            <span className="font-mono text-[11.5px] text-[#6c757d] shrink-0 w-[76px]">{formatarDataSemFuso(f.data)}</span>
            <span className="font-medium truncate flex-1">{f.nome}</span>
            <span className="text-[10.5px] text-[#6c757d] bg-[#f1f3f5] rounded-full px-2 py-0.5 shrink-0">
              {f.escopo === "estadual" ? f.uf : f.escopo === "municipal" ? `${f.municipio} / ${f.uf}` : "empresa"}
            </span>
            {f.facultativo && <span className="text-[10px] text-[#adb5bd] shrink-0">facultativo</span>}
            <button onClick={() => remover(f.id)} title="Remover"
              className="text-[#adb5bd] hover:text-alerr transition shrink-0">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m2 0v10.5A1.5 1.5 0 0112.5 18h-5A1.5 1.5 0 016 16.5V6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
