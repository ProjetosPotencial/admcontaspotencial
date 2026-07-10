import type { SupabaseClient } from "@supabase/supabase-js";

// Definição da ferramenta no formato que a API da Anthropic espera.
// O Claude decide sozinho quando chamar isso, com base na pergunta da pessoa.
export const FERRAMENTA_BUSCAR_CONTRATOS = {
  name: "buscar_contratos",
  description:
    "Busca contratos reais cadastrados no sistema, com filtros opcionais. Use sempre que a pergunta envolver contratos, vencimentos, lojas ou empresas específicas. Não invente contratos — sempre chame essa ferramenta antes de responder sobre dados de contratos.",
  input_schema: {
    type: "object" as const,
    properties: {
      loja_codigo: { type: "string", description: "Código ou parte do nome da loja, ex: 'Centro SP'. Deixe vazio pra não filtrar." },
      empresa_nome: { type: "string", description: "Nome ou parte do nome da empresa. Deixe vazio pra não filtrar." },
      status: { type: "string", enum: ["ativo", "suspenso", "encerrado"], description: "Status do contrato. Deixe vazio pra trazer todos." },
      vencendo_em_dias: { type: "number", description: "Só contratos cujo fim está dentro desse número de dias a partir de hoje. Ex: 30 pra 'vencendo esse mês'." },
    },
  },
};

export async function executarBuscarContratos(
  supabase: SupabaseClient,
  args: { loja_codigo?: string; empresa_nome?: string; status?: string; vencendo_em_dias?: number }
) {
  let query = supabase
    .from("contratos")
    .select("numero, tipo, valor, data_inicio, data_fim, status, observacoes, lojas ( codigo ), empresas ( nome )")
    .limit(30);

  if (args.status) query = query.eq("status", args.status);

  const { data, error } = await query;
  if (error) return { erro: error.message };

  let linhas = (data ?? []) as any[];

  if (args.loja_codigo) {
    const termo = args.loja_codigo.toLowerCase();
    linhas = linhas.filter((c) => c.lojas?.codigo?.toLowerCase().includes(termo));
  }
  if (args.empresa_nome) {
    const termo = args.empresa_nome.toLowerCase();
    linhas = linhas.filter((c) => c.empresas?.nome?.toLowerCase().includes(termo));
  }
  if (args.vencendo_em_dias != null) {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(hoje.getDate() + args.vencendo_em_dias);
    linhas = linhas.filter((c) => {
      if (!c.data_fim) return false;
      const fim = new Date(c.data_fim);
      return fim >= hoje && fim <= limite;
    });
  }

  return {
    total: linhas.length,
    contratos: linhas.map((c) => ({
      numero: c.numero,
      loja: c.lojas?.codigo ?? null,
      empresa: c.empresas?.nome ?? null,
      tipo: c.tipo,
      valor: c.valor,
      data_fim: c.data_fim,
      status: c.status,
    })),
  };
}
