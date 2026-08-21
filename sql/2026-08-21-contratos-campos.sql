-- ===========================================================================
-- Campos que faltavam no contrato
--
-- A tabela tinha o essencial de uma listagem (número, loja, datas, valor).
-- Para reajuste automático e leitura por IA faltava o resto: quem é o
-- locador, o que o contrato prevê de índice, e os valores acessórios.
--
-- Tudo aditivo. Nenhuma chave estrangeira nova — a lição do PGRST201 que
-- derrubou três telas continua valendo: FK em tabela que o sistema embute
-- quebra consulta em lugar nenhum relacionado.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

alter table public.contratos
  -- ---- partes ----
  add column if not exists locador              text,
  add column if not exists locador_documento    text,
  add column if not exists locatario            text,
  add column if not exists locatario_documento  text,
  add column if not exists endereco_imovel      text,

  -- ---- financeiro ----
  -- "valor" (que já existe) é o ATUAL, o que vale hoje. O inicial fica
  -- separado para dar a evolução real do contrato ao longo dos anos.
  add column if not exists valor_inicial        numeric(12,2),
  add column if not exists valor_condominio     numeric(12,2),
  add column if not exists valor_iptu           numeric(12,2),
  add column if not exists dia_vencimento       smallint,
  add column if not exists multa_percentual     numeric(6,2),
  add column if not exists juros_mensais_percentual numeric(6,2),
  add column if not exists garantia_tipo        text,
  add column if not exists garantia_valor       numeric(12,2),

  -- ---- reajuste ----
  -- ipca | igpm | inpc | fixo. Texto, não enum: acrescentar valor a enum é
  -- operação chata em produção, e essa lista tende a crescer.
  add column if not exists indice_reajuste      text,
  add column if not exists percentual_fixo      numeric(6,2),
  add column if not exists periodicidade_meses  smallint,
  -- Quando cai o próximo. Preenchido no cadastro e recalculado a cada
  -- reajuste aprovado; é por aqui que a verificação diária acha o contrato.
  add column if not exists proximo_reajuste     date,

  -- ---- documento e rastro ----
  add column if not exists anexo_url            text,
  -- o que a IA leu, como leu, e quais alertas saíram. Guardar isso é o que
  -- permite responder "de onde veio esse valor?" meses depois.
  add column if not exists extracao_log         jsonb,
  add column if not exists cadastrado_por_ia    boolean not null default false,

  -- ---- exclusão lógica ----
  -- "Nenhuma informação poderá ser excluída fisicamente do banco."
  add column if not exists excluido_em          timestamptz,
  add column if not exists excluido_por         uuid;

comment on column public.contratos.valor is
  'Valor ATUAL do aluguel. O de origem fica em valor_inicial.';
comment on column public.contratos.proximo_reajuste is
  'Data do próximo reajuste. É o campo que a verificação diária consulta.';
comment on column public.contratos.excluido_em is
  'Exclusão lógica. Contrato com data aqui some das telas mas continua no banco.';

-- dia de vencimento tem que ser dia
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_dia_vencimento_valido') then
    alter table public.contratos
      add constraint contratos_dia_vencimento_valido
      check (dia_vencimento is null or dia_vencimento between 1 and 31);
  end if;
end $$;

-- índice só aceita o que o motor de reajuste sabe calcular
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_indice_valido') then
    alter table public.contratos
      add constraint contratos_indice_valido
      check (indice_reajuste is null or indice_reajuste in ('ipca','igpm','inpc','fixo'));
  end if;
end $$;

-- A verificação diária vai perguntar "quais contratos reajustam hoje ou já
-- passaram do dia?". Índice parcial porque contrato encerrado ou excluído
-- não interessa nessa busca.
create index if not exists idx_contratos_proximo_reajuste
  on public.contratos (proximo_reajuste)
  where proximo_reajuste is not null and excluido_em is null;

-- listagem e alertas de renovação
create index if not exists idx_contratos_vencimento
  on public.contratos (data_fim)
  where excluido_em is null;


-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'contratos'
order by ordinal_position;
