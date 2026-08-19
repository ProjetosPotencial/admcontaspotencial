-- ===========================================================================
-- Fase 1: conta com valor R$ 0,00 é um valor válido
--
-- Zero não é campo vazio. Tem conta que legitimamente não cobra nada no mês
-- (loja fechada, sem consumo, isento, fornecedor não faturou) e ela precisa
-- ser lançada, aprovada e finalizada como qualquer outra — hoje ela some no
-- meio das "pendências sem valor" e ninguém fecha o mês.
--
-- A diferença que passa a valer: valor NULL = ninguém informou ainda;
-- valor 0 = informado, e é zero, com motivo obrigatório.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

alter table public.lancamentos
  add column if not exists motivo_zerado text;

comment on column public.lancamentos.motivo_zerado is
  'Obrigatório quando valor = 0. Diz por que a conta não cobrou nada no período.';

-- Regra no banco, não só na tela: valor zero exige motivo.
--
-- NOT VALID de propósito: já existem 25 lançamentos zerados sem motivo, de
-- antes desta regra. Eles continuam onde estão (não vamos inventar motivo
-- retroativo), mas qualquer lançamento novo — ou qualquer edição num deles —
-- passa a exigir o motivo.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lancamentos_zerado_com_motivo'
  ) then
    alter table public.lancamentos
      add constraint lancamentos_zerado_com_motivo
      check (
        valor is null
        or valor <> 0
        or (motivo_zerado is not null and length(btrim(motivo_zerado)) > 0)
      ) not valid;
  end if;
end $$;

-- "Finalizado": a etapa que fechava o ciclo e não existia no enum.
-- Acrescentar valor a enum é aditivo — nada que já está gravado muda.
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'situacao_lancamento' and e.enumlabel = 'finalizado'
  ) then
    alter type situacao_lancamento add value 'finalizado';
  end if;
end $$;

-- Lista das contas zeradas do período: vira filtro na tela de Lançamentos
-- e coluna de conferência no relatório.
create index if not exists idx_lancamentos_zerados
  on public.lancamentos (ano, mes)
  where valor = 0;
