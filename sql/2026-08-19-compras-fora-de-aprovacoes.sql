-- ===========================================================================
-- Tirar da fila de Aprovações as compras vindas do GLPI
--
-- A partir de agora o código já cria essas compras direto em "aprovado" —
-- elas foram autorizadas no chamado, e pedir a mesma assinatura de novo aqui
-- é trabalho duplicado. Este arquivo trata das que JÁ estão na fila, lançadas
-- antes dessa mudança.
--
-- RODE A PARTE 1 PRIMEIRO e confira o resultado. A parte 2 só depois que
-- você olhar a lista e concordar com ela.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PARTE 1 — Conferência (não altera nada)
--
-- Quais compras estão paradas em Aprovações hoje. Olhe a lista: são essas
-- que vão sair da fila.
-- ---------------------------------------------------------------------------
select
  l.id,
  l.ano, l.mes,
  l.valor,
  c.fornecedor_nome,
  c.chamado_numero,
  lo.codigo as loja,
  l.lancado_em
from lancamentos l
join contas c on c.id = l.conta_id
left join lojas lo on lo.id = c.loja_id
where l.situacao = 'lancado'
  and c.tipo = 'compra'
order by l.lancado_em;

-- Só o total, se quiser o número direto:
select count(*) as compras_na_fila, coalesce(sum(l.valor), 0) as valor_total
from lancamentos l
join contas c on c.id = l.conta_id
where l.situacao = 'lancado' and c.tipo = 'compra';


-- ---------------------------------------------------------------------------
-- PARTE 2 — Aplicar (altera dados)
--
-- Move as compras de "lancado" para "aprovado". Elas SAEM de Aprovações e
-- APARECEM em Pagamentos. Nada é apagado: o lançamento continua inteiro,
-- com valor, chamado e nota fiscal.
--
-- Descomente para rodar.
-- ---------------------------------------------------------------------------

-- with alvo as (
--   select l.id
--   from lancamentos l
--   join contas c on c.id = l.conta_id
--   where l.situacao = 'lancado' and c.tipo = 'compra'
-- ),
-- movidos as (
--   update lancamentos l
--      set situacao = 'aprovado',
--          aprovado_em = now()
--    from alvo
--    where l.id = alvo.id
--    returning l.id
-- )
-- -- deixa o rastro: quem auditar precisa entender por que a conta ficou
-- -- aprovada sem ninguém ter clicado em aprovar.
-- insert into lancamento_historico (lancamento_id, acao, de, para, em, motivo, comentario)
-- select id, 'aprovacao_dispensada', 'lancado', 'aprovado', now(),
--        'Compra autorizada no chamado do GLPI',
--        'Ajuste em lote: compras do GLPI deixaram de passar por Aprovações.'
-- from movidos;


-- ---------------------------------------------------------------------------
-- Conferência final (depois da parte 2): tem que voltar zero.
-- ---------------------------------------------------------------------------
-- select count(*) as ainda_na_fila
-- from lancamentos l
-- join contas c on c.id = l.conta_id
-- where l.situacao = 'lancado' and c.tipo = 'compra';
