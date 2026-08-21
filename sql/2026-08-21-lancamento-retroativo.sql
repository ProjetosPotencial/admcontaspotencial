-- ===========================================================================
-- Lançamento retroativo: competência anterior ao mês corrente
--
-- Hoje dá pra trocar o período no topo do sistema, lançar uma conta de julho
-- em agosto, e nada registra que aquilo era de outro mês nem por quê. Quem
-- olha o relatório depois vê um lançamento de julho feito em agosto e não
-- tem como saber se foi atraso, se o boleto chegou tarde, ou se foi engano.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

alter table public.lancamentos
  -- marcado no momento do lançamento, comparando a competência com o mês
  -- corrente de verdade. Não é derivável depois: em setembro, TODO lançamento
  -- de agosto pareceria retroativo.
  add column if not exists retroativo      boolean not null default false,
  add column if not exists motivo_atraso   text,
  -- quantos meses de distância entre a competência e o dia do lançamento
  add column if not exists meses_atraso    smallint;

comment on column public.lancamentos.retroativo is
  'Lançado numa competência anterior ao mês corrente. Marcado no ato — não dá pra deduzir depois.';
comment on column public.lancamentos.motivo_atraso is
  'Obrigatório quando retroativo. Por que a conta só foi lançada agora.';

-- Mesma regra das outras: vale no banco, não só na tela.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lancamentos_retroativo_com_motivo') then
    alter table public.lancamentos
      add constraint lancamentos_retroativo_com_motivo
      check (
        not retroativo
        or (motivo_atraso is not null and length(btrim(motivo_atraso)) > 0)
      ) not valid;   -- NOT VALID: o que já existe não tem motivo e não vamos inventar
  end if;
end $$;

-- Relatório de atraso: quais competências estão sendo lançadas fora do mês.
create index if not exists idx_lancamentos_retroativos
  on public.lancamentos (ano, mes)
  where retroativo;


-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
select count(*) filter (where retroativo) as retroativos,
       count(*) as total
from public.lancamentos;
