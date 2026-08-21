-- ===========================================================================
-- Boleto único para o grupo
--
-- Um boleto cobre N lojas. O documento fica no GRUPO e as contas leem dele —
-- vínculo, não cópia. Copiar o código de barras para cada loja criaria N
-- lugares para atualizar quando o boleto fosse substituído, e bastaria um
-- falhar para o sistema mostrar dois códigos para o mesmo pagamento.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Versões do documento
--
-- "Não permitir exclusão de documentos. Ao substituir, manter versão
-- anterior." Então cada envio é uma LINHA NOVA. Substituir não apaga: marca a
-- anterior como inativa e registra quem trocou, quando e por quê.
-- ---------------------------------------------------------------------------
create table if not exists public.conta_grupo_documentos (
  id            uuid primary key default gen_random_uuid(),
  grupo_id      uuid not null references public.conta_grupos(id) on delete cascade,

  arquivo_url   text not null,          -- caminho no bucket "boletos"
  nome_arquivo  text not null,
  mime_type     text,
  tamanho       integer,

  codigo_barras   text,
  linha_digitavel text,
  valor           numeric(12,2),
  vencimento      date,

  versao        integer not null default 1,
  -- só a versão vigente fica ativa; as anteriores continuam aqui
  ativo         boolean not null default true,
  motivo_substituicao text,

  enviado_por   uuid,
  enviado_em    timestamptz not null default now()
);

create index if not exists idx_grupo_doc_grupo
  on public.conta_grupo_documentos (grupo_id, versao desc);

-- Um documento vigente por grupo. O resto é histórico.
create unique index if not exists idx_grupo_doc_unico_ativo
  on public.conta_grupo_documentos (grupo_id) where ativo;

-- ---------------------------------------------------------------------------
-- Duplicidade: o mesmo boleto não entra em dois grupos.
--
-- Vale só entre grupos, como a especificação pede — um boleto de grupo e um
-- boleto individual são coisas diferentes e não se comparam aqui.
--
-- Guardamos só dígitos do código para a comparação não depender de a pessoa
-- ter colado com pontos ou espaços.
-- ---------------------------------------------------------------------------
create unique index if not exists idx_grupo_doc_codigo_unico
  on public.conta_grupo_documentos ((regexp_replace(coalesce(codigo_barras, ''), '\D', '', 'g')))
  where ativo and codigo_barras is not null and length(regexp_replace(codigo_barras, '\D', '', 'g')) >= 20;


-- ---------------------------------------------------------------------------
-- 2. O grupo aponta para o documento vigente
--
-- Redundante com a tabela acima de propósito: evita um join em toda listagem
-- de grupo só pra saber se tem boleto.
-- ---------------------------------------------------------------------------
alter table public.conta_grupos
  add column if not exists documento_atual_id uuid,
  add column if not exists codigo_barras   text,
  add column if not exists linha_digitavel text;


-- ---------------------------------------------------------------------------
-- 3. Histórico do grupo
--
-- O lancamento_historico é preso a um lançamento. O grupo tem eventos que
-- acontecem ANTES de existir lançamento (upload, vínculo às lojas, troca de
-- vencimento), então precisa do próprio rastro.
-- ---------------------------------------------------------------------------
create table if not exists public.conta_grupo_historico (
  id         uuid primary key default gen_random_uuid(),
  grupo_id   uuid not null references public.conta_grupos(id) on delete cascade,
  acao       text not null,
  descricao  text not null,
  -- nulo = ação do próprio sistema, não de uma pessoa
  quem       uuid,
  em         timestamptz not null default now()
);

create index if not exists idx_grupo_hist
  on public.conta_grupo_historico (grupo_id, em desc);


-- ---------------------------------------------------------------------------
-- 4. Segurança
-- ---------------------------------------------------------------------------
alter table public.conta_grupo_documentos enable row level security;
alter table public.conta_grupo_historico enable row level security;

drop policy if exists grupo_doc_select on public.conta_grupo_documentos;
create policy grupo_doc_select on public.conta_grupo_documentos
  for select to authenticated using (true);

-- Sem policy de DELETE: documento não se apaga, nem por quem tem permissão.
-- A regra fica no banco, não na disciplina de quem escreve o código.
drop policy if exists grupo_doc_insert on public.conta_grupo_documentos;
create policy grupo_doc_insert on public.conta_grupo_documentos
  for insert to authenticated with check (public.eh_operador_ou_acima());
drop policy if exists grupo_doc_update on public.conta_grupo_documentos;
create policy grupo_doc_update on public.conta_grupo_documentos
  for update to authenticated using (public.eh_operador_ou_acima());

drop policy if exists grupo_hist_select on public.conta_grupo_historico;
create policy grupo_hist_select on public.conta_grupo_historico
  for select to authenticated using (true);
drop policy if exists grupo_hist_insert on public.conta_grupo_historico;
create policy grupo_hist_insert on public.conta_grupo_historico
  for insert to authenticated with check (public.eh_operador_ou_acima());


-- ---------------------------------------------------------------------------
-- 5. Conferência
-- ---------------------------------------------------------------------------
select tablename, policyname, cmd from pg_policies
where schemaname='public' and tablename like 'conta_grupo%'
order by tablename, cmd;
