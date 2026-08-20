-- ===========================================================================
-- Revisão das policies — o que a varredura encontrou
--
-- Três achados, em ordem de gravidade. Cada bloco é independente: rode o que
-- fizer sentido, na ordem que preferir.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================


-- ===========================================================================
-- 1. NEGOCIAÇÕES — qualquer usuário logado pode apagar
--
--   neg_delete    | DELETE | true
--   neg_update    | UPDATE | true
--   negint_delete | DELETE | true
--   negint_update | UPDATE | true
--
-- "true" é sem condição nenhuma: alguém de papel LEITURA apaga qualquer
-- negociação chamando a API direto, sem passar pela tela. Nada a ver com a
-- permissão por tipo — já estava assim.
--
-- A proposta abaixo segue o padrão do resto do sistema: operador em diante
-- escreve, apagar é de gestor pra cima. CONFIRME antes de rodar: se a
-- operação depende de leitura poder mexer em negociação, isso trava gente.
-- ===========================================================================

-- Quantas negociações existem hoje, pra dimensionar o risco:
select
  (select count(*) from negociacoes) as negociacoes,
  (select count(*) from negociacao_interacoes) as interacoes;

-- Descomente para aplicar:

-- drop policy if exists neg_update on public.negociacoes;
-- create policy neg_update on public.negociacoes
--   for update to authenticated using (public.eh_operador_ou_acima());
--
-- drop policy if exists neg_delete on public.negociacoes;
-- create policy neg_delete on public.negociacoes
--   for delete to authenticated using (public.eh_gestor_ou_admin());
--
-- drop policy if exists negint_update on public.negociacao_interacoes;
-- create policy negint_update on public.negociacao_interacoes
--   for update to authenticated using (public.eh_operador_ou_acima());
--
-- drop policy if exists negint_delete on public.negociacao_interacoes;
-- create policy negint_delete on public.negociacao_interacoes
--   for delete to authenticated using (public.eh_gestor_ou_admin());


-- ===========================================================================
-- 2. HISTÓRICO — vaza o que a permissão por tipo esconde
--
--   lancamento_historico | hist_leitura | SELECT | true
--
-- A tabela guarda valor_anterior, valor_novo, empresa, loja e motivo. Sem
-- restrição, quem só pode ver Água lê o histórico completo de um lançamento
-- de Energia — valores e lojas inclusive. A permissão fica pela metade.
--
-- A regra aqui espelha a de lancamentos: você vê o histórico do lançamento
-- que você poderia ver.
-- ===========================================================================

drop policy if exists hist_leitura on public.lancamento_historico;
create policy hist_leitura on public.lancamento_historico
  for select to authenticated
  using (
    exists (
      select 1
      from public.lancamentos l
      join public.contas c on c.id = l.conta_id
      where l.id = lancamento_historico.lancamento_id
        and public.pode_ver_tipo(c.tipo::text)
    )
  );

-- apoio pro EXISTS acima não virar varredura
create index if not exists idx_historico_lancamento_id
  on public.lancamento_historico (lancamento_id);


-- ===========================================================================
-- 3. TABELA "aprovacoes" — parece órfã
--
--   aprovacoes | aprov_select | SELECT | true
--
-- A tela de Aprovações lê de lancamentos, não daqui. Antes de mexer, veja se
-- há algo dentro e quando foi usada pela última vez.
-- ===========================================================================

select count(*) as linhas from public.aprovacoes;

-- Se tiver linhas, veja o que são antes de decidir:
-- select * from public.aprovacoes order by 1 desc limit 20;
--
-- Se estiver vazia e nada usar, o certo é remover — tabela esquecida com
-- leitura aberta é passivo. Mas confirme antes; eu não apago o que não li.


-- ===========================================================================
-- 4. Conferência final
-- ===========================================================================
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('lancamento_historico', 'negociacoes', 'negociacao_interacoes')
order by tablename, cmd, policyname;
