import type { SupabaseClient } from "@supabase/supabase-js";
import { obterPeriodoAtual, estaAtrasada } from "./date-utils";
import { TIPOS } from "./types";

// Todas as ferramentas que a IA pode chamar, no formato que a API da
// Anthropic espera. O Claude decide sozinho qual (ou quais) usar com base
// na pergunta - nunca inventa dado, sempre busca de verdade no Supabase
// respeitando o mesmo acesso (RLS) da pessoa que está perguntando.

export const FERRAMENTAS = [
  {
    name: "buscar_contratos",
    description: "Busca contratos cadastrados (aluguel, prestação de serviço, franquia), com filtros opcionais por loja, empresa, status ou vencimento próximo.",
    input_schema: {
      type: "object" as const,
      properties: {
        loja_codigo: { type: "string", description: "Código ou parte do nome da loja." },
        empresa_nome: { type: "string", description: "Nome ou parte do nome da empresa." },
        status: { type: "string", enum: ["ativo", "suspenso", "encerrado"] },
        vencendo_em_dias: { type: "number", description: "Só contratos com fim dentro desses dias a partir de hoje." },
      },
    },
  },
  {
    name: "buscar_contas",
    description: "Busca contas de consumo (água, energia, telefone, IPTU, condomínio, aluguel, custos gerais) cadastradas em alguma loja, com filtros opcionais.",
    input_schema: {
      type: "object" as const,
      properties: {
        tipo: { type: "string", enum: ["agua", "energia", "telefone", "iptu", "condominio", "aluguel", "custo_geral"] },
        loja_codigo: { type: "string", description: "Código ou parte do nome da loja." },
        status: { type: "string", enum: ["ativo", "inativo", "encerrado"] },
        origem_a_mapear: { type: "boolean", description: "true pra listar só contas sem origem de pagamento definida ainda." },
      },
    },
  },
  {
    name: "buscar_lancamentos",
    description: "Busca lançamentos (valores lançados por mês) do ano/mês atual, com filtros por situação ou loja. Use pra perguntas sobre 'quanto foi lançado', 'o que está pendente/aprovado/pago' etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        situacao: { type: "string", enum: ["pendente", "lancado", "aprovado", "pago", "contestado"] },
        loja_codigo: { type: "string", description: "Código ou parte do nome da loja." },
      },
    },
  },
  {
    name: "buscar_alertas",
    description: "Devolve um retrato atual do que precisa de atenção agora: contas atrasadas (ninguém lançou e o vencimento passou), aprovações pendentes, e contas sem origem mapeada. Use pra perguntas tipo 'o que está atrasado', 'tem algo pendente', 'como estamos hoje'.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "buscar_lojas",
    description: "Busca lojas cadastradas, com filtros por status, praça (coban) ou empresa.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["ativo", "inativo", "encerrada"] },
        coban: { type: "string", enum: ["MG", "MS", "SP", "QUIOSQUE", "CORP"] },
        empresa_nome: { type: "string" },
      },
    },
  },
  {
    name: "buscar_fornecedores",
    description: "Busca fornecedores cadastrados pelo nome.",
    input_schema: {
      type: "object" as const,
      properties: { nome: { type: "string", description: "Nome ou parte do nome do fornecedor." } },
    },
  },
];

export async function executarFerramenta(supabase: SupabaseClient, nome: string, args: any): Promise<any> {
  switch (nome) {
    case "buscar_contratos": return buscarContratos(supabase, args);
    case "buscar_contas": return buscarContas(supabase, args);
    case "buscar_lancamentos": return buscarLancamentos(supabase, args);
    case "buscar_alertas": return buscarAlertas(supabase);
    case "buscar_lojas": return buscarLojas(supabase, args);
    case "buscar_fornecedores": return buscarFornecedores(supabase, args);
    default: return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

async function buscarContratos(supabase: SupabaseClient, args: any) {
  let query = supabase.from("contratos")
    .select("numero, tipo, valor, data_inicio, data_fim, status, lojas ( codigo ), empresas ( nome )")
    .limit(30);
  if (args.status) query = query.eq("status", args.status);
  const { data, error } = await query;
  if (error) return { erro: error.message };
  let linhas = (data ?? []) as any[];
  if (args.loja_codigo) linhas = linhas.filter((c) => c.lojas?.codigo?.toLowerCase().includes(args.loja_codigo.toLowerCase()));
  if (args.empresa_nome) linhas = linhas.filter((c) => c.empresas?.nome?.toLowerCase().includes(args.empresa_nome.toLowerCase()));
  if (args.vencendo_em_dias != null) {
    const hoje = new Date(), limite = new Date();
    limite.setDate(hoje.getDate() + args.vencendo_em_dias);
    linhas = linhas.filter((c) => c.data_fim && new Date(c.data_fim) >= hoje && new Date(c.data_fim) <= limite);
  }
  return { total: linhas.length, contratos: linhas.map((c) => ({ numero: c.numero, loja: c.lojas?.codigo, empresa: c.empresas?.nome, tipo: c.tipo, valor: c.valor, data_fim: c.data_fim, status: c.status })) };
}

async function buscarContas(supabase: SupabaseClient, args: any) {
  let query = supabase.from("contas")
    .select("tipo, fornecedor_nome, dia_vencimento, origem, status, lojas ( codigo )")
    .eq("situacao_cadastro", "aprovada").limit(40);
  if (args.tipo) query = query.eq("tipo", args.tipo);
  if (args.status) query = query.eq("status", args.status);
  if (args.origem_a_mapear) query = query.eq("origem", "a_definir");
  const { data, error } = await query;
  if (error) return { erro: error.message };
  let linhas = (data ?? []) as any[];
  if (args.loja_codigo) linhas = linhas.filter((c) => c.lojas?.codigo?.toLowerCase().includes(args.loja_codigo.toLowerCase()));
  return {
    total: linhas.length,
    contas: linhas.map((c) => ({ loja: c.lojas?.codigo, tipo: TIPOS[c.tipo]?.n ?? c.tipo, fornecedor: c.fornecedor_nome, vencimento_dia: c.dia_vencimento, origem: c.origem, status: c.status })),
  };
}

async function buscarLancamentos(supabase: SupabaseClient, args: any) {
  const { ano, mes } = obterPeriodoAtual();
  let query = supabase.from("lancamentos")
    .select("valor, situacao, contas!inner ( tipo, fornecedor_nome, lojas ( codigo ) )")
    .eq("ano", ano).eq("mes", mes).limit(40);
  if (args.situacao) query = query.eq("situacao", args.situacao);
  const { data, error } = await query;
  if (error) return { erro: error.message };
  let linhas = (data ?? []) as any[];
  if (args.loja_codigo) linhas = linhas.filter((l) => l.contas?.lojas?.codigo?.toLowerCase().includes(args.loja_codigo.toLowerCase()));
  const totalValor = linhas.reduce((s, l) => s + Number(l.valor ?? 0), 0);
  return {
    periodo: `${mes}/${ano}`, total_lancamentos: linhas.length, valor_total: totalValor,
    lancamentos: linhas.slice(0, 20).map((l) => ({ loja: l.contas?.lojas?.codigo, tipo: TIPOS[l.contas?.tipo]?.n, fornecedor: l.contas?.fornecedor_nome, valor: l.valor, situacao: l.situacao })),
  };
}

async function buscarAlertas(supabase: SupabaseClient) {
  const { ano, mes } = obterPeriodoAtual();
  const diaAtual = new Date().getDate();

  const [{ data: pendentesLancados }, { data: mapear }] = await Promise.all([
    supabase.from("lancamentos").select("situacao, contas!inner ( tipo, dia_vencimento, fornecedor_nome, lojas ( codigo ) )")
      .eq("ano", ano).eq("mes", mes).in("situacao", ["pendente", "lancado"]),
    supabase.from("contas").select("id, tipo, lojas ( codigo )").eq("situacao_cadastro", "aprovada").eq("status", "ativo").eq("origem", "a_definir"),
  ]);

  const lista = (pendentesLancados ?? []) as any[];
  const atrasadas = lista.filter((l) => estaAtrasada(l.situacao, l.contas?.dia_vencimento, mes, ano));
  const venceHoje = lista.filter((l) => l.situacao === "pendente" && l.contas?.dia_vencimento === diaAtual);
  const aprovacoesPendentes = lista.filter((l) => l.situacao === "lancado").length;

  return {
    contas_atrasadas: atrasadas.length,
    detalhe_atrasadas: atrasadas.slice(0, 15).map((l) => ({ loja: l.contas?.lojas?.codigo, tipo: TIPOS[l.contas?.tipo]?.n, fornecedor: l.contas?.fornecedor_nome })),
    vence_hoje: venceHoje.length,
    aprovacoes_pendentes: aprovacoesPendentes,
    contas_sem_origem_mapeada: (mapear ?? []).length,
  };
}

async function buscarLojas(supabase: SupabaseClient, args: any) {
  let query = supabase.from("lojas").select("codigo, coban, status, cidade, uf, empresas ( nome )").limit(40);
  if (args.status) query = query.eq("status", args.status);
  if (args.coban) query = query.eq("coban", args.coban);
  const { data, error } = await query;
  if (error) return { erro: error.message };
  let linhas = (data ?? []) as any[];
  if (args.empresa_nome) linhas = linhas.filter((l) => l.empresas?.nome?.toLowerCase().includes(args.empresa_nome.toLowerCase()));
  return { total: linhas.length, lojas: linhas.map((l) => ({ codigo: l.codigo, praca: l.coban, status: l.status, cidade: l.cidade, uf: l.uf, empresa: l.empresas?.nome })) };
}

async function buscarFornecedores(supabase: SupabaseClient, args: any) {
  let query = supabase.from("fornecedores").select("nome, tipo_padrao").limit(30);
  const { data, error } = await query;
  if (error) return { erro: error.message };
  let linhas = (data ?? []) as any[];
  if (args.nome) linhas = linhas.filter((f) => f.nome?.toLowerCase().includes(args.nome.toLowerCase()));
  return { total: linhas.length, fornecedores: linhas.map((f) => ({ nome: f.nome, tipo_padrao: f.tipo_padrao ? TIPOS[f.tipo_padrao]?.n : null })) };
}
