-- ===========================================================================
-- Lançamento sem documento
--
-- Tem conta que existe, vence e precisa ser paga, mas o boleto nunca chega:
-- o fornecedor gerou no sistema dele e não disponibilizou, ou o documento
-- veio por outro meio. Hoje isso vira um lançamento zerado sem explicação.
-- Aqui o lançamento passa a exigir um MOTIVO e a registrar que o documento
-- está faltando, até alguém anexar depois.
--
-- Importante: NÃO mexe no enum situacao_lancamento. O lançamento sem
-- documento entra em 'lancado' como qualquer outro e segue para aprovação e
-- pagamento normalmente — "documento anexado" é estado do DOCUMENTO, não do
-- dinheiro. Misturar os dois faria a conta sumir da fila de aprovação.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

alter table public.lancamentos
  add column if not exists sem_documento          boolean not null default false,
  add column if not exists motivo_sem_documento   text,
  add column if not exists documento_anexado_em   timestamptz,
  add column if not exists documento_anexado_por  uuid references public.perfis(id),
  -- vencimento real informado no lançamento. A conta guarda só o DIA
  -- (dia_vencimento); quando não chega boleto, quem lança costuma saber a
  -- data cheia, que pode não ser o dia de sempre.
  add column if not exists vencimento             date;

comment on column public.lancamentos.sem_documento is
  'Lançado sem boleto/nota em mãos. Continua no fluxo normal de aprovação e pagamento.';
comment on column public.lancamentos.motivo_sem_documento is
  'Obrigatório quando sem_documento = true. Um dos motivos padrão ou texto livre em "Outro".';
comment on column public.lancamentos.documento_anexado_em is
  'Quando o documento que faltava foi anexado. Nulo enquanto continua pendente.';

-- A regra de segurança no banco, não só na tela: sem motivo, não grava.
-- Vale para qualquer caminho de escrita (app, API, correção manual no SQL).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lancamentos_motivo_obrigatorio'
  ) then
    alter table public.lancamentos
      add constraint lancamentos_motivo_obrigatorio
      check (
        not sem_documento
        or (motivo_sem_documento is not null and length(btrim(motivo_sem_documento)) > 0)
      );
  end if;
end $$;

-- Lista de "documento ainda faltando": é o que alguém precisa cobrar do
-- fornecedor. Índice parcial porque a grande maioria dos lançamentos tem
-- documento e não interessa aqui.
create index if not exists idx_lancamentos_sem_documento
  on public.lancamentos (ano, mes)
  where sem_documento and documento_anexado_em is null;
