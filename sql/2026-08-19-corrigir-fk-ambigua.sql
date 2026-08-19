-- ===========================================================================
-- CORREÇÃO URGENTE — rodar agora no SQL Editor do Supabase
--
-- O que quebrou:
--   A migration 2026-08-19-lancamento-incorreto.sql criou a coluna
--   conta_correta_id com "references public.contas(id)". Com isso a tabela
--   lancamentos passou a ter DUAS chaves estrangeiras apontando para contas:
--
--     conta_id          -> contas(id)   (a de sempre)
--     conta_correta_id  -> contas(id)   (a nova)
--
--   O PostgREST resolve embed (o "contas ( ... )" das consultas) pelas
--   chaves estrangeiras. Com duas, ele não sabe qual usar e recusa:
--
--     PGRST201: Could not embed because more than one relationship was found
--
--   Como 29 consultas do sistema embutem contas a partir de lancamentos,
--   Lançamentos, Aprovações e Pagamentos pararam juntos.
--
-- A correção:
--   Tirar a chave estrangeira e MANTER a coluna. Os dados continuam lá; o
--   que sai é só a restrição que criava a ambiguidade. A alternativa seria
--   desambiguar as 29 consultas uma a uma com dica de relação
--   ("contas!lancamentos_conta_id_fkey(...)"), o que é mais correto no
--   longo prazo mas é muita superfície pra mexer com o sistema fora do ar.
--
--   conta_correta_id é ponteiro de auditoria (pra onde a conta deveria ter
--   ido). Sem a chave estrangeira ele deixa de ser validado pelo banco — se
--   a conta de destino for apagada um dia, fica um id órfão apontando pra
--   nada. É um custo aceitável perto de ter três telas paradas, e o mesmo
--   vale para o corrigido_em_lancamento_id, que continua íntegro.
-- ===========================================================================

do $$
declare
  nome_constraint text;
begin
  -- acha pela COLUNA, não pelo nome: se o Postgres nomeou diferente do
  -- esperado, isto encontra do mesmo jeito.
  select con.conname into nome_constraint
  from pg_constraint con
  join pg_attribute a
    on a.attrelid = con.conrelid
   and a.attnum = any(con.conkey)
  where con.conrelid = 'public.lancamentos'::regclass
    and con.contype = 'f'
    and a.attname = 'conta_correta_id'
  limit 1;

  if nome_constraint is not null then
    execute format('alter table public.lancamentos drop constraint %I', nome_constraint);
    raise notice 'Removida a chave estrangeira %, a ambiguidade acabou.', nome_constraint;
  else
    raise notice 'Nenhuma chave estrangeira em conta_correta_id — nada a fazer.';
  end if;
end $$;

-- Faz o PostgREST reler o schema na hora, em vez de esperar o cache expirar.
notify pgrst, 'reload schema';

-- Conferência: tem que sobrar UMA linha só (conta_id).
select con.conname, a.attname as coluna
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_attribute a on a.attrelid = rel.oid and a.attnum = any(con.conkey)
where rel.relname = 'lancamentos'
  and con.contype = 'f'
  and con.confrelid = 'public.contas'::regclass;
