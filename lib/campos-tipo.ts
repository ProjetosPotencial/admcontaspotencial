// O que identifica uma conta muda de acordo com o tipo: água usa matrícula,
// energia usa número de instalação, IPTU usa inscrição imobiliária, e assim
// por diante. Esse mapa ajusta o rótulo e os exemplos do formulário sem
// precisar de uma coluna nova por tipo no banco (o campo "identificador" já
// existe e serve para todos, só muda o que ele significa em cada um).

export const CAMPOS_TIPO: Record<string, {
  labelIdentificador: string;
  placeholderIdentificador: string;
  placeholderFornecedor: string;
}> = {
  agua: {
    labelIdentificador: "Matrícula",
    placeholderIdentificador: "178502-8",
    placeholderFornecedor: "SABESP, COPASA, SANEPAR...",
  },
  energia: {
    labelIdentificador: "Número de instalação",
    placeholderIdentificador: "3042817-5",
    placeholderFornecedor: "CEMIG, ENEL, CPFL...",
  },
  telefone: {
    labelIdentificador: "Número da linha",
    placeholderIdentificador: "(31) 3333-4444",
    placeholderFornecedor: "VIVO, OI, CLARO...",
  },
  iptu: {
    labelIdentificador: "Inscrição imobiliária",
    placeholderIdentificador: "05.123.456-7",
    placeholderFornecedor: "Prefeitura Municipal de...",
  },
  condominio: {
    labelIdentificador: "Número da unidade",
    placeholderIdentificador: "Loja 12, bloco B",
    placeholderFornecedor: "Administradora do condomínio",
  },
  aluguel: {
    labelIdentificador: "Número do contrato",
    placeholderIdentificador: "CT-2026-045",
    placeholderFornecedor: "Imobiliária ou proprietário",
  },
  custo_geral: {
    labelIdentificador: "Referência",
    placeholderIdentificador: "opcional",
    placeholderFornecedor: "Empresa prestadora",
  },
};
