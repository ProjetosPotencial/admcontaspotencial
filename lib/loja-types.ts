export type Loja = {
  id: string;
  codigo: string;
  coban: string;
  tipo_pdv: string | null;
  setor: string | null;
  empresa: string | null;
  cnpj: string | null;
  contrato: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  responsavel: string | null;
  contato: string | null;
  status: "ativo" | "inativo" | "encerrada";
  encerrada_em: string | null;
  motivo_encerramento: string | null;
};
