-- ===========================================================================
-- Fase 2: lançamento incorreto e correção com rastro
--
-- Conta lançada na empresa ou na loja errada. A regra é não perder nada: o
-- lançamento errado NÃO é apagado nem editado no lugar — ele é marcado como
-- incorreto, cancelado, e um lançamento novo nasce na conta certa, com
-- vínculo nos dois sentidos. Quem auditar depois consegue ir do errado ao
-- certo e vice-versa.
--
-- Por que não simplesmente mover (trocar o conta_id): existe índice único
-- em (conta_id, ano, mes). Se a conta de destino já tiver lançamento naquele
-- mês, o move falha — e falharia justamente no caso mais comum, que é a
-- conta certa também já ter sido lançada.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Marcação de incorreto no lançamento
-- ---------------------------------------------------------------------------
alter table public.lancamentos
  add column if not exists lancamento_incorreto   boolean not null default false,
  add column if not exists motivo_incorreto       text,
  add column if not exists marcado_incorreto_por  uuid references public.perfis(id),
  add column if not exists marcado_incorreto_em   timestamptz,
  -- onde a conta DEVERIA ter sido lançada
  add column if not exists conta_correta_id       uuid references public.contas(id),
  -- o lançamento certo que nasceu desta correção
  add column if not exists corrigido_em_lancamento_id uuid references public.lancamentos(id),
  -- caminho inverso: de onde este lançamento veio, quando é o corrigido
  add column if not exists origem_lancamento_id   uuid references public.lancamentos(id);

comment on column public.lancamentos.lancamento_incorreto is
  'Lançado na empresa/loja errada. O registro é mantido e cancelado, nunca apagado.';
comment on column public.lancamentos.corrigido_em_lancamento_id is
  'Aponta para o lançamento correto criado a partir deste. Nulo enquanto não foi corrigido.';
comment on column public.lancamentos.origem_lancamento_id is
  'Aponta para o lançamento incorreto que originou este. Só preenchido no lançamento corrigido.';

-- Sem motivo não marca. Mesma regra das outras: vale no banco, não só na tela.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lancamentos_incorreto_com_motivo') then
    alter table public.lancamentos
      add constraint lancamentos_incorreto_com_motivo
      check (
        not lancamento_incorreto
        or (motivo_incorreto is not null and length(btrim(motivo_incorreto)) > 0)
      );
  end if;
end $$;

create index if not exists idx_lancamentos_incorretos
  on public.lancamentos (ano, mes)
  where lancamento_incorreto;

-- ---------------------------------------------------------------------------
-- 2. Histórico estruturado
--
-- A tabela guardava só de/para em texto livre. A auditoria pede o antes e o
-- depois de cada campo que muda. As colunas antigas continuam (o histórico
-- que já existe não se perde); as novas ficam nulas no que é anterior a isto.
-- ---------------------------------------------------------------------------
alter table public.lancamento_historico
  add column if not exists acao             text,
  add column if not exists valor_anterior   numeric,
  add column if not exists valor_novo       numeric,
  add column if not exists empresa_anterior text,
  add column if not exists empresa_nova     text,
  add column if not exists loja_anterior    text,
  add column if not exists loja_nova        text,
  add column if not exists motivo           text;

comment on column public.lancamento_historico.acao is
  'O que aconteceu: lancado, corrigido, marcado_incorreto, documento_anexado, aprovado...';

create index if not exists idx_historico_lancamento
  on public.lancamento_historico (lancamento_id, em desc);
