"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS, ORIGENS } from "@/lib/types";
import { money } from "@/lib/format";

type Item = {
  id: string; nome_arquivo: string; drive_web_view_link: string | null;
  valor_detectado: number | null; codigo_barras_detectado: string | null; tipo_detectado: string | null;
  loja_sugerida_id: string | null; loja_sugerida_texto: string | null; conta_sugerida_id: string | null;
  confianca: "alta" | "media" | "baixa"; observacao: string | null;
  competencia_ano?: number | null; competencia_mes?: number | null;
  classe_documento?: "boleto" | "nota_fiscal" | "chamado" | null;
  chamado_numero?: string | null; chamado_rotulo?: string | null;
  requerente?: string | null;
  destinatario_detectado?: string | null; destinatario_cnpj_detectado?: string | null;
  chave_acesso?: string | null;
  conta_existente_id?: string | null;
  origem_entrada?: string | null;
  beneficiario?: string | null;
  fornecedor_detectado?: string | null; cnpj_detectado?: string | null;
  numero_documento_detectado?: string | null;
  emissao_ano?: number | null; emissao_mes?: number | null; emissao_dia?: number | null;
  duplicada?: boolean | null;
};

type Loja = {
  id: string; codigo: string;
  coban?: string | null; cnpj?: string | null; cidade?: string | null; uf?: string | null;
  responsavel?: string | null; contato?: string | null; setor?: string | null; empresa?: string | null;
  empresas?: { nome: string | null; razao_social?: string | null; cnpj?: string | null } | null;
};

/** Dados que a janela de confirmação mostra antes de lançar de verdade. */
type Previa = {
  loja: string;
  empresa: string;
  fornecedor: string;
  valor: number | null;
  vencimento: string;
  formaPagamento: string;
  contaNova: boolean;
  ano: number;
  mes: number;
  lojaId: string;
  tipo: string;
  origem: string;
};

const CONFIANCA_LABEL: Record<string, { texto: string; cor: string }> = {
  alta: { texto: "Confiança alta", cor: "bg-ok-bg text-ok" },
  media: { texto: "Confiança média - confere antes", cor: "bg-amb-bg text-amb" },
  baixa: { texto: "Não identificado - escolhe manual", cor: "bg-alerr-bg text-alerr" },
};

export default function CaixaEntradaClient({ itens: itensIniciais, lojas, usuarioId }: { itens: Item[]; lojas: Loja[]; usuarioId: string | null }) {
  const supabase = createClient();
  const [itens, setItens] = useState(itensIniciais);
  const notasFiscais = itens.filter((i) => i.classe_documento === "nota_fiscal");
  const chamados = itens.filter((i) => i.classe_documento === "chamado");
  const boletos = itens.filter((i) => i.classe_documento !== "nota_fiscal" && i.classe_documento !== "chamado");
  const [processando, setProcessando] = useState<string | null>(null);
  // acumula as confirmações da rodada pra mandar UM aviso ao Slack, não sete
  const loteAviso = useRef<{ loja: string | null; tipo: string; valor: number | null; fornecedor?: string | null }[]>([]);
  const timerAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * Avisa o grupo que uma conta virou lançamento.
   *
   * Agrupa de propósito: numa rodada de importação a pessoa confirma um card
   * atrás do outro, e uma mensagem por clique jogaria sete avisos seguidos no
   * canal. O aviso sai 4 segundos depois do último clique, com o que foi
   * confirmado na sequência — uma mensagem em vez de sete.
   *
   * Falhar aqui nunca atrapalha quem está lançando: o lançamento já está
   * gravado quando isto roda.
   */
  function avisarLancamento(dados: { loja: string | null; tipo: string; valor: number | null; fornecedor?: string | null }) {
    loteAviso.current.push(dados);
    if (timerAviso.current) clearTimeout(timerAviso.current);

    timerAviso.current = setTimeout(() => {
      const lote = loteAviso.current;
      loteAviso.current = [];
      if (lote.length === 0) return;

      const total = lote.reduce((s, l) => s + Number(l.valor ?? 0), 0);
      const texto = lote.length === 1
        ? `✅ *Conta lançada* — ${lote[0].loja ?? "loja"} · ${lote[0].tipo}` +
          (lote[0].fornecedor ? ` · ${lote[0].fornecedor}` : "") +
          (lote[0].valor != null ? ` · ${money(lote[0].valor)}` : "") +
          `\n_confirmada na Caixa de Entrada_`
        : `✅ *${lote.length} contas lançadas* pela Caixa de Entrada · ${money(total)}\n` +
          lote.map((l) => `• ${l.loja ?? "loja"} · ${l.tipo}${l.valor != null ? ` — ${money(l.valor)}` : ""}`).join("\n");

      fetch("/api/notificar-evento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento: "lancamento_lote", texto }),
      }).catch(() => {});
    }, 4000);
  }

  async function importar() {
    setProcessando("__importar__");
    try {
      const resp = await fetch("/api/importar-caixa-entrada/testar", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) { setToast(json.error ?? "Erro ao importar."); }
      else if (json.novos > 0) { setToast(`${json.novos} arquivo(s) novo(s) importado(s).`); setTimeout(() => window.location.reload(), 1200); }
      else { setToast(json.mensagem ?? "Nada novo na pasta."); }
    } catch {
      setToast("Não foi possível importar agora.");
    }
    setProcessando(null);
    setTimeout(() => setToast(null), 3500);
  }

  async function reprocessar() {
    setProcessando("__reprocessar__");
    try {
      const resp = await fetch("/api/reprocessar-pendentes", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) { setToast(json.error ?? "Erro ao reprocessar."); }
      else if (json.completados > 0) { setToast(`${json.completados} boleto(s) completado(s) de ${json.candidatos}.`); setTimeout(() => window.location.reload(), 1500); }
      else { setToast(`Nenhum completado (${json.candidatos} verificado(s), ${json.sem_codigo_barras} ainda sem código de barras).`); }
    } catch {
      setToast("Não foi possível reprocessar agora.");
    }
    setProcessando(null);
    setTimeout(() => setToast(null), 4500);
  }

  async function reprocessarChamados() {
    setProcessando("__reprocessar_chamados__");
    try {
      const resp = await fetch("/api/reprocessar-chamados", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) { setToast(json.error ?? "Erro ao reler chamados."); }
      else if (json.candidatos === 0) { setToast("Nenhum chamado ilegível pendente. Tudo lido! 🎉"); }
      else if (json.completados > 0) { setToast(`${json.completados} de ${json.candidatos} lidos neste lote. Clique de novo se ainda houver pendentes.`); setTimeout(() => window.location.reload(), 2000); }
      else { setToast(`Lote de ${json.candidatos} verificado, ${json.sem_leitura} ainda ilegíveis, ${json.falhas} com erro.`); }
    } catch {
      setToast("Não foi possível reler os chamados agora.");
    }
    setProcessando(null);
    setTimeout(() => setToast(null), 4500);
  }

  async function reclassificar(item: Item, nova: "boleto" | "nota_fiscal") {
    setProcessando(item.id);
    const { error } = await supabase.from("caixa_entrada_boletos")
      .update({ classe_documento: nova }).eq("id", item.id);
    if (error) {
      setToast("Não foi possível mudar a classificação.");
      setTimeout(() => setToast(null), 3000);
    } else {
      // muda a classe no estado local -> o card migra de coluna na hora
      setItens((lista) => lista.map((i) => (i.id === item.id ? { ...i, classe_documento: nova } : i)));
    }
    setProcessando(null);
  }

  async function confirmarChamado(item: Item, lojaId: string) {
    setProcessando(item.id);
    try {
      const fornecedor = item.fornecedor_detectado?.trim() || null;
      const ano = item.emissao_ano ?? new Date().getFullYear();
      const mes = item.emissao_mes ?? (new Date().getMonth() + 1);

      // conta de Compra por loja + fornecedor (não duplica)
      let consulta = supabase.from("contas").select("id")
        .eq("loja_id", lojaId).eq("tipo", "compra").eq("status", "ativo");
      consulta = fornecedor ? consulta.eq("fornecedor_nome", fornecedor) : consulta.is("fornecedor_nome", null);
      const { data: conta } = await consulta.maybeSingle();
      let contaId = conta?.id as string | undefined;
      if (!contaId) {
        const { data: nova, error: e1 } = await supabase.from("contas").insert({
          loja_id: lojaId, tipo: "compra", fornecedor_nome: fornecedor, origem: "email",
          status: "ativo", situacao_cadastro: "aprovada",
        }).select("id").single();
        if (e1 || !nova) { setToast("Não foi possível criar a conta."); setProcessando(null); return; }
        contaId = nova.id;
      }

      // grava os dados da NF/chamado na conta (reflete o último lançamento)
      await supabase.from("contas").update({
        chamado_numero: item.chamado_numero ?? null,
        numero_nf: item.numero_documento_detectado ?? null,
        remetente_cnpj: item.cnpj_detectado ?? null,
        destinatario_razao: item.destinatario_detectado ?? null,
        destinatario_cnpj: item.destinatario_cnpj_detectado ?? null,
        chave_acesso: item.chave_acesso ?? null,
      }).eq("id", contaId);

      const agora = new Date();
      // Compra vinda de chamado do GLPI NÃO entra na fila de Aprovações: ela
      // já foi autorizada lá, no fluxo de compras. Entrar aqui de novo seria
      // pedir a mesma assinatura duas vezes, em sistemas diferentes.
      // Por isso nasce em "aprovado" — aparece em Lançamentos, em Contas e na
      // fila de Pagamentos, mas não na de Aprovações.
      const { data: lanc, error } = await supabase.from("lancamentos").upsert({
        conta_id: contaId, ano, mes, valor: item.valor_detectado, situacao: "aprovado",
        lancado_em: agora.toISOString(), lancado_por: usuarioId,
        aprovado_em: agora.toISOString(),
        codigo_barras: item.codigo_barras_detectado,
        comprovante_drive_url: item.drive_web_view_link,
      }, { onConflict: "conta_id,ano,mes" }).select("id").single();
      if (error || !lanc) { setToast("Não foi possível lançar."); setProcessando(null); return; }

      // Fica registrado POR QUE não passou por aprovação. Sem isso, quem
      // auditar vê uma conta aprovada sem aprovador e não entende.
      await supabase.from("lancamento_historico").insert({
        lancamento_id: lanc.id,
        acao: "aprovacao_dispensada",
        de: "—", para: "aprovado",
        quem: usuarioId, em: agora.toISOString(),
        motivo: "Compra autorizada no chamado do GLPI",
        comentario: item.chamado_numero
          ? `Compra do chamado ${item.chamado_numero}: aprovação já ocorreu no GLPI.`
          : "Compra vinda do GLPI: aprovação já ocorreu lá.",
      });

      await supabase.from("caixa_entrada_boletos").update({
        status: "confirmado", revisado_por: usuarioId ?? null, revisado_em: agora.toISOString(), lancamento_criado_id: lanc.id,
      }).eq("id", item.id);

      // registra a compra individual (histórico soma por mês e lista cada compra da loja)
      await supabase.from("compra_detalhe").insert({
        conta_id: contaId, loja_id: lojaId, fornecedor_nome: fornecedor,
        valor: item.valor_detectado, ano, mes, dia: item.emissao_dia ?? null,
        chamado_numero: item.chamado_numero ?? null, numero_nf: item.numero_documento_detectado ?? null,
      });

      // notifica o Slack (não bloqueia o fluxo se falhar)
      fetch("/api/notificar-chamado-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chamado: item.chamado_numero,
          lojaId,
          numeroNf: item.numero_documento_detectado,
          pdfLink: item.drive_web_view_link,
        }),
      }).catch(() => {});

      setItens((lista) => lista.filter((i) => i.id !== item.id));
      setToast([
        "Compra lançada com sucesso!",
        item.chamado_numero ? `Chamado: ${item.chamado_numero}` : null,
        fornecedor ? `Fornecedor: ${fornecedor}` : null,
        "Não passa por Aprovações (já foi autorizada no GLPI) — seguiu para Pagamentos.",
      ].filter(Boolean).join("\n"));
    } catch {
      setToast("Erro ao lançar a compra.");
    }
    setProcessando(null);
    setTimeout(() => setToast(null), 5000);
  }

  async function confirmarNF(item: Item, admLojaId: string, tipo: string, previa?: PreviaNF) {
    setProcessando(item.id);
    try {
      const fornecedor = item.fornecedor_detectado?.trim() || null;
      const ano = item.emissao_ano ?? null;
      const mes = item.emissao_mes ?? null;
      if (!ano || !mes) { setToast("NF sem data de emissão — informe a emissão antes de lançar."); setProcessando(null); return; }

      // Trava de duplicidade: essa NF (número + CNPJ/fornecedor) já foi lançada?
      if (item.numero_documento_detectado && (item.cnpj_detectado || item.fornecedor_detectado)) {
        let dq = supabase.from("caixa_entrada_boletos")
          .select("revisado_em, revisado_por")
          .eq("classe_documento", "nota_fiscal").eq("status", "confirmado")
          .eq("numero_documento_detectado", item.numero_documento_detectado)
          .neq("id", item.id);
        dq = item.cnpj_detectado ? dq.eq("cnpj_detectado", item.cnpj_detectado) : dq.eq("fornecedor_detectado", item.fornecedor_detectado);
        const { data: existentes } = await dq.order("revisado_em", { ascending: false, nullsFirst: false }).limit(1);
        const ja = existentes?.[0];
        if (ja) {
          let quem = "outro usuário";
          if (ja.revisado_por) {
            const { data: p } = await supabase.from("perfis").select("nome").eq("id", ja.revisado_por).maybeSingle();
            quem = p?.nome ?? quem;
          }
          const quando = ja.revisado_em ? new Date(ja.revisado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "data anterior";
          setToast(`Essa NF (nº ${item.numero_documento_detectado}) já foi lançada em ${quando} por ${quem}. Não foi lançada de novo.`);
          setProcessando(null); setTimeout(() => setToast(null), 6000); return;
        }
      }

      // Conta identificada por loja Administrativo + tipo + fornecedor (uma
      // conta por fornecedor). Não existe ainda? cria na hora.
      let consulta = supabase.from("contas").select("id")
        .eq("loja_id", admLojaId).eq("tipo", tipo).eq("status", "ativo");
      consulta = fornecedor ? consulta.eq("fornecedor_nome", fornecedor) : consulta.is("fornecedor_nome", null);
      const { data: conta } = await consulta.maybeSingle();
      let contaId = conta?.id as string | undefined;

      if (!contaId) {
        const { data: nova, error: errConta } = await supabase.from("contas").insert({
          loja_id: admLojaId, tipo, fornecedor_nome: fornecedor, origem: "email",
          status: "ativo", situacao_cadastro: "aprovada",
        }).select("id").single();
        if (errConta || !nova) { setToast("Não foi possível criar a conta."); setProcessando(null); return; }
        contaId = nova.id;
      }

      // grava os dados da NF na conta (reflete o último lançamento)
      await supabase.from("contas").update({
        numero_nf: item.numero_documento_detectado ?? null,
        remetente_cnpj: item.cnpj_detectado ?? null,
        destinatario_razao: item.destinatario_detectado ?? null,
        destinatario_cnpj: item.destinatario_cnpj_detectado ?? null,
        chave_acesso: item.chave_acesso ?? null,
      }).eq("id", contaId);

      const agora = new Date();
      const { data: lanc, error } = await supabase.from("lancamentos").upsert({
        conta_id: contaId, ano, mes, valor: item.valor_detectado, situacao: "lancado",
        lancado_em: agora.toISOString(), codigo_barras: item.codigo_barras_detectado, comprovante_drive_url: item.drive_web_view_link,
      }, { onConflict: "conta_id,ano,mes" }).select("id").single();
      if (error || !lanc) { setToast("Não foi possível lançar."); setProcessando(null); return; }

      await supabase.from("caixa_entrada_boletos").update({
        status: "confirmado", revisado_por: usuarioId ?? null, revisado_em: agora.toISOString(), lancamento_criado_id: lanc.id,
      }).eq("id", item.id);

      await supabase.from("compra_detalhe").insert({
        conta_id: contaId, loja_id: admLojaId, fornecedor_nome: fornecedor,
        valor: item.valor_detectado, ano, mes, dia: item.emissao_dia ?? null,
        chamado_numero: item.chamado_numero ?? null, numero_nf: item.numero_documento_detectado ?? null,
      });

      setItens((lista) => lista.filter((i) => i.id !== item.id));
      avisarLancamento({
        loja: previa?.empresa ?? null,
        tipo: TIPOS[tipo]?.n ?? tipo,
        valor: item.valor_detectado,
        fornecedor,
      });

      setToast([
        "NF lançada com sucesso!",
        previa?.empresa ? `Empresa: ${previa.empresa}` : null,
        fornecedor ? `Fornecedor: ${fornecedor}` : null,
        `Emissão: ${String(item.emissao_dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`,
        "Já está na fila de Aprovações.",
      ].filter(Boolean).join("\n"));
    } catch {
      setToast("Erro ao lançar NF.");
    }
    setProcessando(null);
    setTimeout(() => setToast(null), 5000);
  }

  async function confirmar(item: Item, lojaId: string, tipo: string, ano: number, mes: number, origem: string, previa?: Previa) {
    setProcessando(item.id);
    try {
      const { data: conta } = await supabase.from("contas").select("id").eq("loja_id", lojaId).eq("tipo", tipo).eq("status", "ativo").maybeSingle();
      let contaId = conta?.id as string | undefined;

      // se não existe conta ativa desse tipo, cria uma na hora (loja + tipo + origem)
      if (!contaId) {
        const { data: novaConta, error: errConta } = await supabase.from("contas").insert({
          loja_id: lojaId, tipo, origem, status: "ativo", situacao_cadastro: "aprovada",
        }).select("id").single();
        if (errConta || !novaConta) { setToast("Não foi possível criar a conta."); setProcessando(null); return; }
        contaId = novaConta.id;
      }

      const agora = new Date();
      const { data: lancamento, error } = await supabase.from("lancamentos").upsert({
        conta_id: contaId, ano, mes,
        valor: item.valor_detectado, situacao: "lancado", lancado_em: agora.toISOString(),
        codigo_barras: item.codigo_barras_detectado, comprovante_drive_url: item.drive_web_view_link,
      }, { onConflict: "conta_id,ano,mes" }).select("id").single();

      if (error || !lancamento) { setToast("Não foi possível lançar."); setProcessando(null); return; }

      await supabase.from("caixa_entrada_boletos").update({
        status: "confirmado", revisado_por: usuarioId ?? null, revisado_em: agora.toISOString(), lancamento_criado_id: lancamento.id,
      }).eq("id", item.id);

      setItens((lista) => lista.filter((i) => i.id !== item.id));

      // Avisa o grupo, igual ao lançamento feito pela ficha da conta. Esse é
      // o caminho por onde entra a maior parte dos boletos (Drive e Slack já
      // lidos pela IA) e era o único que não notificava ninguém.
      avisarLancamento({
        loja: previa?.loja ?? null,
        tipo: TIPOS[tipo]?.n ?? tipo,
        valor: item.valor_detectado,
      });

      // mensagem detalhada: confirma o que saiu da caixa e virou lançamento
      setToast([
        "Conta lançada com sucesso!",
        previa?.loja ? `Loja: ${previa.loja}` : null,
        previa?.vencimento && previa.vencimento !== "—" ? `Vencimento: ${previa.vencimento}` : null,
        "Já está na fila de Aprovações.",
      ].filter(Boolean).join("\n"));
    } catch {
      setToast("Erro ao confirmar.");
    }
    setProcessando(null);
    setTimeout(() => setToast(null), 5000);
  }

  async function substituirLancamento(item: Item) {
    if (!item.conta_existente_id) return;
    setProcessando(item.id);
    const contaId = item.conta_existente_id;
    // atualiza os dados da NF na conta existente
    await supabase.from("contas").update({
      numero_nf: item.numero_documento_detectado ?? null,
      remetente_cnpj: item.cnpj_detectado ?? null,
      destinatario_razao: item.destinatario_detectado ?? null,
      destinatario_cnpj: item.destinatario_cnpj_detectado ?? null,
      chave_acesso: item.chave_acesso ?? null,
    }).eq("id", contaId);
    // atualiza o valor do último lançamento e registra histórico
    const { data: lancs } = await supabase.from("lancamentos").select("id").eq("conta_id", contaId).order("lancado_em", { ascending: false }).limit(1);
    if (lancs?.[0]?.id) {
      if (item.valor_detectado != null) await supabase.from("lancamentos").update({ valor: item.valor_detectado }).eq("id", lancs[0].id);
      await supabase.from("lancamento_historico").insert({
        lancamento_id: lancs[0].id, de: "—",
        para: item.numero_documento_detectado ? `NF ${item.numero_documento_detectado}` : "dados atualizados",
        comentario: `Substituição por reenvio do chamado ${item.chamado_numero ?? ""}`.trim(),
        quem: usuarioId ?? null, em: new Date().toISOString(),
      });
    }
    await supabase.from("caixa_entrada_boletos").update({ status: "confirmado", revisado_em: new Date().toISOString() }).eq("id", item.id);
    setItens((lista) => lista.filter((i) => i.id !== item.id));
    setToast("Lançamento substituído com sucesso.");
    setProcessando(null);
  }

  async function rejeitar(item: Item) {
    setProcessando(item.id);
    await supabase.from("caixa_entrada_boletos").update({ status: "rejeitado", revisado_por: usuarioId ?? null, revisado_em: new Date().toISOString() }).eq("id", item.id);
    setItens((lista) => lista.filter((i) => i.id !== item.id));
    setProcessando(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <span className="text-[13px] text-[#6c757d]">{itens.length} pendente{itens.length !== 1 ? "s" : ""} de revisão</span>
        <div className="flex items-center gap-2">
          <button onClick={reprocessarChamados} disabled={!!processando} className="btn-secundario disabled:opacity-50" title="Relê as NF dos chamados que ficaram pendentes">
            {processando === "__reprocessar_chamados__" ? "Relendo NF..." : "Reler NF dos chamados"}
          </button>
          <button onClick={reprocessar} disabled={!!processando} className="btn-secundario disabled:opacity-50" title="Relê pela API os boletos que ficaram sem código de barras">
            {processando === "__reprocessar__" ? "Reprocessando..." : "Reprocessar boletos"}
          </button>
          <button onClick={importar} disabled={processando === "__importar__"} className="btn-primario disabled:opacity-50">
            {processando === "__importar__" ? "Verificando pasta..." : "Verificar pasta agora"}
          </button>
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="card text-center py-16 text-[#adb5bd]">
          Nada esperando revisão. Clica em "Verificar pasta agora" pra checar se chegou algo novo.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <h2 className="text-[13px] font-bold text-[#6c757d] uppercase tracking-wide">
              Boletos e faturas ({boletos.length + chamados.length})
            </h2>
            {chamados.map((item) => (
              <ChamadoCard key={item.id} item={item} lojas={lojas} processando={processando === item.id}
                onConfirmarChamado={confirmarChamado} onRejeitar={rejeitar}
                onEditado={(id, patch) => setItens((lista) => lista.map((i) => (i.id === id ? { ...i, ...patch } : i)))}
                onSubstituir={substituirLancamento} />
            ))}
            {boletos.length === 0 && chamados.length === 0 ? (
              <div className="card text-center py-10 text-[13px] text-[#adb5bd]">Nenhum boleto esperando revisão.</div>
            ) : boletos.map((item) => (
              <ItemCard key={item.id} item={item} lojas={lojas} processando={processando === item.id}
                onConfirmar={confirmar} onRejeitar={rejeitar} onReclassificar={reclassificar} />
            ))}
          </div>
          <div className="space-y-4">
            <h2 className="text-[13px] font-bold text-[#6c757d] uppercase tracking-wide">
              Notas fiscais ({notasFiscais.length})
            </h2>
            {notasFiscais.length === 0 ? (
              <div className="card text-center py-10 text-[13px] text-[#adb5bd]">Nenhuma nota fiscal esperando revisão.</div>
            ) : notasFiscais.map((item) => (
              <NotaFiscalCard key={item.id} item={item} lojas={lojas} processando={processando === item.id}
                onConfirmarNF={confirmarNF} onRejeitar={rejeitar} onReclassificar={reclassificar} />
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ebano text-white px-5 py-3 rounded-lg text-[13px] shadow-forte z-50 whitespace-pre-line text-center">
          {toast}
        </div>
      )}
    </>
  );
}

type PreviaNF = { empresa: string };

function ChamadoCard({ item, lojas, processando, onConfirmarChamado, onRejeitar, onEditado, onSubstituir }: {
  item: Item; lojas: Loja[]; processando: boolean;
  onConfirmarChamado: (item: Item, lojaId: string) => void;
  onRejeitar: (item: Item) => void;
  onEditado: (id: string, patch: Partial<Item>) => void;
  onSubstituir: (item: Item) => void;
}) {
  const [lojaId, setLojaId] = useState("");
  const [busca, setBusca] = useState("");
  const [editandoNf, setEditandoNf] = useState(false);
  const [salvandoNf, setSalvandoNf] = useState(false);
  const [efFornecedor, setEfFornecedor] = useState(item.fornecedor_detectado ?? "");
  const [efCnpj, setEfCnpj] = useState(item.cnpj_detectado ?? "");
  const [efNumero, setEfNumero] = useState(item.numero_documento_detectado ?? "");
  const [efDest, setEfDest] = useState(item.destinatario_detectado ?? "");
  const [efDestCnpj, setEfDestCnpj] = useState(item.destinatario_cnpj_detectado ?? "");

  async function salvarNfCaixa() {
    setSalvandoNf(true);
    const supabase = createClient();
    const patch = {
      fornecedor_detectado: efFornecedor.trim() || null,
      cnpj_detectado: efCnpj.replace(/\D/g, "") || null,
      numero_documento_detectado: efNumero.trim() || null,
      destinatario_detectado: efDest.trim() || null,
      destinatario_cnpj_detectado: efDestCnpj.replace(/\D/g, "") || null,
    };
    await supabase.from("caixa_entrada_boletos").update(patch).eq("id", item.id);
    onEditado(item.id, patch);
    setSalvandoNf(false);
    setEditandoNf(false);
  }
  const pendente = item.observacao?.startsWith("Pendente de conferência");
  const lojasFiltradas = busca.trim()
    ? lojas.filter((l) => l.codigo.toLowerCase().includes(busca.toLowerCase())).slice(0, 30)
    : lojas.slice(0, 30);
  const lojaSel = lojas.find((l) => l.id === lojaId);
  const emissao = item.emissao_dia && item.emissao_mes && item.emissao_ano
    ? `${String(item.emissao_dia).padStart(2, "0")}/${String(item.emissao_mes).padStart(2, "0")}/${item.emissao_ano}` : "—";
  const cnpj = item.cnpj_detectado
    ? item.cnpj_detectado.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5") : "—";
  const linhas: [string, string][] = [
    ["Fornecedor (NF)", item.fornecedor_detectado ?? "—"],
    ["CNPJ", cnpj],
    ["Nº da nota", item.numero_documento_detectado ?? "—"],
    ["Valor", item.valor_detectado != null ? money(item.valor_detectado) : "—"],
    ["Emissão", emissao],
  ];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#f3e5f5] text-[#6a1b9a]">CHAMADO GLPI</span>
          <p className="text-[13px] text-[#6c757d] truncate" title={item.nome_arquivo}>
            {item.chamado_numero ? `Chamado ${item.chamado_numero}` : item.nome_arquivo}{item.chamado_rotulo ? ` · ${item.chamado_rotulo}` : ""}{item.requerente ? ` · Requerente: ${item.requerente}` : ""}
          </p>
        </div>
        {item.drive_web_view_link && (
          <a href={item.drive_web_view_link} target="_blank" rel="noreferrer" className="text-[12px] text-info shrink-0 hover:underline">Abrir pasta</a>
        )}
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-[#6c757d] font-medium">Dados da nota</span>
        <button onClick={() => { setEditandoNf((v) => !v); setEfFornecedor(item.fornecedor_detectado ?? ""); setEfCnpj(item.cnpj_detectado ?? ""); setEfNumero(item.numero_documento_detectado ?? ""); setEfDest(item.destinatario_detectado ?? ""); setEfDestCnpj(item.destinatario_cnpj_detectado ?? ""); }}
          className="text-[11.5px] text-info hover:underline">{editandoNf ? "cancelar" : "editar"}</button>
      </div>

      {!editandoNf ? (
      <dl className="border border-linha rounded-lg divide-y divide-linha2 mb-3">
        {linhas.map(([r, v]) => (
          <div key={r} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-[12px] text-[#6c757d] shrink-0">{r}</dt>
            <dd className={`text-[12.5px] font-semibold text-right truncate ${v === "—" ? "text-[#adb5bd]" : "text-[#1a1a1a]"}`}>{v}</dd>
          </div>
        ))}
        {(item.destinatario_detectado || item.destinatario_cnpj_detectado) && (
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-[12px] text-[#6c757d] shrink-0">Destinatário</dt>
            <dd className="text-[12.5px] font-semibold text-right truncate text-[#1a1a1a]">{item.destinatario_detectado ?? "—"}</dd>
          </div>
        )}
      </dl>
      ) : (
      <div className="border border-linha rounded-lg p-3 mb-3 space-y-2.5">
        <label className="block"><div className="text-[11px] text-[#6c757d] mb-1">Fornecedor (remetente)</div>
          <input value={efFornecedor} onChange={(e) => setEfFornecedor(e.target.value)} className="input-padrao w-full" /></label>
        <label className="block"><div className="text-[11px] text-[#6c757d] mb-1">CNPJ do remetente</div>
          <input value={efCnpj} onChange={(e) => setEfCnpj(e.target.value)} className="input-padrao w-full font-mono" /></label>
        <label className="block"><div className="text-[11px] text-[#6c757d] mb-1">Nº da nota</div>
          <input value={efNumero} onChange={(e) => setEfNumero(e.target.value)} className="input-padrao w-full font-mono" /></label>
        <label className="block"><div className="text-[11px] text-[#6c757d] mb-1">Destinatário / Tomador</div>
          <input value={efDest} onChange={(e) => setEfDest(e.target.value)} className="input-padrao w-full" /></label>
        <label className="block"><div className="text-[11px] text-[#6c757d] mb-1">CNPJ do destinatário</div>
          <input value={efDestCnpj} onChange={(e) => setEfDestCnpj(e.target.value)} className="input-padrao w-full font-mono" /></label>
        <button onClick={salvarNfCaixa} disabled={salvandoNf} className="btn-primario disabled:opacity-50">{salvandoNf ? "Salvando..." : "Salvar dados da nota"}</button>
      </div>
      )}

      {item.codigo_barras_detectado && (
        <div className="border border-linha rounded-lg px-3 py-2 mb-3">
          <div className="text-[11px] text-[#6c757d] mb-0.5">Código de barras (boleto)</div>
          <div className="text-[11px] font-mono text-[#1a1a1a] break-all">{item.codigo_barras_detectado}</div>
        </div>
      )}

      {pendente && (
        <div className="text-[12px] rounded-md px-3 py-2 mb-3 bg-amarelo-bg text-amb">
          <span className="font-medium">A IA não leu o documento automaticamente.</span> Você pode selecionar a loja abaixo e lançar a compra com os dados do chamado do GLPI — depois é só completar o que faltar direto na conta.
        </div>
      )}

      <label className="block mb-3">
        <span className="text-[11px] text-[#6c757d]">Lançar na loja</span>
        {lojaSel ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] font-semibold">{lojaSel.codigo}</span>
            <button onClick={() => { setLojaId(""); setBusca(""); }} className="text-[12px] text-info hover:underline">trocar</button>
          </div>
        ) : (
          <>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja pelo código…"
              className="w-full mt-1 border border-linha rounded-lg px-3 py-2 text-[13px]" />
            {busca.trim() && (
              <div className="mt-1 max-h-40 overflow-auto border border-linha rounded-lg divide-y divide-linha2">
                {lojasFiltradas.map((l) => (
                  <button key={l.id} onClick={() => { setLojaId(l.id); setBusca(""); }}
                    className="block w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#f8f9fa]">{l.codigo}</button>
                ))}
                {lojasFiltradas.length === 0 && <div className="px-3 py-2 text-[12px] text-[#adb5bd]">Nenhuma loja.</div>}
              </div>
            )}
          </>
        )}
      </label>

      {lojaSel && (() => {
        const empresa = lojaSel.empresas?.razao_social || lojaSel.empresas?.nome || lojaSel.empresa || null;
        const cnpjLoja = lojaSel.empresas?.cnpj || lojaSel.cnpj || null;
        const local = [lojaSel.cidade, lojaSel.uf].filter(Boolean).join(" / ") || null;
        const info: [string, string | null][] = [
          ["Empresa", empresa],
          ["CNPJ", cnpjLoja],
          ["COBAN", lojaSel.coban ?? null],
          ["Cidade/UF", local],
          ["Responsável", lojaSel.responsavel ?? null],
        ];
        const visiveis = info.filter(([, v]) => v);
        if (visiveis.length === 0) return null;
        return (
          <div className="border border-linha rounded-lg divide-y divide-linha2 mb-3 bg-[#f8f9fa]">
            {visiveis.map(([r, v]) => (
              <div key={r} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <dt className="text-[11.5px] text-[#6c757d] shrink-0">{r}</dt>
                <dd className="text-[12px] font-medium text-right truncate text-[#1a1a1a]">{v}</dd>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="flex gap-2 justify-end">
        {item.conta_existente_id ? (
          <>
            <button onClick={() => onSubstituir(item)} disabled={processando}
              className="btn-primario disabled:opacity-40">
              {processando ? "Substituindo..." : "Substituir existente"}
            </button>
            <button onClick={() => onConfirmarChamado(item, lojaId)} disabled={!lojaId || processando}
              className="btn-secundario disabled:opacity-40" title={!lojaId ? "Escolha a loja para criar novo" : ""}>
              Criar novo
            </button>
          </>
        ) : (
          <button onClick={() => onConfirmarChamado(item, lojaId)} disabled={!lojaId || processando}
            className="btn-primario disabled:opacity-40">
            {processando ? "Lançando..." : "Lançar compra"}
          </button>
        )}
        <button onClick={() => onRejeitar(item)} disabled={processando} className="btn-secundario">Descartar</button>
      </div>
    </div>
  );
}

function NotaFiscalCard({ item, lojas, processando, onConfirmarNF, onRejeitar, onReclassificar }: {
  item: Item; lojas: Loja[]; processando: boolean;
  onConfirmarNF: (item: Item, admLojaId: string, tipo: string, previa?: PreviaNF) => void;
  onRejeitar: (item: Item) => void;
  onReclassificar: (item: Item, nova: "boleto" | "nota_fiscal") => void;
}) {
  // Só as lojas "Administrativo" (uma por empresa) entram no seletor.
  const admLojas = lojas.filter((l) => l.codigo.startsWith("ADM "));
  const [admLojaId, setAdmLojaId] = useState("");
  // categoria padrão: Nota Fiscal (documento fiscal); pode trocar se quiser
  const tipoInicial = "nota_fiscal";
  const [tipo, setTipo] = useState(tipoInicial);

  const semEmissao = !(item.emissao_dia && item.emissao_mes && item.emissao_ano);
  const emissao = semEmissao ? "—"
    : `${String(item.emissao_dia).padStart(2, "0")}/${String(item.emissao_mes).padStart(2, "0")}/${item.emissao_ano}`;
  const cnpj = item.cnpj_detectado
    ? item.cnpj_detectado.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5")
    : "—";
  const linhas: [string, string][] = [
    ["Fornecedor", item.fornecedor_detectado ?? "—"],
    ["CNPJ", cnpj],
    ["Nº da nota", item.numero_documento_detectado ?? "—"],
    ["Valor", item.valor_detectado != null ? money(item.valor_detectado) : "—"],
    ["Emissão", emissao],
  ];
  const temBoleto = !!item.codigo_barras_detectado;
  const empresaNome = admLojas.find((l) => l.id === admLojaId)?.empresas?.nome ?? "";

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-info-bg text-info">NOTA FISCAL</span>
          <p className="text-[13px] text-[#6c757d] truncate" title={item.nome_arquivo}>{item.nome_arquivo}</p>
        </div>
        {item.drive_web_view_link && (
          <a href={item.drive_web_view_link} target="_blank" rel="noreferrer" className="text-[12px] text-info shrink-0 hover:underline">Abrir arquivo</a>
        )}
      </div>

      <dl className="border border-linha rounded-lg divide-y divide-linha2 mb-3">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-[12px] text-[#6c757d] shrink-0">{rotulo}</dt>
            <dd className={`text-[12.5px] font-semibold text-right truncate ${valor === "—" ? "text-[#adb5bd]" : "text-[#1a1a1a]"}`}>{valor}</dd>
          </div>
        ))}
      </dl>

      {temBoleto && (
        <div className="border border-linha rounded-lg px-3 py-2 mb-3">
          <div className="text-[11px] text-[#6c757d] mb-0.5">Código de barras (boleto anexo)</div>
          <div className="text-[11px] font-mono text-[#1a1a1a] break-all">{item.codigo_barras_detectado}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-[11px] text-[#6c757d]">Empresa responsável</span>
          <select value={admLojaId} onChange={(e) => setAdmLojaId(e.target.value)}
            className="w-full mt-1 border border-linha rounded-lg px-3 py-2 text-[13px] bg-white">
            <option value="">Selecione a empresa…</option>
            {admLojas.map((l) => <option key={l.id} value={l.id}>{l.empresas?.nome ?? l.codigo}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-[#6c757d]">Categoria</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="w-full mt-1 border border-linha rounded-lg px-3 py-2 text-[13px] bg-white">
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
          </select>
        </label>
      </div>

      {(item.duplicada || item.observacao?.startsWith("Atenção:")) && (
        <p className="text-[12px] font-medium text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">
          ⚠️ {item.observacao ?? "Essa nota fiscal parece já ter sido lançada antes."}
        </p>
      )}

      {semEmissao && (
        <p className="text-[11.5px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">
          Não consegui ler a data de emissão da nota — sem ela o lançamento não sabe a competência. Confira o arquivo.
        </p>
      )}

      <div className="flex gap-2 justify-between items-center">
        <button onClick={() => onReclassificar(item, "boleto")} disabled={processando}
          className="text-[12px] text-[#6c757d] hover:text-[#1a1a1a] hover:underline disabled:opacity-40">
          É um boleto/fatura →
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirmarNF(item, admLojaId, tipo, { empresa: empresaNome })}
            disabled={!admLojaId || semEmissao || processando}
            className="btn-primario disabled:opacity-40">
            {processando ? "Lançando..." : "Lançar NF"}
          </button>
          <button onClick={() => onRejeitar(item)} disabled={processando} className="btn-secundario">Descartar</button>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, lojas, processando, onConfirmar, onRejeitar, onReclassificar }: {
  item: Item; lojas: Loja[]; processando: boolean;
  onConfirmar: (item: Item, lojaId: string, tipo: string, ano: number, mes: number, origem: string, previa?: Previa) => void; onRejeitar: (item: Item) => void;
  onReclassificar: (item: Item, nova: "boleto" | "nota_fiscal") => void;
}) {
  const [lojaId, setLojaId] = useState(item.loja_sugerida_id ?? "");
  const [tipo, setTipo] = useState(item.tipo_detectado ?? "");
  const [origem, setOrigem] = useState("boleto_reembolso");
  const [comp, setComp] = useState(() => {
    // usa a competência lida do nome do arquivo; só cai no mês atual se não houver
    if (item.competencia_ano && item.competencia_mes) {
      return `${item.competencia_ano}-${String(item.competencia_mes).padStart(2, "0")}`;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [buscaLoja, setBuscaLoja] = useState("");
  const [buscandoLoja, setBuscandoLoja] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const conf = CONFIANCA_LABEL[item.confianca];
  const lojaSelecionada = lojas.find((l) => l.id === lojaId);
  const lojasFiltradas = buscaLoja.trim()
    ? lojas.filter((l) => l.codigo.toLowerCase().includes(buscaLoja.toLowerCase())).slice(0, 30)
    : lojas.slice(0, 30);

  // Monta os dados da confirmação. Fornecedor e vencimento vêm da conta
  // cadastrada (loja + tipo); se ela ainda não existe, o lançamento vai
  // criá-la — e a janela avisa isso em vez de mostrar campos vazios.
  async function abrirConfirmacao() {
    const [a, m] = comp.split("-").map(Number);
    setCarregandoPrevia(true);
    const supabase = createClient();
    const { data: conta } = await supabase
      .from("contas")
      .select("fornecedor_nome, dia_vencimento")
      .eq("loja_id", lojaId).eq("tipo", tipo).eq("status", "ativo")
      .maybeSingle();
    setCarregandoPrevia(false);

    const dia = conta?.dia_vencimento ?? null;
    setPrevia({
      loja: lojaSelecionada?.codigo ?? "—",
      empresa: lojaSelecionada?.empresas?.nome ?? "—",
      fornecedor: conta?.fornecedor_nome ?? "—",
      valor: item.valor_detectado,
      vencimento: dia ? `${String(dia).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}` : "—",
      formaPagamento: ORIGENS[origem] ?? origem,
      contaNova: !conta,
      ano: a, mes: m, lojaId, tipo, origem,
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <b className="text-[13.5px] font-semibold block truncate">{item.nome_arquivo}</b>
          <div className="flex items-center gap-2">
            {item.drive_web_view_link && (
              <a href={item.drive_web_view_link} target="_blank" rel="noreferrer" className="text-[11.5px] text-info hover:underline">Ver no Drive</a>
            )}
            {/* de onde veio importa na conferência: o que chega pelo Slack tem
                um responsável com nome, o da pasta do Drive não tem. */}
            {item.origem_entrada === "slack" && (
              <span className="text-[11.5px] text-[#6c757d]">
                via Slack{item.requerente ? ` · ${item.requerente}` : ""}
              </span>
            )}
          </div>
        </div>
        <span className={`badge ${conf.cor} shrink-0`}>{conf.texto}</span>
      </div>

      {item.observacao && <div className="text-[11.5px] text-alerr bg-alerr-bg rounded-md px-3 py-2 mb-3">{item.observacao}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        <div>
          <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Valor</div>
          <div className="text-[14px] font-bold font-mono">{item.valor_detectado != null ? money(item.valor_detectado) : "—"}</div>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Competência</div>
          <input type="month" value={comp} onChange={(e) => setComp(e.target.value)}
            className="border border-linha rounded-md px-2 py-1 text-[12px] w-full" />
        </div>
        <div className="relative">
          <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Loja</div>
          <input
            value={buscandoLoja ? buscaLoja : (lojaSelecionada?.codigo ?? "")}
            onFocus={() => { setBuscandoLoja(true); setBuscaLoja(""); }}
            onChange={(e) => setBuscaLoja(e.target.value)}
            placeholder="Buscar loja..."
            className="border border-linha rounded-md px-2 py-1 text-[12px] w-full"
          />
          {buscandoLoja && (
            <div className="absolute z-30 top-full left-0 mt-1 w-56 max-h-48 overflow-y-auto bg-white border border-linha rounded-md shadow-media">
              {lojasFiltradas.map((l) => (
                <button key={l.id} onClick={() => { setLojaId(l.id); setBuscandoLoja(false); }}
                  className="block w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-off">
                  {l.codigo}
                </button>
              ))}
              {lojasFiltradas.length === 0 && <div className="px-2.5 py-1.5 text-[12px] text-[#adb5bd]">Nenhuma loja encontrada.</div>}
              <button onClick={() => setBuscandoLoja(false)} className="block w-full text-left px-2.5 py-1.5 text-[11px] text-[#adb5bd] border-t border-linha2 hover:bg-off">Fechar</button>
            </div>
          )}
        </div>
        <div>
          <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Tipo</div>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border border-linha rounded-md px-2 py-1 text-[12px] w-full">
            <option value="">Escolher...</option>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Origem</div>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="border border-linha rounded-md px-2 py-1 text-[12px] w-full">
            {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold text-[#adb5bd] uppercase mb-1">Código de barras</div>
          <div className="text-[10.5px] font-mono text-[#6c757d] truncate">{item.codigo_barras_detectado ?? "—"}</div>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={abrirConfirmacao} disabled={!lojaId || !tipo || !comp || processando || carregandoPrevia}
          className="btn-primario flex-1 disabled:opacity-40">
          {processando ? "Lançando..." : carregandoPrevia ? "Conferindo..." : "Confirmar e lançar"}
        </button>
        <button onClick={() => onRejeitar(item)} disabled={processando} className="btn-secundario">Descartar</button>
      </div>
      <div className="mt-2 text-right">
        <button onClick={() => onReclassificar(item, "nota_fiscal")} disabled={processando}
          className="text-[12px] text-[#6c757d] hover:text-[#1a1a1a] hover:underline disabled:opacity-40">
          É uma nota fiscal →
        </button>
      </div>

      {previa && (
        <ModalConfirmacao
          previa={previa}
          arquivo={item.nome_arquivo}
          onCancelar={() => setPrevia(null)}
          onConfirmar={() => {
            const p = previa;
            setPrevia(null);
            onConfirmar(item, p.lojaId, p.tipo, p.ano, p.mes, p.origem, p);
          }}
        />
      )}
    </div>
  );
}

function ModalConfirmacao({ previa, arquivo, onCancelar, onConfirmar }: {
  previa: Previa; arquivo: string; onCancelar: () => void; onConfirmar: () => void;
}) {
  const linhas: [string, string][] = [
    ["Loja", previa.loja],
    ["Empresa", previa.empresa],
    ["Fornecedor", previa.fornecedor],
    ["Valor", previa.valor != null ? money(previa.valor) : "—"],
    ["Vencimento", previa.vencimento],
    ["Forma de pagamento", previa.formaPagamento],
  ];

  return (
    <>
      <div onClick={onCancelar} className="fixed inset-0 bg-ebano/40 z-40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-xl shadow-forte w-full max-w-[420px] pointer-events-auto overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-[17px] font-bold text-[#1a1a1a]">Deseja realmente lançar esta conta?</h3>
            <p className="text-[12px] text-[#adb5bd] mt-1 truncate" title={arquivo}>{arquivo}</p>
          </div>

          <div className="px-5">
            <dl className="border border-linha rounded-lg divide-y divide-linha2">
              {linhas.map(([rotulo, valor]) => (
                <div key={rotulo} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-[12px] text-[#6c757d] shrink-0">{rotulo}</dt>
                  <dd className={`text-[12.5px] font-semibold text-right truncate ${valor === "—" ? "text-[#adb5bd]" : "text-[#1a1a1a]"}`}>{valor}</dd>
                </div>
              ))}
            </dl>
          </div>

          {previa.contaNova && (
            <p className="mx-5 mt-3 text-[11.5px] text-amb bg-amb-bg rounded-md px-3 py-2">
              Ainda não existe conta ativa para esta loja e tipo. Ela será criada agora — fornecedor e vencimento podem ser preenchidos depois em Contas.
            </p>
          )}

          <div className="flex gap-2 p-5 pt-4">
            <button onClick={onConfirmar} className="btn-primario flex-1">Sim, lançar conta</button>
            <button onClick={onCancelar} className="btn-secundario flex-1">Não, cancelar</button>
          </div>
        </div>
      </div>
    </>
  );
}