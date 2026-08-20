-- ===========================================================================
-- CORREÇÃO URGENTE — rodar agora
--
-- O que a conferência revelou:
--
--   caixa_entrada_select | SELECT | eh_operador_ou_acima()
--   caixa_select         | SELECT | tipo_detectado IS NULL OR pode_ver_tipo(...)
--
-- Duas policies de SELECT na mesma tabela são combinadas com OR. Cada uma
-- protege uma coisa diferente, e juntas por OR não protegem NENHUMA das duas:
--
--   * quem é de LEITURA e antes não via a Caixa de Entrada agora vê, porque
--     passa pela caixa_select (que não olha papel);
--   * quem é operador vê qualquer tipo, porque passa pela caixa_entrada_select
--     (que não olha tipo).
--
-- A migration de permissão por tipo criou esse segundo caso sem querer. É
-- regressão de acesso, e por isso vale rodar agora.
--
-- A correção é uma policy só, com as duas condições em AND.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

drop policy if exists caixa_entrada_select on public.caixa_entrada_boletos;
drop policy if exists caixa_select on public.caixa_entrada_boletos;

create policy caixa_entrada_select on public.caixa_entrada_boletos
  for select to authenticated
  using (
    -- continua valendo o que já valia: leitura não entra na Caixa de Entrada
    public.eh_operador_ou_acima()
    -- e agora também: só os tipos liberados para a pessoa
    and (
      -- documento que a IA ainda não classificou fica visível de propósito:
      -- é justamente o card que precisa de alguém para classificar à mão
      tipo_detectado is null
      or public.pode_ver_tipo(tipo_detectado)
    )
  );


-- ---------------------------------------------------------------------------
-- Conferência: precisa sobrar UMA linha de SELECT, com as duas condições.
-- ---------------------------------------------------------------------------
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'caixa_entrada_boletos'
order by cmd, policyname;


-- ===========================================================================
-- A regra que eu deveria ter seguido desde o começo
--
-- Antes de restringir leitura de uma tabela, listar TODAS as policies dela e
-- LER a condição de cada uma. Duas policies do mesmo comando se somam com OR:
-- adicionar uma restritiva ao lado de uma permissiva não restringe nada, e
-- pior — pode AFROUXAR o que a outra protegia.
--
-- Quando duas regras precisam valer ao mesmo tempo, elas têm que estar na
-- MESMA policy, unidas por AND.
-- ===========================================================================
