export const TIPOS: Record<string, { n: string; c: string; bg: string }> = {
  agua: { n: "Água", c: "#1976d2", bg: "#e3f2fd" },
  energia: { n: "Energia", c: "#f9a825", bg: "#fff3cd" },
  telefone: { n: "Telefone", c: "#8e24aa", bg: "#f3e5f5" },
  iptu: { n: "IPTU", c: "#43a047", bg: "#e8f5e9" },
  condominio: { n: "Condomínio", c: "#fb8c00", bg: "#ffe0b2" },
  aluguel: { n: "Aluguel", c: "#00897b", bg: "#e0f2f1" },
  custo_geral: { n: "Custos gerais", c: "#757575", bg: "#f5f5f5" },
};

export const ORIGENS: Record<string, string> = {
  a_definir: "A definir",
  portal_site: "Portal",
  email: "E-mail",
  loja_slack: "Loja/Slack",
  proprietario_imob: "Proprietário",
  boleto_reembolso: "Boleto",
};

export const SITUACAO: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Em aberto", cls: "bg-alerr-bg text-alerr" },
  lancado: { label: "Lançado", cls: "bg-amb-bg text-[#B5860A]" },
  aprovado: { label: "Aprovado", cls: "bg-info-bg text-info" },
  pago: { label: "Pago", cls: "bg-ok-bg text-ok" },
  contestado: { label: "Contestado", cls: "bg-alerr-bg text-alerr" },
};

export type Conta = {
  id: string;
  tipo: string;
  fornecedor_nome: string | null;
  identificador: string | null;
  dia_vencimento: number | null;
  origem: string;
  cnpj_cpf: string | null;
  insc_cod_mat: string | null;
  portal_link: string | null;
  eh_rateio: boolean;
  rateio_divisor: number | null;
  observacoes: string | null;
  status: string;
  lojas: { codigo: string; coban: string } | null;
};

export type Lancamento = {
  id?: string;
  ano: number;
  mes: number;
  valor: number | null;
  situacao: string;
  comprovante_url?: string | null;
};
