import { createClient } from "@/lib/supabase/server";
import TipoIcon from "@/components/tipo-icon";
import { TIPOS } from "@/lib/types";
import { carregarCalendario } from "@/lib/calendario-server";
import { gerarAlertas } from "@/lib/alertas-inteligentes";
import { formatarPeriodo, estaAtrasada, variacaoPct, contaValidaNoPeriodo } from "@/lib/date-utils";
import { obterPeriodoSelecionado } from "@/lib/periodo";
import { money, MES, formatarDataSemFuso } from "@/lib/format";
import VencimentosProximosClient from "./vencimentos-proximos-client";
import RelogioAoVivo from "./relogio-ao-vivo";
import CalendarioMes, { type DiaCal } from "./calendario-mes";
import DonutTipos, { type FatiaTipo } from "./donut-tipos";
import ContadorAnimado from "@/components/contador-animado";
import Link from "next/link";
import { podeAcessar } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

function saudacao(): string {
  // new Date().getHours() usa o fuso do SERVIDOR (a Vercel roda em UTC),
  // não o horário real do Brasil - isso fazia a saudação vir errada (ex:
  // "boa tarde" de manhã, porque no servidor já passava do meio-dia em
  // UTC). Calculando direto no fuso de São Paulo em vez de confiar no
  // fuso local da máquina.
  const horaBrasil = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())
  );
  if (horaBrasil < 12) return "Bom dia";
  if (horaBrasil < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function PainelPage() {
  const supabase = createClient();
  const { ano, mes, mesAnterior, anoAnterior, ehPeriodoAtual } = obterPeriodoSelecionado();
  const cal = await carregarCalendario(ano);

  // garante que toda conta ativa tenha uma linha "pendente" pro período
  // sendo visto, antes de qualquer coisa - sem isso, contas sem lançamento
  // ainda ficam invisíveis pras telas de vencimento/atrasada.
  await supabase.rpc("garantir_lancamentos_pendentes", { p_ano: ano, p_mes: mes });

  const { data: { session } } = await supabase.auth.getSession();

  const [
    { data: perfil },
    { data: contas },
    { data: lancamentos },
    { data: lancamentosDetalhados },
    { data: lancamentosAno },
    { data: lojasEncerradas },
    { count: totalLojasFechadas },
    { count: totalLojasAtivas },
    { data: atividadeRecente },
    { data: metricaAnterior },
  ] = await Promise.all([
    supabase.from("perfis").select("nome").eq("id", session?.user.id ?? "").maybeSingle(),
    supabase.from("contas").select("id, tipo, status, origem, dia_vencimento, data_encerramento").eq("situacao_cadastro", "aprovada"),
    supabase.from("lancamentos").select("conta_id, situacao, contas!inner(tipo, dia_vencimento, status, data_encerramento)").eq("ano", ano).eq("mes", mes),
    supabase.from("lancamentos")
      .select("id, valor, situacao, contas!inner ( id, tipo, dia_vencimento, fornecedor_nome, lojas ( codigo ) )")
      .eq("ano", ano).eq("mes", mes).eq("situacao", "pendente"),
    supabase.from("lancamentos")
      .select("mes, valor, situacao, contas!inner ( fornecedor_nome )")
      .eq("ano", ano).not("valor", "is", null),
    supabase.from("lojas").select("codigo, coban, empresa, cidade, uf, encerrada_em").eq("status", "encerrada").order("encerrada_em", { ascending: false }).limit(5),
    supabase.from("lojas").select("id", { count: "exact", head: true }).eq("status", "encerrada"),
    supabase.from("lojas").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("lancamentos")
      .select("id, valor, lancado_em, situacao, lancado_por, contas!inner ( tipo, lojas ( codigo ) )")
      .not("lancado_em", "is", null).order("lancado_em", { ascending: false }).limit(8),
    supabase.from("metricas_mensais").select("contas_ativas, a_lancar, aguardando_pagamento, origem_a_mapear").eq("ano", anoAnterior).eq("mes", mesAnterior).maybeSingle(),
  ]);

  const nomeCru = perfil?.nome?.trim() ?? "";
  // se o perfil não tem nome de verdade cadastrado, às vezes fica salvo o
  // próprio e-mail como valor padrão - não faz sentido mostrar isso na
  // saudação, então nesse caso não mostra nome nenhum.
  const nome = nomeCru && !nomeCru.includes("@") ? nomeCru.split(" ")[0] : "";
  const diaAtual = new Date().getDate();

  // --- métricas por tipo (cards de baixo) ---
  const tipos = Object.keys(TIPOS);
  const porTipo = tipos.map((t) => {
    const doTipo = (contas ?? []).filter((c) => c.tipo === t && c.status !== "inativo" && contaValidaNoPeriodo(c.status, c.data_encerramento, ano, mes));
    const ativas = doTipo.length;
    const mapear = doTipo.filter((c) => c.origem === "a_definir").length;
    const lanc = (lancamentos ?? []).filter((l: any) => l.contas?.tipo === t);
    // conta encerrada/inativa não aparece na tela de Contas — então também
    // não pode entrar no total de atrasadas, senão o card diverge da lista.
    const atrasadas = lanc.filter((l: any) =>
      l.contas?.status !== "encerrado" && l.contas?.status !== "inativo" &&
      contaValidaNoPeriodo(l.contas?.status, l.contas?.data_encerramento, ano, mes) &&
      estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano, undefined, cal)).length;
    const pagas = lanc.filter((l) => l.situacao === "pago").length;
    const aguardando = lanc.filter((l) => l.situacao === "lancado" || l.situacao === "aprovado").length;
    const aLancar = lanc.filter((l) => l.situacao === "pendente").length;
    return { t, ativas, mapear, atrasadas, pagas, aguardando, aLancar };
  });

  const totAtivas = porTipo.reduce((s, x) => s + x.ativas, 0);
  const totAberto = porTipo.reduce((s, x) => s + x.aLancar, 0);
  const totLancado = porTipo.reduce((s, x) => s + x.aguardando, 0);
  const totMapear = porTipo.reduce((s, x) => s + x.mapear, 0);

  // --- alertas importantes ---
  const totAtrasadas = porTipo.reduce((s, x) => s + x.atrasadas, 0);
  const aprovacoesPendentes = (lancamentos ?? []).filter((l) => l.situacao === "lancado").length;
  const pagamentosComFalha = (lancamentos ?? []).filter((l) => l.situacao === "contestado").length;

  // --- evolução mensal (soma real de lançamentos com valor, mês a mês do ano) ---
  const evolucaoPorMes = Array.from({ length: 12 }, (_, i) => {
    const total = (lancamentosAno ?? []).filter((l) => l.mes === i + 1).reduce((s, l) => s + Number(l.valor ?? 0), 0);
    return { mes: i + 1, total };
  }).filter((m) => m.mes <= mes); // só até o mês atual, não mostra futuro vazio
  const maxEvolucao = Math.max(...evolucaoPorMes.map((m) => m.total), 1);
  const totalMesAtual = evolucaoPorMes.find((m) => m.mes === mes)?.total ?? 0;
  const totalMesAnteriorReal = evolucaoPorMes.find((m) => m.mes === mesAnterior)?.total ?? null;
  const variacaoEvolucao = totalMesAnteriorReal ? variacaoPct(totalMesAtual, totalMesAnteriorReal) : null;

  // --- top fornecedores (por valor, dentro do mês atual) ---
  const porFornecedor: Record<string, number> = {};
  (lancamentosAno ?? []).filter((l) => l.mes === mes).forEach((l: any) => {
    const nomeF = l.contas?.fornecedor_nome ?? "Não identificado";
    porFornecedor[nomeF] = (porFornecedor[nomeF] ?? 0) + Number(l.valor ?? 0);
  });
  const topFornecedores = Object.entries(porFornecedor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalFornecedores = Object.values(porFornecedor).reduce((s, v) => s + v, 0) || 1;

  // --- resumo financeiro do mês ---
  const lancMesAtual = (lancamentosAno ?? []).filter((l) => l.mes === mes);
  const totalAPagar = lancMesAtual.reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const totalPago = lancMesAtual.filter((l) => l.situacao === "pago").reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const totalPendente = totalAPagar - totalPago;
  const pctPago = totalAPagar > 0 ? Math.round((totalPago / totalAPagar) * 1000) / 10 : 0;


  // --- calendário do mês: agrupa lançamentos por dia de vencimento ---
  const mapaDias = new Map<number, DiaCal>();
  (lancamentosDetalhados ?? []).forEach((l: any) => {
    const dia = l.contas?.dia_vencimento;
    if (!dia) return;
    const atual = mapaDias.get(dia) ?? { dia, pagas: 0, aVencer: 0, atrasadas: 0, aprovacoes: 0, total: 0, valor: 0 };
    atual.total++;
    atual.valor += Number(l.valor ?? 0);
    if (l.situacao === "pago") atual.pagas++;
    else if (l.situacao === "lancado") atual.aprovacoes++;
    else if (estaAtrasada(l.situacao, dia, mes, ano, undefined, cal)) atual.atrasadas++;
    else atual.aVencer++;
    mapaDias.set(dia, atual);
  });
  const diasCalendario = Array.from(mapaDias.values());

  // --- top 5 lojas por valor no mês ---
  const porLoja: Record<string, number> = {};
  (lancamentosDetalhados ?? []).forEach((l: any) => {
    const cod = l.contas?.lojas?.codigo;
    if (!cod) return;
    porLoja[cod] = (porLoja[cod] ?? 0) + Number(l.valor ?? 0);
  });
  const topLojas = Object.entries(porLoja).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // --- contas que vencem hoje ---
  const vencemHoje = (lancamentosDetalhados ?? []).filter(
    (l: any) => l.contas?.dia_vencimento === diaAtual && l.situacao !== "pago");
  const valorVenceHoje = vencemHoje.reduce((s: number, l: any) => s + Number(l.valor ?? 0), 0);

  // --- o que o assistente encontrou (leituras diretas dos dados) ---
  const semValor = (lancamentosDetalhados ?? []).filter((l: any) => l.situacao !== "pendente" && !l.valor).length;
  const insightsIA = [
    totAtrasadas > 0 ? { icone: "🔴", texto: `${totAtrasadas} ${totAtrasadas === 1 ? "conta atrasada" : "contas atrasadas"}`, href: "/contas?situacao=atrasada" } : null,
    aprovacoesPendentes > 0 ? { icone: "🟡", texto: `${aprovacoesPendentes} ${aprovacoesPendentes === 1 ? "conta precisa" : "contas precisam"} de aprovação`, href: "/aprovacoes" } : null,
    totMapear > 0 ? { icone: "🔵", texto: `${totMapear} ${totMapear === 1 ? "conta sem origem definida" : "contas sem origem definida"}`, href: "/contas?origem=a_definir" } : null,
    totAberto > 0 ? { icone: "🟣", texto: `${totAberto} ${totAberto === 1 ? "conta ainda não lançada" : "contas ainda não lançadas"}`, href: "/caixa-entrada" } : null,
    semValor > 0 ? { icone: "⚪", texto: `${semValor} ${semValor === 1 ? "lançamento sem valor" : "lançamentos sem valor"} informado`, href: "/lancamentos" } : null,
  ].filter(Boolean) as { icone: string; texto: string; href: string }[];

  const totalAnalisado = (lancamentosDetalhados ?? []).length;

  // --- alertas proativos do assistente (calendário + padrão de valores) ---
  const historicoValores = (lancamentosAno ?? [])
    .filter((l: any) => l.mes !== mes && l.valor)
    .map((l: any) => ({ fornecedor: l.contas?.fornecedor_nome ?? null, tipo: l.contas?.tipo ?? null, valor: Number(l.valor) }));

  const alertasIA = gerarAlertas(
    (lancamentos ?? []) as any,
    historicoValores,
    cal, ano, mes
  );


  // --- fatias do donut (gasto por categoria no mês) ---
  const CORES_TIPO: Record<string, string> = {
    agua: "#2A74C4", energia: "#E6A600", telefone: "#7B4FC4", aluguel: "#2E7D32",
    iptu: "#C4682A", condominio: "#4AA3A3", custo_geral: "#8A8A8A",
  };
  const valorPorTipo: Record<string, number> = {};
  (lancamentosDetalhados ?? []).forEach((l: any) => {
    const t = l.contas?.tipo; if (!t) return;
    valorPorTipo[t] = (valorPorTipo[t] ?? 0) + Number(l.valor ?? 0);
  });
  const fatiasTipo: FatiaTipo[] = Object.entries(valorPorTipo)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ chave: k, nome: TIPOS[k]?.n ?? k, valor: v, cor: CORES_TIPO[k] ?? "#adb5bd" }));
  const totalDonut = fatiasTipo.reduce((s2, f) => s2 + f.valor, 0);

  // --- nomes de quem lançou (para a timeline de atividade) ---
  const idsAutores = Array.from(new Set((atividadeRecente ?? []).map((a: any) => a.lancado_por).filter(Boolean)));
  const { data: autores } = idsAutores.length
    ? await supabase.from("perfis").select("id, nome").in("id", idsAutores)
    : { data: [] as { id: string; nome: string }[] };
  const nomePorId = new Map((autores ?? []).map((a: any) => [a.id, (a.nome ?? "").split(" ")[0]]));

  // --- agenda em timeline: próximos dias com vencimento ---
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  const agenda = Array.from({ length: 5 }, (_, i) => diaAtual + i)
    .filter((d) => d <= ultimoDiaMes)
    .map((d) => {
      const offset = d - diaAtual;
      const doDia = (lancamentosDetalhados ?? []).filter(
        (l: any) => l.contas?.dia_vencimento === d && l.situacao !== "pago");
      const dt = new Date(ano, mes - 1, d);
      const fds = dt.getDay() === 0 || dt.getDay() === 6;
      return {
        dia: d,
        rotulo: offset === 0 ? "Hoje" : offset === 1 ? "Amanhã" : dt.toLocaleDateString("pt-BR", { weekday: "long" }),
        qtd: doDia.length,
        valor: doDia.reduce((s2: number, l: any) => s2 + Number(l.valor ?? 0), 0),
        fds,
      };
    })
    .filter((a) => a.qtd > 0 || a.fds);

  const lojasAtivas = totalLojasAtivas ?? 0;
  const aprovadasMes = (lancamentos ?? []).filter((l) => l.situacao === "aprovado" || l.situacao === "pago").length;
  const rejeitadasMes = (lancamentos ?? []).filter((l) => l.situacao === "contestado").length;

  const podeAprovacoes = await podeAcessar("/aprovacoes");

  return (
    <div className="px-4 sm:px-8 py-5 sm:py-6 max-w-[1560px] w-full">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold text-[#1a1a1a]">👋 {saudacao()}{nome ? `, ${nome}` : ""}!</h1>
        <p className="text-[14px] text-[#6c757d] mt-1">
          {ehPeriodoAtual ? "Aqui está o resumo da sua gestão financeira." : `Você está vendo o histórico de ${formatarPeriodo(mes, ano)}.`}
        </p>
        <div className="mt-2"><RelogioAoVivo /></div>

        {/* faixa de alertas rápidos */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
          <Link href="/contas" className="flex items-center gap-1.5 text-[12.5px] text-[#495057] hover:text-[#1a1a1a]">
            <span className="text-[13px]">⏰</span>
            <b className="text-alerr">{vencemHoje.length}</b> {vencemHoje.length === 1 ? "conta vencendo hoje" : "contas vencendo hoje"}
          </Link>
          <Link href="/aprovacoes" className="flex items-center gap-1.5 text-[12.5px] text-[#495057] hover:text-[#1a1a1a]">
            <span className="text-[13px]">🕐</span>
            <b className="text-amb">{aprovacoesPendentes}</b> aguardando aprovação
          </Link>
          <Link href="/contas" className="flex items-center gap-1.5 text-[12.5px] text-[#495057] hover:text-[#1a1a1a]">
            <span className="text-[13px]">⚠️</span>
            <b className="text-alerr">{insightsIA.length}</b> {insightsIA.length === 1 ? "alerta importante" : "alertas importantes"}
          </Link>
        </div>
      </div>

      {/* indicadores principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3 mb-4">
        {[
          { icone: "📄", rot: "Contas ativas", val: totAtivas, sub: metricaAnterior?.contas_ativas != null ? `${totAtivas - metricaAnterior.contas_ativas >= 0 ? "+" : ""}${totAtivas - metricaAnterior.contas_ativas} este mês` : "sem dado anterior", href: "/contas", cor: "#2A74C4" },
          { icone: "💰", rot: "Valor do mês", val: totalAPagar, money: true, sub: `${(lancamentosDetalhados ?? []).length} lançamentos`, href: "/lancamentos", cor: "#2E7D32" },
          { icone: "⏰", rot: "Contas vencidas", val: totAtrasadas, sub: "precisam de atenção", href: "/contas", cor: "#D32F2F" },
          { icone: "🟡", rot: "Aprovações", val: aprovacoesPendentes, sub: podeAprovacoes ? "aguardando" : "acesso restrito", href: podeAprovacoes ? "/aprovacoes" : "/painel", cor: "#E6A600" },
          { icone: "🏪", rot: "Lojas ativas", val: lojasAtivas, sub: `${totalLojasFechadas ?? 0} encerradas`, href: "/lojas", cor: "#7B4FC4" },
        ].map((k) => (
          <Link key={k.rot} href={k.href}
            className="card p-4 hover:shadow-media hover:-translate-y-px transition-all duration-150">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11.5px] font-semibold text-[#6c757d]">{k.rot}</span>
              <span className="w-7 h-7 rounded-lg grid place-items-center text-[13px]" style={{ background: `${k.cor}15` }}>{k.icone}</span>
            </div>
            <div className="font-disp font-bold text-[#1a1a1a] text-[26px] sm:text-[30px] leading-none tracking-tight">
              <ContadorAnimado valor={k.val} formato={k.money ? "money" : "numero"} />
            </div>
            <div className="text-[11px] text-[#adb5bd] mt-1.5">{k.sub}</div>
          </Link>
        ))}
      </div>

      {/* alertas em destaque */}
      {insightsIA.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          {insightsIA.map((ins, i) => (
            <Link key={i} href={ins.href}
              className="shrink-0 flex items-center gap-2 bg-white border border-linha rounded-full pl-3 pr-3.5 py-2 text-[12px] text-[#495057] hover:border-amarelo hover:shadow-leve transition">
              <span className="text-[11px]">{ins.icone}</span>{ins.texto}
            </Link>
          ))}
        </div>
      )}

      {/* agenda em timeline */}
      <div className="grid lg:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a]">Agenda de vencimentos</h3>
            <Link href="/contas" className="text-[11.5px] font-semibold text-info hover:underline">Ver todas</Link>
          </div>
          <div className="relative pl-5">
            <span className="absolute left-[5px] top-2 bottom-2 w-px bg-linha2" />
            {agenda.map((a) => (
              <div key={a.dia} className="relative pb-4 last:pb-0">
                <span className="absolute -left-5 top-1 w-[11px] h-[11px] rounded-full border-2 border-white"
                  style={{ background: a.fds ? "#E6A600" : a.dia === diaAtual ? "#D32F2F" : "#2A74C4", boxShadow: "0 0 0 1.5px #e9ecef" }} />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-[#1a1a1a] capitalize">{a.rotulo}</span>
                  <span className="text-[10.5px] text-[#adb5bd] font-mono">{String(a.dia).padStart(2, "0")}/{String(mes).padStart(2, "0")}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-0.5">
                  <span className="text-[11.5px] text-[#6c757d]">{a.qtd} {a.qtd === 1 ? "conta" : "contas"}</span>
                  {a.valor > 0 && <span className="text-[12px] font-mono font-semibold text-[#1a1a1a]">{money(a.valor)}</span>}
                </div>
                {a.fds && a.qtd > 0 && (
                  <div className="mt-1.5 text-[11px] text-amb bg-amb-bg rounded-md px-2 py-1.5">
                    ⚠️ Cai em fim de semana — antecipar pagamento?
                  </div>
                )}
              </div>
            ))}
            {agenda.length === 0 && <div className="text-[12px] text-[#adb5bd]">Nada vencendo nos próximos dias.</div>}
          </div>
        </div>

        <div className="lg:col-span-2 card p-4">
          <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-4">Gastos por categoria <span className="text-[11.5px] font-normal text-[#adb5bd]">· {formatarPeriodo(mes, ano)}</span></h3>
          <DonutTipos fatias={fatiasTipo} total={totalDonut} />
        </div>
      </div>

      {/* calendário do mês + assistente financeiro */}
      <div className="grid lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2">
          <CalendarioMes
            ano={ano} mes={mes} dias={diasCalendario}
            nomeMes={formatarPeriodo(mes, ano)} ehMesAtual={ehPeriodoAtual}
          />
        </div>

        <div className="card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-amarelo/15 grid place-items-center text-[14px]">🤖</span>
            <div>
              <div className="font-disp text-[14px] font-semibold text-[#1a1a1a] leading-none">Assistente Financeiro</div>
              <div className="text-[10.5px] text-ok mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" /> Online
              </div>
            </div>
          </div>

          <p className="text-[12px] text-[#6c757d] mt-3 mb-2.5">
            Analisei {totalAnalisado} {totalAnalisado === 1 ? "conta" : "contas"} deste mês:
          </p>

          {/* alertas proativos: o que o assistente detectou sozinho */}
          {alertasIA.length > 0 && (
            <div className="space-y-1.5 mb-2.5">
              {alertasIA.slice(0, 3).map((a) => (
                <Link key={a.chave} href={a.href}
                  className={`block rounded-lg px-2.5 py-2 border transition ${
                    a.prioridade === "alta" ? "bg-amb-bg border-amarelo/40 hover:border-amarelo"
                    : "bg-off border-linha hover:border-[#d5d3cd]"}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-[12px] leading-tight">{a.icone}</span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#1a1a1a] leading-snug">{a.titulo}</div>
                      {a.detalhe && <div className="text-[10.5px] text-[#6c757d] leading-snug mt-0.5">{a.detalhe}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="space-y-1.5 flex-1">
            {insightsIA.length === 0 && alertasIA.length === 0 && (
              <div className="text-[12.5px] text-ok bg-ok-bg rounded-lg px-3 py-2.5">
                ✅ Tudo em dia por aqui. Nenhuma pendência encontrada.
              </div>
            )}
            {insightsIA.map((ins, i) => (
              <Link key={i} href={ins.href}
                className="flex items-center gap-2 text-[12.5px] text-[#495057] rounded-lg px-2 py-1.5 -mx-2 hover:bg-[#f8f9fa] transition">
                <span className="text-[11px]">{ins.icone}</span>
                <span className="flex-1">{ins.texto}</span>
                <span className="text-[#adb5bd]">›</span>
              </Link>
            ))}
          </div>

          <Link href="/contas" className="btn-primario w-full text-center mt-4">Revisar agora</Link>
        </div>
      </div>

        {/* atividade recente + resumo do seu dia */}
      <div className="grid lg:grid-cols-3 gap-3 mb-4">
<div className="lg:col-span-2 card p-4">
  <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-4">Atividade recente</h3>
  <div className="relative pl-5">
    <span className="absolute left-[5px] top-2 bottom-2 w-px bg-linha2" />
    {(atividadeRecente ?? []).map((a: any) => {
      const quando = a.lancado_em
        ? new Date(a.lancado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";
      const quem = nomePorId.get(a.lancado_por) ?? "Alguém";
      const cor = a.situacao === "pago" ? "#2E7D32" : a.situacao === "contestado" ? "#D32F2F" : a.situacao === "aprovado" ? "#2A74C4" : "#E6A600";
      const verbo = a.situacao === "pago" ? "pagou" : a.situacao === "aprovado" ? "aprovou" : a.situacao === "contestado" ? "recusou" : "lançou";
      return (
        <div key={a.id} className="relative pb-3.5 last:pb-0">
          <span className="absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white"
            style={{ background: cor, boxShadow: "0 0 0 1.5px #e9ecef" }} />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[12.5px] text-[#1a1a1a]">
              <b className="font-semibold">{quem}</b> {verbo} {TIPOS[a.contas?.tipo]?.n?.toLowerCase() ?? "conta"}
              {a.contas?.lojas?.codigo ? <> · <span className="font-mono text-[11.5px]">{a.contas.lojas.codigo}</span></> : null}
            </span>
            {a.valor ? <span className="text-[11.5px] font-mono font-semibold text-[#495057]">{money(Number(a.valor))}</span> : null}
          </div>
          <div className="text-[10.5px] text-[#adb5bd] font-mono mt-0.5">{quando}</div>
        </div>
      );
    })}
    {(atividadeRecente ?? []).length === 0 && (
      <div className="text-[12px] text-[#adb5bd]">Nenhuma movimentação registrada ainda.</div>
    )}
  </div>
</div>

<div className="card p-4 flex flex-col">
  <h3 className="font-disp text-[14px] font-semibold text-[#1a1a1a] mb-1">🤖 Bom trabalho!</h3>
  <p className="text-[11.5px] text-[#6c757d] mb-3.5">Como está o mês até agora</p>
  <div className="space-y-2 text-[12.5px] text-[#495057] flex-1">
    <div className="flex items-center gap-2"><span className="text-ok">✔</span> {totLancado} {totLancado === 1 ? "conta lançada" : "contas lançadas"}</div>
    <div className="flex items-center gap-2"><span className="text-ok">✔</span> {aprovadasMes} {aprovadasMes === 1 ? "conta aprovada" : "contas aprovadas"}</div>
    <div className="flex items-center gap-2"><span className="text-ok">✔</span> {pctPago}% do valor do mês já pago</div>
    {rejeitadasMes > 0 && <div className="flex items-center gap-2"><span className="text-alerr">✖</span> {rejeitadasMes} {rejeitadasMes === 1 ? "recusada" : "recusadas"}</div>}
  </div>
  <div className="mt-4 pt-3 border-t border-linha2 space-y-1.5 text-[11.5px] text-[#6c757d]">
    <div>💧 Aproveite para beber um copo de água.</div>
    <div>☕ Faça uma pausa em alguns minutos.</div>
  </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_310px] gap-4">
        <div className="min-w-0">

          {ehPeriodoAtual && (
            <div className="mb-4">
              <VencimentosProximosClient itens={(lancamentosDetalhados ?? []) as any[]} diaAtual={diaAtual} />
            </div>
          )}

          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-bold text-[#1a1a1a]">Situação por tipo de conta</h2>
              <p className="text-[12px] text-[#6c757d] mt-0.5">Visão geral do status das contas por categoria</p>
            </div>
            <Link href="/contas" className="text-[12.5px] font-semibold text-info hover:underline">Ver todas as contas</Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
                {porTipo.map(({ t, ativas, mapear, pagas, aguardando, aLancar, atrasadas }) => {
                  const T = TIPOS[t];
                  const base = ativas || 1;
                  const pctPagas = Math.round((pagas / base) * 100);
                  return (
                    <div key={t} className="bg-white border border-linha rounded-xl p-4 shadow-leve hover:shadow-media transition">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: T.bg }}>
                          <TipoIcon tipo={t} size={18} color={T.c} />
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-[#1a1a1a] leading-tight">{T.n}</div>
                          <div className="text-[11.5px] text-[#6c757d]">{ativas} contas</div>
                        </div>
                        <Link href={`/contas?tipo=${t}`} className="ml-auto text-[#adb5bd] hover:text-[#1a1a1a]">
                          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7.5 4.5l6 5.5-6 5.5" /></svg>
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-[#f1f3f5] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pctPagas, 100)}%`, background: T.c }} />
                        </div>
                        <span className="text-[11.5px] font-semibold shrink-0">{pctPagas}%</span>
                      </div>
                      <div className="flex gap-3 text-[11px] text-[#6c757d]">
                        <span>Pagas <b className="text-[#1a1a1a]">{pagas}</b></span>
                        <span>Aguardando <b className="text-[#1a1a1a]">{aguardando}</b></span>
                        <span>A lançar <b className="text-[#1a1a1a]">{aLancar}</b></span>
                        {atrasadas > 0 && <span className="text-alerr font-semibold ml-auto">{atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>}
                      </div>
                      {mapear > 0 && <div className="mt-2 text-[10.5px] text-alerr font-medium">{mapear} sem origem mapeada</div>}
                    </div>
                  );
                })}
              </div>
            </div>


        <div className="space-y-6">
          <div className="rounded-xl p-5 border border-amarelo/30" style={{ background: "#FFF8E8" }}>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="text-lg">⚠️</span>
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Alertas importantes</h3>
            </div>
            <div className="space-y-2.5">
              <LinhaAlerta emoji="⚠️" label="Contas atrasadas" valor={totAtrasadas} href="/alertas" />
              <LinhaAlerta emoji="🔔" label="Aprovações pendentes" valor={aprovacoesPendentes} href="/aprovacoes" />
              <LinhaAlerta emoji="⛔" label="Pagamentos com falha" valor={pagamentosComFalha} href="/pagamentos" />
              <LinhaAlerta emoji="📍" label="Origem não mapeada" valor={totMapear} href="/alertas" />
            </div>
            <Link href="/alertas" className="block text-center mt-4 text-[12.5px] font-bold text-amarelo-dark hover:underline">
              Ver todos os alertas →
            </Link>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-bold text-[#1a1a1a]">Lojas fechadas</h3>
              <Link href="/lojas?status=encerrada" className="text-[11.5px] font-semibold text-info hover:underline">Ver todas</Link>
            </div>
            <div className="text-[26px] font-bold text-[#1a1a1a] leading-none mt-2 mb-3">{totalLojasFechadas ?? 0}</div>
            {(lojasEncerradas ?? []).length > 0 ? (
              <ul className="space-y-2.5">
                {(lojasEncerradas ?? []).map((l: any, i: number) => (
                  <li key={i} className="flex items-center gap-2.5 text-[12.5px]">
                    <div className="w-7 h-7 rounded-lg bg-alerr-bg text-alerr grid place-items-center text-[10px] font-bold shrink-0">{l.coban?.slice(0, 2) ?? "—"}</div>
                    <div className="min-w-0 flex-1">
                      <b className="font-semibold block truncate">{l.codigo}</b>
                    </div>
                    <span className="text-[10.5px] text-[#adb5bd] font-mono shrink-0">{l.encerrada_em ? formatarDataSemFuso(l.encerrada_em) : "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-[#adb5bd]">Nenhuma loja fechada ainda.</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Evolução mensal</h3>
            <div className="text-[22px] font-bold text-[#1a1a1a] leading-none">{money(totalMesAtual)}</div>
            <div className="text-[11.5px] text-[#6c757d] mt-1 mb-4">
              Total em {formatarPeriodo(mes, ano).split("/")[0]}
              {variacaoEvolucao !== null && (
                <span className={variacaoEvolucao >= 0 ? "text-ok font-semibold ml-1.5" : "text-alerr font-semibold ml-1.5"}>
                  {variacaoEvolucao >= 0 ? "↑" : "↓"} {Math.abs(variacaoEvolucao)}% vs {MES[mesAnterior - 1]}
                </span>
              )}
            </div>
            <div className="flex items-end gap-1.5 h-[90px]">
              {evolucaoPorMes.map((m) => (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-1.5" title={`${MES[m.mes - 1]}: ${money(m.total)}`}>
                  <div className="w-full flex items-end h-[70px]">
                    <div className="w-full rounded-t" style={{ height: `${Math.max((m.total / maxEvolucao) * 100, 3)}%`, background: m.mes === mes ? "#FFC107" : "#FFE9A8" }} />
                  </div>
                  <span className="text-[9.5px] text-[#adb5bd] font-mono">{MES[m.mes - 1]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-1">Top 5 lojas</h3>
            <p className="text-[11.5px] text-[#6c757d] mb-3.5">maiores gastos do mês</p>
            <div className="space-y-2.5">
              {topLojas.map(([cod, valor], i) => (
                <div key={cod} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="w-5 h-5 rounded-md bg-[#f1f3f5] grid place-items-center text-[10.5px] font-bold text-[#6c757d] shrink-0">{i + 1}</span>
                  <span className="font-semibold text-[#1a1a1a] truncate flex-1">{cod}</span>
                  <span className="font-mono font-semibold shrink-0">{money(valor)}</span>
                </div>
              ))}
              {topLojas.length === 0 && <div className="text-[12.5px] text-[#adb5bd]">Sem lançamentos com valor este mês.</div>}
            </div>
            <Link href="/lojas" className="block text-center mt-4 pt-3 border-t border-linha2 text-[12px] font-semibold text-info hover:underline">Ver ranking completo</Link>
          </div>

          <div className="card p-4">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-3.5">Top fornecedores</h3>
            <div className="space-y-3">
              {topFornecedores.map(([nomeF, valor]) => (
                <div key={nomeF} className="flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-[#1a1a1a] truncate max-w-[130px]">{nomeF}</span>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold">{money(valor)}</div>
                    <div className="text-[10.5px] text-[#adb5bd]">{Math.round((valor / totalFornecedores) * 100)}%</div>
                  </div>
                </div>
              ))}
              {topFornecedores.length === 0 && <div className="text-[12.5px] text-[#adb5bd]">Sem lançamentos com valor este mês.</div>}
            </div>
            <Link href="/fornecedores" className="block text-center mt-4 pt-3 border-t border-linha2 text-[12px] font-semibold text-info hover:underline">Ver todos</Link>
          </div>

          <div className="card p-4">
            <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-1">Resumo financeiro</h3>
            <p className="text-[11.5px] text-[#6c757d] mb-4">{formatarPeriodo(mes, ano)}</p>
            <div className="flex items-center gap-4">
              <Donut pct={pctPago} />
              <div className="flex-1 space-y-2 text-[12.5px]">
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-ok" />Pago <b className="ml-auto font-mono">{money(totalPago)}</b></div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FFC107" }} />Pendente <b className="ml-auto font-mono">{money(totalPendente)}</b></div>
              </div>
            </div>
            <Link href="/relatorios" className="block text-center mt-4 pt-3 border-t border-linha2 text-[12px] font-semibold text-info hover:underline">Ver relatório completo</Link>
          </div>
        </div>
      </div>
      </div>
  );
}

function LinhaAlerta({ emoji, label, valor, href }: { emoji: string; label: string; valor: number; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-[12.5px] hover:opacity-70 transition">
      <span>{emoji}</span>
      <span className="text-[#5c4a1f] font-medium">{label}</span>
      <span className="ml-auto font-bold text-[#1a1a1a] bg-white/70 rounded-full px-2 py-0.5 text-[11px]">{valor}</span>
    </Link>
  );
}

function Donut({ pct }: { pct: number }) {
  const raio = 30, circ = 2 * Math.PI * raio;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90">
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#FFE9A8" strokeWidth="10" />
      <circle cx="38" cy="38" r={raio} fill="none" stroke="#2E7D57" strokeWidth="10" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x="38" y="42" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1a1a1a" transform="rotate(90 38 38)">{pct}%</text>
    </svg>
  );
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  doc: <><path d="M6 3.5h6l4 4V19a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" /><path d="M12 3.5V8h4" /></>,
  calendar: <><rect x="3.5" y="5" width="15" height="13.5" rx="2" /><path d="M3.5 9.5h15M7 3v3.5M15 3v3.5" /></>,
  hourglass: <><path d="M6 3.5h10M6 18.5h10M6.5 3.5c0 4 3 4.5 3 6.5s-3 2.5-3 6.5M15.5 3.5c0 4-3 4.5-3 6.5s3 2.5 3 6.5" /></>,
  pin: <><path d="M10 18.5s6-5.4 6-9.9A6 6 0 004 8.6c0 4.5 6 9.9 6 9.9z" /><circle cx="10" cy="8.5" r="2.2" /></>,
};

function KpiCard({ icon, cor, value, label, variacao }: { icon: string; cor: string; value: number; label: string; variacao: number | null }) {
  return (
    <div className="relative bg-white border border-linha rounded-xl p-4 shadow-leve overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-full grid place-items-center" style={{ background: "#fdf3e3" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#c9922a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{KPI_ICONS[icon]}</svg>
        </div>
        <svg width="44" height="18" viewBox="0 0 46 20" fill="none" className="mt-1 opacity-80">
          <path d="M1 14c4-2 6 4 10 2s5-9 9-7 6 8 10 5 5-10 9-8" stroke={cor} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <div className="text-[12.5px] text-gray-500 font-medium">{label}</div>
      <div className="text-[26px] font-bold text-gray-900 leading-none mt-1">{value}</div>
      {variacao !== null ? (
        <div className={`text-[11.5px] font-medium mt-2 flex items-center gap-1 ${variacao > 0 ? "text-ok" : variacao < 0 ? "text-alerr" : "text-[#adb5bd]"}`}>
          {variacao >= 0 ? "↑" : "↓"} {Math.abs(variacao)}% <span className="text-[#adb5bd] font-normal">vs mês anterior</span>
        </div>
      ) : (
        <div className="text-[10.5px] text-[#bbb] font-normal mt-2">sem dado do mês anterior ainda</div>
      )}
    </div>
  );
}