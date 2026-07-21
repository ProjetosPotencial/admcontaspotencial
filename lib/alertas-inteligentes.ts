import { Calendario, paraISO, type RegraVencimento } from "@/lib/calendario";

/**
 * Alertas proativos do assistente.
 *
 * Olha o mês corrente e aponta o que merece atenção antes de virar problema:
 * vencimento caindo em dia não útil, feriado chegando, valor fora do padrão
 * histórico do fornecedor e cobrança de conta já encerrada.
 */

export type Alerta = {
  chave: string;
  icone: string;
  titulo: string;
  detalhe?: string;
  href: string;
  /** alta = precisa agir hoje/amanhã */
  prioridade: "alta" | "media" | "baixa";
};

type LancamentoLike = {
  situacao: string;
  valor: number | null;
  contas?: {
    tipo?: string;
    dia_vencimento?: number | null;
    fornecedor_nome?: string | null;
    status?: string | null;
    lojas?: { codigo?: string | null; uf?: string | null } | null;
  } | null;
};

/** quanto acima da média já é "fora do padrão" */
const FATOR_ACIMA = 1.6;
/** ignora variação em valores pequenos, onde % engana */
const VALOR_MINIMO_ANALISE = 80;

export function gerarAlertas(
  lancamentos: LancamentoLike[],
  historico: { fornecedor: string | null; tipo: string | null; valor: number | null }[],
  cal: { calendario: Calendario; regra: RegraVencimento },
  ano: number,
  mes: number,
  hoje: Date = new Date()
): Alerta[] {
  const alertas: Alerta[] = [];
  const emAberto = lancamentos.filter((l) => l.situacao === "pendente");
  const ehMesCorrente = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;

  // ---- 1. vencimentos caindo em dia não útil ----
  const naoUteis = new Map<string, { qtd: number; valor: number; motivo: string; dia: number }>();
  for (const l of emAberto) {
    const dia = l.contas?.dia_vencimento;
    if (!dia) continue;
    const ultimo = new Date(ano, mes, 0).getDate();
    if (dia > ultimo) continue;
    const data = new Date(ano, mes - 1, dia);
    if (ehMesCorrente && data < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) continue;
    if (cal.calendario.ehDiaUtil(data)) continue;

    const iso = paraISO(data);
    const atual = naoUteis.get(iso) ?? {
      qtd: 0, valor: 0, dia,
      motivo: cal.calendario.motivoNaoUtil(data) ?? "dia não útil",
    };
    atual.qtd++;
    atual.valor += Number(l.valor ?? 0);
    naoUteis.set(iso, atual);
  }

  for (const [iso, info] of Array.from(naoUteis.entries()).sort()) {
    // compara só a data (sem hora), senão "faltam 2 dias" vira 3 por causa do horário
    const [aA, mM, dD] = iso.split("-").map(Number);
    const alvo = new Date(aA, mM - 1, dD).getTime();
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
    const diasAte = Math.round((alvo - base) / 86400000);
    const quando = diasAte <= 0 ? "hoje" : diasAte === 1 ? "amanhã" : `em ${diasAte} dias`;
    const acao = cal.regra === "antecipar" ? "Antecipar o pagamento?" : "O vencimento foi adiado para o próximo dia útil.";
    alertas.push({
      chave: `nao-util-${iso}`,
      icone: "📅",
      titulo: `${info.qtd} ${info.qtd === 1 ? "conta vence" : "contas vencem"} ${quando}, em ${info.motivo}`,
      detalhe: acao,
      href: "/contas",
      prioridade: diasAte <= 2 ? "alta" : "media",
    });
  }

  // ---- 2. feriado chegando (próximos 7 dias) ----
  if (ehMesCorrente) {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
      const f = cal.calendario.feriadoEm(d);
      if (!f) continue;
      const escopo = f.escopo === "estadual" ? ` em ${f.uf}` : f.escopo === "municipal" ? ` em ${f.municipio}` : "";
      alertas.push({
        chave: `feriado-${f.data}`,
        icone: "🎌",
        titulo: `${i === 1 ? "Amanhã" : `Em ${i} dias`} é ${f.nome}${escopo}`,
        detalhe: "Bancos e portais podem não processar pagamentos nesse dia.",
        href: "/contas",
        prioridade: i <= 2 ? "alta" : "baixa",
      });
      break; // o próximo feriado já basta
    }
  }

  // ---- 3. valores fora do padrão ----
  const media = new Map<string, { soma: number; n: number }>();
  for (const h of historico) {
    const v = Number(h.valor ?? 0);
    if (!v || !h.fornecedor) continue;
    const k = `${h.fornecedor}|${h.tipo ?? ""}`.toLowerCase();
    const a = media.get(k) ?? { soma: 0, n: 0 };
    a.soma += v; a.n++;
    media.set(k, a);
  }

  let foraDoPadrao = 0;
  let exemplo = "";
  for (const l of lancamentos) {
    const v = Number(l.valor ?? 0);
    const forn = l.contas?.fornecedor_nome;
    if (!v || v < VALOR_MINIMO_ANALISE || !forn) continue;
    const k = `${forn}|${l.contas?.tipo ?? ""}`.toLowerCase();
    const m = media.get(k);
    if (!m || m.n < 2) continue;
    const med = m.soma / m.n;
    if (v > med * FATOR_ACIMA) {
      foraDoPadrao++;
      if (!exemplo) exemplo = `${l.contas?.lojas?.codigo ?? "loja"} · ${forn}`;
    }
  }
  if (foraDoPadrao > 0) {
    alertas.push({
      chave: "fora-padrao",
      icone: "📈",
      titulo: `${foraDoPadrao} ${foraDoPadrao === 1 ? "conta está" : "contas estão"} acima do padrão do fornecedor`,
      detalhe: exemplo ? `Ex.: ${exemplo}. Vale conferir antes de aprovar.` : undefined,
      href: "/lancamentos",
      prioridade: "media",
    });
  }

  // ---- 4. cobrança em conta encerrada ----
  const encerradasCobrando = emAberto.filter((l) => l.contas?.status === "encerrado").length;
  if (encerradasCobrando > 0) {
    alertas.push({
      chave: "encerrada-cobrando",
      icone: "🏢",
      titulo: `${encerradasCobrando} ${encerradasCobrando === 1 ? "cobrança aberta" : "cobranças abertas"} em conta já encerrada`,
      detalhe: "Provavelmente sobra de antes do encerramento.",
      href: "/contas",
      prioridade: "baixa",
    });
  }

  const peso = { alta: 0, media: 1, baixa: 2 };
  return alertas.sort((a, b) => peso[a.prioridade] - peso[b.prioridade]);
}
