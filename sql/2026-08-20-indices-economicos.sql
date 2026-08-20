-- ===========================================================================
-- Fase 1 do módulo de contratos: a base de índices econômicos
--
-- Tabela isolada de propósito: nenhuma chave estrangeira para tabelas que o
-- sistema embute em consulta (contas, lancamentos). Depois do PGRST201 que
-- derrubou três telas, FK em tabela embutida virou coisa a evitar.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

create table if not exists public.indices_economicos (
  id            uuid primary key default gen_random_uuid(),
  -- ipca | inpc | igpm — o texto livre evita ALTER TYPE em enum, que foi
  -- outro problema que já custou caro aqui.
  indice        text not null,
  ano           smallint not null,
  mes           smallint not null check (mes between 1 and 12),
  -- variação do MÊS, em %. O acumulado do período é calculado compondo estes
  -- valores, nunca guardado como se fosse um número do mês.
  percentual    numeric(10,4) not null,
  fonte         text not null default 'BCB/SGS',
  -- código da série no SGS, pra conferir a origem do número anos depois
  serie         text,
  atualizado_em timestamptz not null default now(),

  -- Um valor por índice/mês. O histórico não é sobrescrito: quando o IBGE
  -- revisa um mês já publicado, a revisão vira linha nova em
  -- indices_economicos_revisoes e ESTA continua com o valor vigente.
  constraint indices_unicos unique (indice, ano, mes)
);

comment on table public.indices_economicos is
  'Variação MENSAL de cada índice. Reajuste de contrato usa o acumulado do período, composto a partir daqui.';

create index if not exists idx_indices_busca
  on public.indices_economicos (indice, ano desc, mes desc);


-- ---------------------------------------------------------------------------
-- Revisões: o que o IBGE mudou depois de publicar
--
-- "O histórico não poderá ser sobrescrito" — então toda vez que a
-- sincronização encontra um mês já gravado com percentual diferente, o valor
-- ANTIGO é preservado aqui antes de a linha principal ser atualizada. Um
-- reajuste feito com o número antigo continua explicável.
-- ---------------------------------------------------------------------------
create table if not exists public.indices_economicos_revisoes (
  id                uuid primary key default gen_random_uuid(),
  indice            text not null,
  ano               smallint not null,
  mes               smallint not null,
  percentual_antigo numeric(10,4) not null,
  percentual_novo   numeric(10,4) not null,
  observado_em      timestamptz not null default now()
);

create index if not exists idx_revisoes_indice
  on public.indices_economicos_revisoes (indice, ano desc, mes desc);


-- ---------------------------------------------------------------------------
-- Segurança
--
-- Índice econômico é informação pública: qualquer pessoa logada lê. Escrita é
-- só do servidor (service role, que ignora RLS) — ninguém edita índice pela
-- tela, senão o reajuste deixa de ser auditável.
-- ---------------------------------------------------------------------------
alter table public.indices_economicos enable row level security;
alter table public.indices_economicos_revisoes enable row level security;

drop policy if exists indices_select on public.indices_economicos;
create policy indices_select on public.indices_economicos
  for select to authenticated using (true);

drop policy if exists revisoes_select on public.indices_economicos_revisoes;
create policy revisoes_select on public.indices_economicos_revisoes
  for select to authenticated using (true);


-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename like 'indices_%'
order by tablename, cmd;
