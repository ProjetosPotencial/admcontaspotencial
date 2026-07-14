"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIPOS, ORIGENS, SITUACAO, type Conta, type Lancamento } from "@/lib/types";
import { CAMPOS_TIPO } from "@/lib/campos-tipo";
import { useContaForm } from "@/lib/hooks/useContaForm";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { obterPeriodoAtual, formatarPeriodo } from "@/lib/date-utils";
import TipoIcon from "@/components/tipo-icon";
import { money, MES, nomeArquivoSeguro } from "@/lib/format";

function StatusBadge({ status }: { status: string }) {
  if (status === "encerrado") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  if (status === "inativo") return <span className="badge bg-[#f1f3f5] text-[#adb5bd]">Inativa</span>;
  return <span className="badge bg-ok-bg text-ok">Ativa</span>;
}

function VencimentoCell({ dia, ano, mes }: { dia: number | null; ano: number; mes: number }) {
  if (!dia) return <span className="text-[13px] text-[#adb5bd]">—</span>;
  const diaAtual = new Date().getDate();
  const diff = dia - diaAtual;
  const dataFormatada = new Date(ano, mes - 1, dia).toLocaleDateString("pt-br");

  let label: string; let cor: string;
  if (diff < 0) { label = "Atrasada"; cor = "text-alerr"; }
  else if (diff === 0) { label = "Hoje"; cor = "text-alerr"; }
  else if (diff === 1) { label = "Amanhã"; cor = "text-amb"; }
  else if (diff <= 7) { label = `${diff} dias`; cor = "text-amb"; }
  else { label = `${diff} dias`; cor = "text-ok"; }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${diff < 0 || diff === 0 ? "bg-alerr" : diff <= 7 ? "bg-amb" : "bg-ok"}`} />
      <div>
        <div className={`text-[12.5px] font-semibold ${cor}`}>{label}</div>
        <div className="text-[11px] text-[#adb5bd] font-mono">{dataFormatada}</div>
      </div>
    </div>
  );
}

export default function ContasClient({ contas, situacaoPorConta, lojas, ano, mes }: {
  contas: Conta[]; situacaoPorConta: Record<string, string>; lojas: { id: string; codigo: string }[]; ano: number; mes: number;
}) {
  const params = useSearchParams();
  const [fTipo, setFTipo] = useState<string>(params.get("tipo") ?? "todos");
  const [fCoban, setFCoban] = useState("todos");
  const [fStatus, setFStatus] = useState(params.get("status") ?? "todos");
  const [fSituacao, setFSituacao] = useState(params.get("situacao") ?? "todos");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 250);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);
  const [aberta, setAberta] = useState<Conta | null>(null);
  const [criando, setCriando] = useState(false);

  // abre direto a conta específica quando a URL vem com ?conta=id (ex.: um
  // clique em "atrasada" no Painel ou em Alertas) - sem isso, a pessoa cai
  // numa lista de centenas de contas e precisa procurar a certa na mão.
  useEffect(() => {
    const contaId = params.get("conta");
    if (contaId) {
      const encontrada = contas.find((c) => c.id === contaId);
      if (encontrada) setAberta(encontrada);
    }
  }, [params, contas]);

  const filtradas = useMemo(() => {
    return contas.filter((c) => {
      const t = fTipo === "todos" || c.tipo === fTipo;
      const cb = fCoban === "todos" || c.lojas?.coban === fCoban;
      const st = fStatus === "todos" || c.status === fStatus;
      const si = fSituacao === "todos" || (situacaoPorConta[c.id] ?? "pendente") === fSituacao;
      const q =
        buscaDebounced === "" ||
        (c.lojas?.codigo ?? "").toLowerCase().includes(buscaDebounced.toLowerCase()) ||
        (c.fornecedor_nome ?? "").toLowerCase().includes(buscaDebounced.toLowerCase());
      return t && cb && st && si && q;
    });
  }, [contas, fTipo, fCoban, fStatus, fSituacao, buscaDebounced, situacaoPorConta]);

  useEffect(() => { setPagina(1); }, [fTipo, fCoban, fStatus, fSituacao, buscaDebounced]);

  const totalPaginas = Math.max(Math.ceil(filtradas.length / itensPorPagina), 1);
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const visiveis = filtradas.slice(inicio, inicio + itensPorPagina);

  const limparFiltros = () => { setFTipo("todos"); setFCoban("todos"); setFStatus("todos"); setFSituacao("todos"); setBusca(""); };
  const temFiltro = fTipo !== "todos" || fCoban !== "todos" || fStatus !== "todos" || fSituacao !== "todos" || busca !== "";
  const chips = ["todos", ...Object.keys(TIPOS)];

  return (
    <>
      {/* Seção de filtros */}
      <div className="bg-white border border-linha rounded-xl p-6 mb-6 shadow-leve">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[20px] font-semibold text-[#1a1a1a]">Filtrar contas</h2>
          <button onClick={() => setCriando(true)}
            className="flex items-center gap-1.5 bg-amarelo hover:bg-amarelo-dark text-[#1a1a1a] font-semibold text-[13px] px-4 py-2.5 rounded-md transition-colors">
            <span className="text-base leading-none">+</span> Nova conta
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 mb-4">
          {chips.map((t) => (
            <button key={t} onClick={() => setFTipo(t)}
              className={`px-4 py-2 rounded-full text-[13px] border transition ${
                fTipo === t ? "bg-amarelo text-[#1a1a1a] border-amarelo font-semibold" : "bg-[#f1f3f5] text-[#1a1a1a] border-linha font-medium hover:bg-white"
              }`}>
              {t === "todos" ? "Todos os tipos" : TIPOS[t].n}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por fornecedor, loja ou código..."
              className="w-full h-10 bg-[#f8f9fa] border border-linha rounded-md pl-10 pr-3 text-[13px] focus:outline-none focus:border-amarelo focus:ring-[3px] focus:ring-amarelo/10" />
          </div>
          <select value={fCoban} onChange={(e) => setFCoban(e.target.value)}
            className="h-10 bg-white border border-linha rounded-md px-3 text-[13px] text-[#1a1a1a] min-w-[150px]">
            <option value="todos">Todas as lojas</option>
            <option>MG</option><option>MS</option><option>SP</option>
            <option value="QUIOSQUE">Quiosque</option><option value="CORP">Corporativo</option>
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
            className="h-10 bg-white border border-linha rounded-md px-3 text-[13px] text-[#1a1a1a] min-w-[150px]">
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativa</option><option value="inativo">Inativa</option><option value="encerrado">Encerrada</option>
          </select>
          <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)}
            className="h-10 bg-white border border-linha rounded-md px-3 text-[13px] text-[#1a1a1a] min-w-[170px]">
            <option value="todos">Qualquer situação</option>
            <option value="pendente">Em aberto</option><option value="lancado">Aguardando pagamento</option><option value="pago">Pagas</option>
          </select>
          {temFiltro && (
            <button onClick={limparFiltros} className="flex items-center gap-1.5 text-[13px] text-[#6c757d] hover:text-alerr font-medium">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" /></svg>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-linha rounded-xl overflow-hidden shadow-leve">
        <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#f1f3f5] h-12">
              {["Loja", "Tipo", "Fornecedor", "Venc.", "Origem", "Status", ""].map((h) => (
                <th key={h} className="text-left text-[12px] font-semibold text-[#1a1a1a] px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr key={c.id} onClick={() => setAberta(c)} className="h-14 cursor-pointer border-b border-[#f1f3f5] last:border-0 hover:bg-[#f8f9fa] transition group relative">
                <td className="px-4 text-[13px] font-medium relative">
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-amarelo opacity-0 group-hover:opacity-100 transition" />
                  {c.lojas?.codigo ?? "—"}
                  <small className="block text-[#adb5bd] text-[11px] font-mono">{c.lojas?.coban}</small>
                </td>
                <td className="px-4 text-[13px] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <TipoIcon tipo={c.tipo} size={15} color={TIPOS[c.tipo]?.c} />
                    {TIPOS[c.tipo]?.n}
                  </span>
                </td>
                <td className="px-4 text-[13px] font-medium">
                  {c.fornecedor_nome ?? "—"}
                  {c.eh_rateio && <span className="text-[10px] font-mono text-amb border border-amarelo rounded px-1 ml-1.5">RATEIO</span>}
                </td>
                <td className="px-4"><VencimentoCell dia={c.dia_vencimento} ano={ano} mes={mes} /></td>
                <td className="px-4 text-[13px]"><span className="badge bg-info-bg text-info">{ORIGENS[c.origem]}</span></td>
                <td className="px-4 text-[13px]"><StatusBadge status={c.status} /></td>
                <td className="px-4 text-right">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#adb5bd" strokeWidth="1.6" className="inline group-hover:stroke-amarelo"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="text-center py-14 text-[#adb5bd]">Nenhuma conta com esses filtros.</td></tr>
            )}
          </tbody>
        </table></div>

        {/* paginação real - evita renderizar as 450 linhas de uma vez */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-linha2 flex-wrap gap-3">
          <span className="text-[12px] text-[#6c757d]">
            Mostrando {filtradas.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + itensPorPagina, filtradas.length)} de {filtradas.length} contas
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPagina((p) => Math.max(p - 1, 1))} disabled={paginaSegura === 1}
              className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">‹</button>
            <span className="text-[12.5px] text-[#1a1a1a] font-semibold px-2">{paginaSegura} / {totalPaginas}</span>
            <button onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))} disabled={paginaSegura === totalPaginas}
              className="w-8 h-8 rounded-md border border-linha text-[#6c757d] disabled:opacity-40 hover:bg-off">›</button>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#6c757d]">
            Por página
            <select value={itensPorPagina} onChange={(e) => { setItensPorPagina(Number(e.target.value)); setPagina(1); }}
              className="border border-linha rounded-md px-2 py-1.5 text-[12.5px]">
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      {aberta && <ContaDrawer conta={aberta} onClose={() => setAberta(null)} />}
      {criando && <NovaContaDrawer lojas={lojas} onClose={() => setCriando(false)} />}
    </>
  );
}

function ContaDrawer({ conta, onClose }: { conta: Conta; onClose: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const T = TIPOS[conta.tipo];
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [login, setLogin] = useState<string | null>(null);
  const [senha, setSenha] = useState<string | null>(null);
  const [revelando, setRevelando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editandoCred, setEditandoCred] = useState(false);
  const [novoLogin, setNovoLogin] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [salvandoCred, setSalvandoCred] = useState(false);
  const [lancando, setLancando] = useState(false);
  const [valorLancar, setValorLancar] = useState("");
  const [arquivoBoleto, setArquivoBoleto] = useState<File | null>(null);
  const [enviarDrive, setEnviarDrive] = useState(false);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [avisoExtracao, setAvisoExtracao] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [confirmarMesmoAssim, setConfirmarMesmoAssim] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);
  const [erroLancamento, setErroLancamento] = useState<string | null>(null);

  const { ano: ANO_ATUAL, mes: MES_ATUAL } = obterPeriodoAtual();

  const [aprovadorNome, setAprovadorNome] = useState<string | null>(null);

  function carregarLancamentos() {
    supabase.from("lancamentos").select("id, ano, mes, valor, situacao, comprovante_url, comprovante_drive_url, aprovado_por, aprovado_em")
      .eq("conta_id", conta.id).eq("ano", ANO_ATUAL)
      .then(({ data }) => setLancs((data ?? []) as Lancamento[]));
  }

  useEffect(() => {
    carregarLancamentos();
    supabase.from("credenciais_login").select("login").eq("conta_id", conta.id).maybeSingle()
      .then(({ data }) => setLogin((data as any)?.login ?? null));
  }, [conta.id]);

  const lancamentoAtual = lancs.find((l) => l.mes === MES_ATUAL);

  useEffect(() => {
    const idAprovador = (lancamentoAtual as any)?.aprovado_por;
    if (!idAprovador) { setAprovadorNome(null); return; }
    supabase.from("perfis").select("nome").eq("id", idAprovador).maybeSingle()
      .then(({ data }) => setAprovadorNome(data?.nome ?? null));
  }, [(lancamentoAtual as any)?.aprovado_por]);

  async function revelar() {
    setRevelando(true);
    const { data, error } = await supabase.rpc("credencial_ler", { p_conta_id: conta.id, p_motivo: "consulta de fatura" });
    setRevelando(false);
    if (error) { setAviso("Sem permissão ou credencial não encontrada."); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setLogin(row?.login ?? login);
    setSenha(row?.senha ?? "(vazia)");
    setAviso("Acesso registrado no log de auditoria.");
  }

  async function salvarCredencial() {
    setSalvandoCred(true);
    const { error } = await supabase.rpc("credencial_salvar", {
      p_conta_id: conta.id, p_login: novoLogin.trim() || null, p_senha: novaSenha.trim() || null,
    });
    setSalvandoCred(false);
    if (error) { setAviso("Sem permissão para editar credencial."); return; }
    setLogin(novoLogin.trim() || login);
    setSenha(null);
    setEditandoCred(false);
    setAviso("Credencial atualizada.");
  }

  async function selecionarArquivo(arquivo: File | null) {
    setArquivoBoleto(arquivo);
    setAvisoExtracao(null);
    setAlertas([]);
    setConfirmarMesmoAssim(false);
    if (!arquivo) return;

    setExtraindo(true);
    let valorExtraido: number | null = null;
    let codigoExtraido: string | null = null;
    let documentoSuspeito = false;
    let formatoInvalido = false;
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const resp = await fetch("/api/extrair-boleto", { method: "POST", body: form });
      const json = await resp.json();
      if (resp.ok) {
        valorExtraido = json.valor;
        codigoExtraido = json.codigo_barras;
        documentoSuspeito = json.parece_documento_valido === false;
        formatoInvalido = json.codigo_barras && json.formato_codigo_valido === false;
        // só preenche sozinho se a pessoa ainda não tinha digitado nada -
        // nunca sobrescreve um valor que já foi digitado na mão.
        if (valorExtraido != null && !valorLancar.trim()) setValorLancar(String(valorExtraido).replace(".", ","));
        if (codigoExtraido) setCodigoBarras(codigoExtraido);
        if (valorExtraido == null && !codigoExtraido) setAvisoExtracao("Não consegui ler o valor nem o código de barras automaticamente - confere e preenche na mão.");
      } else {
        setAvisoExtracao("Não foi possível ler o boleto automaticamente. Confere e preenche na mão.");
      }
    } catch {
      setAvisoExtracao("Não foi possível ler o boleto automaticamente. Confere e preenche na mão.");
    }
    setExtraindo(false);

    await rodarVerificacoes({
      codigo: codigoExtraido ?? codigoBarras,
      valor: valorExtraido ?? Number(valorLancar.replace(",", ".")) ?? null,
      documentoSuspeito, formatoInvalido,
    });
  }

  async function rodarVerificacoes(params: { codigo: string | null; valor: number | null; documentoSuspeito?: boolean; formatoInvalido?: boolean }) {
    setVerificando(true);
    const novosAlertas: string[] = [];

    if (params.documentoSuspeito) {
      novosAlertas.push("O arquivo enviado não parece um boleto ou fatura de verdade - confere se é o documento certo.");
    }
    if (params.formatoInvalido) {
      novosAlertas.push("O código de barras não tem o formato esperado (47 ou 48 dígitos) - pode ter vindo errado na leitura.");
    }

    // regra 1: mesmo código de barras já lançado em outro lugar (duplicidade real)
    const codigoLimpo = params.codigo?.replace(/\D/g, "") ?? "";
    if (codigoLimpo.length >= 40) {
      const { data: duplicados } = await supabase
        .from("lancamentos")
        .select("id, mes, ano, contas!inner ( lojas ( codigo ) )")
        .eq("codigo_barras", params.codigo)
        .neq("id", lancamentoAtual?.id ?? "00000000-0000-0000-0000-000000000000");
      const outro = (duplicados ?? [])[0] as any;
      if (outro) {
        novosAlertas.push(`Esse código de barras já foi lançado antes: ${outro.contas?.lojas?.codigo ?? "outra conta"} (${outro.mes}/${outro.ano}). Confere se não é o mesmo boleto duplicado.`);
      }
    }

    // regra 2: valor muito fora do padrão histórico dessa conta
    if (params.valor != null && params.valor > 0) {
      const historico = lancs.filter((l) => l.valor != null && l.valor > 0 && l.id !== lancamentoAtual?.id).map((l) => l.valor!);
      if (historico.length >= 2) {
        const media = historico.reduce((s, v) => s + v, 0) / historico.length;
        if (media > 0 && (params.valor > media * 2.5 || params.valor < media * 0.3)) {
          novosAlertas.push(`Esse valor está bem diferente do que essa conta costuma ter (média de ${money(media)} nos últimos lançamentos).`);
        }
      }
    }

    setAlertas(novosAlertas);
    setVerificando(false);
  }

  async function lancarComBoleto() {
    if (!valorLancar.trim()) { setErroLancamento("Informe o valor da fatura."); return; }
    setSalvandoLancamento(true);
    setErroLancamento(null);

    let caminhoBoleto: string | null = lancamentoAtual?.comprovante_url ?? null;
    let linkDrive: string | null = (lancamentoAtual as any)?.comprovante_drive_url ?? null;

    if (arquivoBoleto) {
      const ext = arquivoBoleto.name.split(".").pop();
      const lojaSlug = nomeArquivoSeguro(conta.lojas?.codigo ?? "loja");
      const competencia = `${String(MES_ATUAL).padStart(2, "0")}-${ANO_ATUAL}`;
      const caminho = `${lojaSlug}/${conta.tipo}/${competencia}_${conta.id.slice(0, 8)}.${ext}`;
      const { error: erroUpload } = await supabase.storage.from("boletos").upload(caminho, arquivoBoleto, { upsert: true });
      if (erroUpload) { setSalvandoLancamento(false); setErroLancamento("Não foi possível enviar o boleto."); return; }
      caminhoBoleto = caminho;

      if (enviarDrive) {
        const form = new FormData();
        form.append("arquivo", arquivoBoleto);
        form.append("ano", String(ANO_ATUAL));
        form.append("mes", MES[MES_ATUAL - 1]);
        form.append("mesNumero", String(MES_ATUAL).padStart(2, "0"));
        form.append("dia", String(new Date().getDate()).padStart(2, "0"));
        form.append("loja", conta.lojas?.codigo ?? "loja");
        form.append("tipo", T?.n ?? conta.tipo);
        form.append("empresa", conta.lojas?.empresas?.nome ?? "");
        try {
          const resp = await fetch("/api/upload-drive", { method: "POST", body: form });
          const json = await resp.json();
          if (resp.ok) linkDrive = json.webViewLink;
          else setErroLancamento(`Boleto salvo no sistema, mas não foi possível enviar ao Drive: ${json.error}`);
        } catch {
          setErroLancamento("Boleto salvo no sistema, mas o envio ao Google Drive falhou.");
        }
      }
    }

    const payload: any = {
      conta_id: conta.id, ano: ANO_ATUAL, mes: MES_ATUAL,
      valor: Number(valorLancar.replace(",", ".")),
      situacao: "lancado", comprovante_url: caminhoBoleto,
      lancado_em: new Date().toISOString(),
      codigo_barras: codigoBarras.trim() || null,
    };
    if (linkDrive) payload.comprovante_drive_url = linkDrive;
    const { error } = await supabase.from("lancamentos").upsert(payload, { onConflict: "conta_id,ano,mes" });
    setSalvandoLancamento(false);
    if (error) { setErroLancamento("Não foi possível salvar o lançamento."); return; }
    setLancando(false);
    setValorLancar("");
    setArquivoBoleto(null);
    // a conta acabou de sair de "a lançar" e entrou na fila de aprovação -
    // faz sentido a tela já te levar pra lá, em vez de deixar preso em Contas.
    onClose();
    router.push("/aprovacoes");
  }

  async function verBoleto(caminho: string) {
    const { data, error } = await supabase.storage.from("boletos").createSignedUrl(caminho, 300);
    if (error || !data) { setAviso("Não foi possível abrir o boleto."); return; }
    window.open(data.signedUrl, "_blank");
  }

  function baixarExtrato() {
    const linhas = ["mes,valor,situacao"];
    lancs.forEach((l) => linhas.push(`${MES[l.mes - 1]},${l.valor ?? ""},${SITUACAO[l.situacao]?.label ?? l.situacao}`));
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `extrato_${conta.lojas?.codigo ?? "conta"}_${conta.tipo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const valores = lancs.filter((l) => l.valor != null).map((l) => Number(l.valor));
  const maxv = Math.max(...valores, 1);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[380px] max-w-[94vw] bg-white border-l border-linha z-50 overflow-y-auto">
        <div className="relative px-5 py-5 border-b border-linha">
          <span className="absolute left-0 right-0 top-0 h-1 bg-amarelo" />
          <button onClick={onClose} className="absolute right-5 top-5 text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: T?.bg }}>
              <TipoIcon tipo={conta.tipo} size={20} color={T?.c} />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-[#1a1a1a] leading-tight">Conta de {T?.n}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[13px] text-[#6c757d]">{conta.lojas?.codigo}</span>
                <StatusBadgeDrawer status={conta.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="text-[14px] font-semibold text-[#1a1a1a] mb-4">Detalhes da conta</div>
          <div className="grid grid-cols-2 gap-y-3.5 mb-6">
            <Campo label="Fornecedor" valor={conta.fornecedor_nome ?? "—"} />
            <Campo label="Vencimento" valor={conta.dia_vencimento ? `dia ${conta.dia_vencimento}` : "—"} />
            <Campo label={CAMPOS_TIPO[conta.tipo]?.labelIdentificador ?? "Código da conta"} valor={conta.identificador ?? "—"} mono />
            <Campo label="Origem" valor={ORIGENS[conta.origem]} />
          </div>

          <div className="pt-5 border-t border-linha">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-semibold text-[#1a1a1a]">Credenciais</div>
              <button onClick={() => { setEditandoCred((v) => !v); setNovoLogin(login ?? ""); setNovaSenha(""); }}
                className="text-amarelo text-[12px] font-semibold hover:underline">
                {editandoCred ? "Cancelar" : "Editar"}
              </button>
            </div>

            {!editandoCred ? (
              <div className="space-y-3">
                <Campo label="Usuário" valor={login ?? "não cadastrado"} mono />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">Senha</div>
                    <div className="text-[13px] font-semibold text-[#1a1a1a] font-mono">{senha ?? "•••••••••"}</div>
                  </div>
                  {!senha && (
                    <button onClick={revelar} disabled={revelando} className="text-[#adb5bd] hover:text-amarelo">
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.3" /></svg>
                    </button>
                  )}
                </div>
                {aviso && <div className="text-[11px] text-amb bg-amb-bg rounded-md px-3 py-2 leading-snug">{aviso}</div>}
              </div>
            ) : (
              <div className="space-y-3">
                <label>
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Usuário</div>
                  <input value={novoLogin} onChange={(e) => setNovoLogin(e.target.value)} className="input-padrao w-full font-mono" />
                </label>
                <label>
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Nova senha</div>
                  <input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="deixe em branco para manter" className="input-padrao w-full font-mono" />
                </label>
                <button onClick={salvarCredencial} disabled={salvandoCred} className="btn-primario w-full">
                  {salvandoCred ? "Salvando..." : "Salvar credencial"}
                </button>
              </div>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-linha">
            <div className="text-[14px] font-semibold text-[#1a1a1a] mb-3.5">Fatura de {formatarPeriodo(MES_ATUAL, ANO_ATUAL)}</div>

            {lancamentoAtual && lancamentoAtual.situacao !== "pendente" && !lancando ? (
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[18px] font-bold text-[#1a1a1a]">{money(lancamentoAtual.valor)}</div>
                    <SituacaoBadgeInline situacao={lancamentoAtual.situacao} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {lancamentoAtual.comprovante_url && (
                      <button onClick={() => verBoleto(lancamentoAtual.comprovante_url!)}
                        className="flex items-center gap-1.5 text-[12.5px] font-semibold text-info hover:underline">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></svg>
                        Ver boleto
                      </button>
                    )}
                    {lancamentoAtual.comprovante_drive_url && (
                      <a href={lancamentoAtual.comprovante_drive_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6c757d] hover:underline">
                        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2l6 10.5H2.5L8 2z" /><path d="M9 12.5l3 5.5h6l-3-5.5" /><path d="M12 2l6 10.5-3 5.5" /></svg>
                        Ver no Drive
                      </a>
                    )}
                  </div>
                </div>
                {(lancamentoAtual.situacao === "aprovado" || lancamentoAtual.situacao === "pago" || lancamentoAtual.situacao === "contestado") && (aprovadorNome || (lancamentoAtual as any).aprovado_em) && (
                  <div className="mt-3 pt-3 border-t border-linha2 text-[11.5px] text-[#6c757d]">
                    {lancamentoAtual.situacao === "contestado" ? "Recusado" : "Aprovado"} por <b className="text-[#1a1a1a]">{aprovadorNome ?? "—"}</b>
                    {(lancamentoAtual as any).aprovado_em && ` em ${new Date((lancamentoAtual as any).aprovado_em).toLocaleString("pt-br", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                )}
                <button onClick={() => { setValorLancar(String(lancamentoAtual.valor ?? "")); setAlertas([]); setConfirmarMesmoAssim(false); setCodigoBarras(""); setLancando(true); }}
                  className="w-full mt-3 pt-3 border-t border-linha2 text-[12px] font-semibold text-[#6c757d] hover:text-amb transition text-center">
                  Boleto errado? Substituir
                </button>
              </div>
            ) : !lancando ? (
              <button onClick={() => { setValorLancar(lancamentoAtual ? String(lancamentoAtual.valor ?? "") : ""); setAlertas([]); setConfirmarMesmoAssim(false); setCodigoBarras(""); setLancando(true); }}
                className="w-full text-[12.5px] font-semibold text-amb border border-amarelo/40 bg-amb-bg rounded-md py-2.5 hover:bg-amarelo/10 transition">
                {lancamentoAtual ? `Lançar fatura de ${formatarPeriodo(MES_ATUAL, ANO_ATUAL).toLowerCase()}` : `Lançar fatura de ${formatarPeriodo(MES_ATUAL, ANO_ATUAL).toLowerCase()} (sem lançamento pendente ainda)`}
              </button>
            ) : (
              <div className="card p-4">
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Valor da fatura</div>
                  <input value={valorLancar} onChange={(e) => setValorLancar(e.target.value)}
                    onBlur={() => rodarVerificacoes({ codigo: codigoBarras, valor: Number(valorLancar.replace(",", ".")) || null })}
                    placeholder="0,00" className="input-padrao w-full font-mono" />
                </label>
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Boleto (PDF ou imagem)</div>
                  <input type="file" accept=".pdf,image/*" onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
                    className="w-full text-[12.5px] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#f1f3f5] file:text-[12px] file:font-medium" />
                </label>
                {extraindo && (
                  <div className="text-[11.5px] text-info bg-info-bg rounded-md px-3 py-2 mb-3 flex items-center gap-2">
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3a7 7 0 107 7" strokeLinecap="round" /></svg>
                    Lendo o boleto automaticamente...
                  </div>
                )}
                {avisoExtracao && <div className="text-[11.5px] text-[#adb5bd] mb-3">{avisoExtracao}</div>}
                <label className="block mb-3">
                  <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Código de barras (linha digitável)</div>
                  <div className="flex gap-1.5">
                    <input value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)}
                      onBlur={() => rodarVerificacoes({ codigo: codigoBarras, valor: Number(valorLancar.replace(",", ".")) || null })}
                      placeholder="Preenche sozinho se conseguir ler do boleto"
                      className="input-padrao w-full font-mono text-[11.5px]" />
                    {codigoBarras && (
                      <button type="button" onClick={() => navigator.clipboard.writeText(codigoBarras)}
                        className="shrink-0 px-3 rounded-md border border-linha text-[11px] font-semibold text-[#6c757d] hover:bg-off">
                        Copiar
                      </button>
                    )}
                  </div>
                </label>
                <label className="flex items-center gap-2 mb-3">
                  <input type="checkbox" checked={enviarDrive} onChange={(e) => setEnviarDrive(e.target.checked)}
                    disabled={!arquivoBoleto} className="w-4 h-4" />
                  <span className="text-[12.5px] text-[#6c757d]">Enviar cópia também para o Google Drive</span>
                </label>
                <div className="text-[10.5px] text-[#adb5bd] mb-3 leading-snug">
                  Baixado do portal do fornecedor. Depois de lançar, a conta entra na fila de Aprovações.
                </div>

                {verificando && <div className="text-[11px] text-[#adb5bd] mb-3">Verificando duplicidade e histórico...</div>}

                {alertas.length > 0 && (
                  <div className="bg-amb-bg border border-amarelo/40 rounded-md px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#B8860B" strokeWidth="1.8"><path d="M10.9 3.6l7.6 13a1 1 0 01-.9 1.5H2.4a1 1 0 01-.9-1.5l7.6-13a1 1 0 011.8 0z" /><path d="M10 8.5v4" /></svg>
                      <b className="text-[11.5px] font-semibold text-[#7a5c00]">Antes de lançar, confere isso:</b>
                    </div>
                    <ul className="text-[11.5px] text-[#7a5c00] space-y-1 mb-2.5 list-disc list-inside">
                      {alertas.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={confirmarMesmoAssim} onChange={(e) => setConfirmarMesmoAssim(e.target.checked)} className="w-4 h-4" />
                      <span className="text-[11.5px] font-semibold text-[#7a5c00]">Já conferi, quero lançar mesmo assim</span>
                    </label>
                  </div>
                )}

                {erroLancamento && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">{erroLancamento}</div>}
                <div className="flex gap-2">
                  <button onClick={lancarComBoleto} disabled={salvandoLancamento || (alertas.length > 0 && !confirmarMesmoAssim)}
                    className="btn-primario flex-1 disabled:opacity-50">
                    {salvandoLancamento ? "Enviando..." : "Lançar"}
                  </button>
                  <button onClick={() => { setLancando(false); setErroLancamento(null); }} className="btn-secundario">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-5 mt-5 border-t border-linha">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-semibold text-[#1a1a1a]">Histórico mensal (R$)</div>
              <span className="text-[12px] text-[#6c757d]">Últimos 12 meses</span>
            </div>
            <div className="flex items-stretch gap-1 h-[140px]">
              {Array.from({ length: 12 }).map((_, mi) => {
                const l = lancs.find((x) => x.mes === mi + 1);
                const v = l?.valor != null ? Number(l.valor) : null;
                const h = v != null ? Math.max((v / maxv) * 100, 3) : 3;
                return (
                  <div key={mi} className="flex-1 flex flex-col" title={`${MES[mi]}: ${money(v)}`}>
                    <div className="flex-1 flex items-end">
                      <div className="w-full rounded-t-sm" style={{ height: `${h}%`, background: v == null ? "#f1f3f5" : "#FFC107" }} />
                    </div>
                    <span className="text-[9px] text-[#adb5bd] font-mono text-center mt-1.5">{MES[mi][0]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={baixarExtrato} className="btn-secundario w-full mt-6 flex items-center justify-center gap-2">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3v10m0 0l-4-4m4 4l4-4" /><path d="M3.5 15v2a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-2" /></svg>
            Baixar extrato da conta
          </button>
        </div>
      </aside>
    </>
  );
}

function StatusBadgeDrawer({ status }: { status: string }) {
  if (status === "encerrado") return <span className="badge bg-alerr-bg text-alerr">Encerrada</span>;
  if (status === "inativo") return <span className="badge bg-[#f1f3f5] text-[#adb5bd]">Inativa</span>;
  return <span className="badge bg-ok-bg text-ok">Ativa</span>;
}

function Campo({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[12px] text-[#adb5bd] font-medium mb-0.5">{label}</div>
      <div className={`text-[13px] font-semibold text-[#1a1a1a] ${mono ? "font-mono !font-normal" : ""}`}>{valor}</div>
    </div>
  );
}

function NovaContaDrawer({ lojas, onClose }: { lojas: { id: string; codigo: string }[]; onClose: () => void }) {
  const router = useRouter();
  const { state, updateField, isLoading, error, salvar } = useContaForm(lojas[0]?.id ?? "");

  async function handleSalvar() {
    const resultado = await salvar();
    if (resultado) {
      // atualiza os dados da página sem recarregar o navegador inteiro
      router.refresh();
      onClose();
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <aside className="fixed top-0 right-0 h-screen w-[380px] max-w-[94vw] bg-white border-l border-linha z-50 overflow-y-auto">
        <div className="relative px-5 py-5 border-b border-linha">
          <span className="absolute left-0 right-0 top-0 h-1 bg-amarelo" />
          <button onClick={onClose} className="absolute right-5 top-5 text-[#adb5bd] hover:text-[#1a1a1a]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
          <h3 className="text-[20px] font-bold text-[#1a1a1a]">Nova conta</h3>
        </div>
        <div className="p-5 space-y-3.5">
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Loja</div>
            <select value={state.lojaId} onChange={(e) => updateField("lojaId", e.target.value)} className="input-padrao w-full">
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.codigo}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Tipo</div>
              <select value={state.tipo} onChange={(e) => updateField("tipo", e.target.value)} className="input-padrao w-full">
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
              </select>
            </label>
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Origem</div>
              <select value={state.origem} onChange={(e) => updateField("origem", e.target.value)} className="input-padrao w-full">
                {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Fornecedor</div>
            <input value={state.fornecedor} onChange={(e) => updateField("fornecedor", e.target.value)} placeholder={CAMPOS_TIPO[state.tipo]?.placeholderFornecedor} className="input-padrao w-full" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">{CAMPOS_TIPO[state.tipo]?.labelIdentificador ?? "Identificador"}</div>
              <input value={state.identificador} onChange={(e) => updateField("identificador", e.target.value)} placeholder={CAMPOS_TIPO[state.tipo]?.placeholderIdentificador} className="input-padrao w-full font-mono" />
            </label>
            <label>
              <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Vencimento</div>
              <input value={state.vencimento} onChange={(e) => updateField("vencimento", e.target.value)} placeholder="1-31" className="input-padrao w-full" />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={state.ehRateio} onChange={(e) => updateField("ehRateio", e.target.checked)} className="w-4 h-4" />
            <span className="text-[12.5px] text-txt-2">É rateio</span>
            {state.ehRateio && (
              <input value={state.rateioDivisor} onChange={(e) => updateField("rateioDivisor", e.target.value)} placeholder="/2"
                className="w-16 border border-linha rounded-md px-2 py-1.5 text-[12.5px] ml-1" />
            )}
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Login do portal</div>
            <input value={state.login} onChange={(e) => updateField("login", e.target.value)} className="input-padrao w-full font-mono" />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[#adb5bd] uppercase mb-1">Senha do portal</div>
            <input value={state.senha} onChange={(e) => updateField("senha", e.target.value)} className="input-padrao w-full font-mono" />
          </label>
          <div className="text-[10.5px] text-[#adb5bd] leading-snug">A senha vai direto para o cofre criptografado.</div>
          {error && <div className="text-[12px] text-alerr bg-alerr-bg rounded-md px-3 py-2">{error}</div>}
          <button onClick={handleSalvar} disabled={isLoading} className="btn-primario w-full">
            {isLoading ? "Salvando..." : "Criar conta"}
          </button>
        </div>
      </aside>
    </>
  );
}

function SituacaoBadgeInline({ situacao }: { situacao: string }) {
  const s = SITUACAO[situacao] ?? { label: situacao, cls: "bg-[#f1f3f5] text-[#adb5bd]" };
  return <span className={`badge mt-1 ${s.cls}`}>{s.label}</span>;
}
