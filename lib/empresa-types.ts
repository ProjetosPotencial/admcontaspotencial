export type Empresa = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  observacoes: string | null;
  ativa: boolean;
};

export type Contrato = {
  id: string;
  numero: string;
  loja_id: string | null;
  empresa_id: string | null;
  tipo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor: number | null;
  status: "ativo" | "encerrado" | "suspenso";
  observacoes: string | null;
};
