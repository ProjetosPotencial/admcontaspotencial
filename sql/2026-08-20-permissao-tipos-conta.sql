-- ===========================================================================
-- Permissão por tipo de conta
--
-- Cada usuário passa a ver só os tipos que foram liberados pra ele.
--
-- A regra vale NO BANCO, não só na tela. Nesta arquitetura o navegador fala
-- direto com o Supabase usando o token do usuário — filtrar no Next.js não
-- protegeria nada: bastaria chamar a API REST com o mesmo token pra ver tudo.
-- É a RLS que cumpre o "impedir acesso por URLs, APIs ou manipulação de
-- filtros" que a especificação pede.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Onde a permissão fica
--
-- NULL = vê todos os tipos. É proposital: sem isso, no instante em que a
-- policy entrasse no ar, TODOS os usuários existentes ficariam sem enxergar
-- nada — eles não têm lista preenchida. NULL preserva o estado atual e a
-- restrição só passa a valer para quem for configurado de fato.
-- ---------------------------------------------------------------------------
alter table public.perfis
  add column if not exists tipos_permitidos text[];

comment on column public.perfis.tipos_permitidos is
  'Tipos de conta que este usuário enxerga. NULL = todos. Admin ignora e vê tudo.';


-- ---------------------------------------------------------------------------
-- 2. A regra, em um lugar só
--
-- SECURITY DEFINER pra conseguir ler perfis de dentro da policy sem cair na
-- RLS de perfis. STABLE porque o resultado não muda dentro da mesma consulta,
-- o que deixa o planner reaproveitar a chamada em vez de rodar por linha.
-- ---------------------------------------------------------------------------
create or replace function public.pode_ver_tipo(p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      -- sem tipo definido não é escondido de ninguém: some da tela por engano
      -- seria pior que aparecer pra mais gente do que o necessário.
      when p_tipo is null then true
      else coalesce(
        (
          select p.papel = 'admin' or p.tipos_permitidos is null
                 or p_tipo = any(p.tipos_permitidos)
          from public.perfis p
          where p.id = auth.uid()
        ),
        false  -- sem perfil, não vê nada
      )
    end;
$$;

revoke all on function public.pode_ver_tipo(text) from public;
grant execute on function public.pode_ver_tipo(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Contas
-- ---------------------------------------------------------------------------
drop policy if exists contas_select on public.contas;
create policy contas_select on public.contas
  for select to authenticated
  using (public.pode_ver_tipo(tipo));


-- ---------------------------------------------------------------------------
-- 4. Lançamentos
--
-- ATENÇÃO — a parte que faz a diferença entre proteger de verdade e só
-- parecer que protege:
--
-- A policy lanc_write era FOR ALL. Em Postgres, policies do mesmo comando são
-- combinadas com OR, e FOR ALL inclui SELECT. Ou seja: restringir só a
-- lanc_select não adiantaria nada — qualquer operador continuaria lendo tudo
-- pela lanc_write. Por isso ela é recriada aqui apenas para escrita.
-- ---------------------------------------------------------------------------
drop policy if exists lanc_select on public.lancamentos;
create policy lanc_select on public.lancamentos
  for select to authenticated
  using (
    exists (
      select 1 from public.contas c
      where c.id = lancamentos.conta_id
        and public.pode_ver_tipo(c.tipo)
    )
  );

drop policy if exists lanc_write on public.lancamentos;
create policy lanc_insert on public.lancamentos
  for insert to authenticated with check (public.eh_operador_ou_acima());
create policy lanc_update on public.lancamentos
  for update to authenticated using (public.eh_operador_ou_acima());
create policy lanc_delete on public.lancamentos
  for delete to authenticated using (public.eh_operador_ou_acima());


-- ---------------------------------------------------------------------------
-- 5. Caixa de Entrada
--
-- Aqui o tipo é o que a IA detectou, e pode vir nulo — documento que ela não
-- classificou. Nulo continua visível de propósito: é justamente o card que
-- precisa de alguém para classificar à mão.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_policies
             where schemaname='public' and tablename='caixa_entrada_boletos' and policyname='caixa_select') then
    execute 'drop policy caixa_select on public.caixa_entrada_boletos';
  end if;
end $$;

create policy caixa_select on public.caixa_entrada_boletos
  for select to authenticated
  using (tipo_detectado is null or public.pode_ver_tipo(tipo_detectado));


-- ---------------------------------------------------------------------------
-- 6. Índice de apoio
--
-- A policy de lancamentos faz um EXISTS em contas por linha lida. Este índice
-- é o que impede isso de virar varredura em tabela de 600 contas a cada
-- consulta de lançamento.
-- ---------------------------------------------------------------------------
create index if not exists idx_contas_id_tipo on public.contas (id, tipo);


-- ---------------------------------------------------------------------------
-- 7. Conferência — rode depois e confira
-- ---------------------------------------------------------------------------

-- Deve listar lanc_insert/update/delete (escrita) e lanc_select (leitura).
-- Se ainda aparecer alguma policy FOR ALL em lancamentos, a proteção está
-- furada: essa policy libera SELECT por outro caminho.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('contas', 'lancamentos', 'caixa_entrada_boletos')
order by tablename, policyname;

-- Ninguém deve ter ficado sem acesso por engano: todo perfil aqui tem
-- tipos_permitidos NULL (vê tudo) até você configurar na tela de Usuários.
select papel, count(*) as usuarios,
       count(*) filter (where tipos_permitidos is null) as veem_todos
from public.perfis group by papel order by papel;
