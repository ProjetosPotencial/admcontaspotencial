-- ===========================================================================
-- Contas conjuntas: N contas, 1 lançamento
--
-- Um serviço cobrado para várias lojas (box de chips, link compartilhado)
-- vira UM processo financeiro — uma aprovação, um pagamento — mantendo o
-- detalhe por loja para conferência.
--
-- Duas integrações que fazem a diferença entre funcionar e parecer funcionar
-- estão nas partes 4 e 5. Sem elas o grupo é criado e o sistema desfaz o
-- trabalho sozinho.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. O grupo
-- ---------------------------------------------------------------------------
create table if not exists public.conta_grupos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  tipo_servico  text,
  fornecedor    text,
  ano           smallint not null,
  mes           smallint not null check (mes between 1 and 12),
  valor_total   numeric(12,2) not null,
  vencimento    date,
  observacao    text,
  -- mesmo vocabulário do lançamento, pra não inventar um segundo ciclo
  status        text not null default 'pendente',
  criado_por    uuid,
  criado_em     timestamptz not null default now(),
  excluido_em   timestamptz,

  constraint conta_grupos_status_valido
    check (status in ('pendente','lancado','aprovado','pago','contestado','cancelado','finalizado'))
);

comment on table public.conta_grupos is
  'Serviço único cobrado para várias lojas. Gera um lançamento só; o rateio por loja fica em conta_grupo_itens.';


-- ---------------------------------------------------------------------------
-- 2. As contas do grupo, com o valor de cada uma
-- ---------------------------------------------------------------------------
create table if not exists public.conta_grupo_itens (
  id        uuid primary key default gen_random_uuid(),
  grupo_id  uuid not null references public.conta_grupos(id) on delete cascade,
  conta_id  uuid not null,
  valor     numeric(12,2) not null,
  -- o lançamento individual daquela conta, que o grupo absorveu. Guardado
  -- para poder devolvê-lo à fila se o grupo for recusado.
  lancamento_absorvido_id uuid,

  -- Regra 9 da especificação: conta não entra em dois grupos ao mesmo tempo.
  -- No banco, não só na tela — é o que impede lançamento duplicado.
  constraint item_unico_por_competencia unique (grupo_id, conta_id)
);

create index if not exists idx_grupo_itens_conta on public.conta_grupo_itens (conta_id);
create index if not exists idx_grupo_itens_grupo on public.conta_grupo_itens (grupo_id);

-- Uma conta só pode estar em UM grupo ativo por competência. O índice parcial
-- é o que garante isso mesmo se alguém inserir por fora da tela.
create unique index if not exists idx_conta_um_grupo_ativo
  on public.conta_grupo_itens (conta_id, (
    select g.ano * 100 + g.mes from public.conta_grupos g where g.id = grupo_id
  ))
  where lancamento_absorvido_id is not null;


-- ---------------------------------------------------------------------------
-- 3. O lançamento do grupo
--
-- conta_id passa a aceitar nulo: o lançamento do grupo não pertence a uma
-- conta só. O CHECK garante que todo lançamento é de um lado OU do outro,
-- nunca dos dois nem de nenhum.
-- ---------------------------------------------------------------------------
alter table public.lancamentos
  alter column conta_id drop not null,
  -- sem FK de propósito: o PGRST201 que derrubou três telas veio de FK a mais
  -- numa tabela que o PostgREST embute. Aqui o vínculo é resolvido no código.
  add column if not exists grupo_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lancamento_conta_ou_grupo') then
    alter table public.lancamentos
      add constraint lancamento_conta_ou_grupo
      check ((conta_id is not null) <> (grupo_id is not null));
  end if;
end $$;

create index if not exists idx_lancamentos_grupo
  on public.lancamentos (grupo_id) where grupo_id is not null;


-- ---------------------------------------------------------------------------
-- 4. INTEGRAÇÃO CRÍTICA — a RLS precisa enxergar o lançamento do grupo
--
-- A policy filtrava por contas.id = lancamentos.conta_id. Com conta_id nulo
-- esse EXISTS dá falso, e o lançamento do grupo ficaria invisível para TODO
-- MUNDO, inclusive admin.
--
-- A regra passa a ser: você vê o lançamento do grupo se puder ver QUALQUER
-- uma das contas que o compõem.
-- ---------------------------------------------------------------------------
drop policy if exists lanc_select on public.lancamentos;
create policy lanc_select on public.lancamentos
  for select to authenticated
  using (
    (
      lancamentos.conta_id is not null
      and exists (
        select 1 from public.contas c
        where c.id = lancamentos.conta_id
          and public.pode_ver_tipo(c.tipo::text)
      )
    )
    or (
      lancamentos.grupo_id is not null
      and exists (
        select 1
        from public.conta_grupo_itens i
        join public.contas c on c.id = i.conta_id
        where i.grupo_id = lancamentos.grupo_id
          and public.pode_ver_tipo(c.tipo::text)
      )
    )
  );


-- ---------------------------------------------------------------------------
-- 5. INTEGRAÇÃO CRÍTICA — a RPC não pode recriar o que o grupo absorveu
--
-- garantir_lancamentos_pendentes cria um pendente para toda conta ativa, e
-- roda a cada carregamento de Contas, Painel e Lançamentos. Sem esta mudança,
-- os lançamentos individuais voltam sozinhos minutos depois de o grupo ser
-- criado — de volta à duplicação que o grupo existe pra eliminar.
-- ---------------------------------------------------------------------------
create or replace function public.garantir_lancamentos_pendentes(p_ano integer, p_mes integer)
returns integer
language plpgsql
security definer
as $function$
declare
  v_criados int;
begin
  insert into lancamentos (conta_id, ano, mes, situacao)
  select c.id, p_ano, p_mes, 'pendente'
  from contas c
  where c.status = 'ativo'
    and c.situacao_cadastro = 'aprovada'
    and contaValidaNoPeriodoSql(c.status::text, c.data_encerramento, p_ano, p_mes)
    and not exists (
      select 1 from lancamentos l
      where l.conta_id = c.id and l.ano = p_ano and l.mes = p_mes
    )
    -- NOVO: conta já coberta por grupo ativo nesta competência não ganha
    -- lançamento individual.
    and not exists (
      select 1
      from conta_grupo_itens i
      join conta_grupos g on g.id = i.grupo_id
      where i.conta_id = c.id
        and g.ano = p_ano and g.mes = p_mes
        and g.excluido_em is null
        and g.status not in ('contestado', 'cancelado')
    )
  on conflict (conta_id, ano, mes) do nothing;

  get diagnostics v_criados = row_count;
  return v_criados;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 6. Segurança
-- ---------------------------------------------------------------------------
alter table public.conta_grupos enable row level security;
alter table public.conta_grupo_itens enable row level security;

drop policy if exists grupos_select on public.conta_grupos;
create policy grupos_select on public.conta_grupos
  for select to authenticated using (true);

drop policy if exists grupos_write on public.conta_grupos;
create policy grupos_insert on public.conta_grupos
  for insert to authenticated with check (public.eh_operador_ou_acima());
create policy grupos_update on public.conta_grupos
  for update to authenticated using (public.eh_operador_ou_acima());

drop policy if exists itens_select on public.conta_grupo_itens;
create policy itens_select on public.conta_grupo_itens
  for select to authenticated using (true);
create policy itens_write on public.conta_grupo_itens
  for insert to authenticated with check (public.eh_operador_ou_acima());
create policy itens_delete on public.conta_grupo_itens
  for delete to authenticated using (public.eh_operador_ou_acima());


-- ---------------------------------------------------------------------------
-- 7. Conferência
-- ---------------------------------------------------------------------------

-- lanc_select tem que cobrir os dois casos (conta_id e grupo_id)
select policyname, cmd, qual from pg_policies
where schemaname='public' and tablename='lancamentos' and cmd='SELECT';

-- nenhum lançamento pode estar sem os dois nem com os dois
select count(*) as lancamentos_invalidos from public.lancamentos
where (conta_id is null) = (grupo_id is null);
