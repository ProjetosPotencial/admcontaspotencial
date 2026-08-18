-- ===========================================================================
-- Entrada de boletos/notas pelo Slack
--
-- A loja posta o PDF num canal dedicado e o arquivo cai na mesma Caixa de
-- Entrada que já recebe os arquivos da pasta do Google Drive. Nada aqui
-- altera o que existe: só acrescenta a fila e as colunas de rastreio.
--
-- Rodar no SQL Editor do Supabase (projeto ADMCONTAS).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. De onde veio cada card, e o rastro do Slack
-- ---------------------------------------------------------------------------
alter table public.caixa_entrada_boletos
  add column if not exists origem_entrada   text not null default 'drive',
  add column if not exists slack_canal      text,
  add column if not exists slack_ts         text,
  add column if not exists slack_usuario_id text;

comment on column public.caixa_entrada_boletos.origem_entrada is
  'Por onde o documento chegou: drive (varredura da pasta) ou slack (postado no canal).';
comment on column public.caixa_entrada_boletos.slack_ts is
  'Timestamp da mensagem, usado pra responder na thread de quem enviou.';

-- ---------------------------------------------------------------------------
-- 2. Fila dos arquivos vindos do Slack
--
-- O Slack desiste do evento em 3 segundos e reenvia até 3 vezes, mas ler um
-- PDF com a IA leva uns 15s. Então a rota só enfileira aqui e responde na
-- hora; a leitura roda depois. Se a execução morrer no meio, o item continua
-- 'pendente' e o cron diário da Caixa de Entrada recolhe.
-- ---------------------------------------------------------------------------
create table if not exists public.slack_fila (
  id            uuid primary key default gen_random_uuid(),
  -- único de propósito: é isso que faz o reenvio do Slack ser inofensivo,
  -- em vez de virar um segundo card do mesmo boleto.
  slack_file_id text not null unique,
  canal         text,
  thread_ts     text,
  usuario_id    text,
  status        text not null default 'pendente',
  tentativas    integer not null default 0,
  erro          text,
  criado_em     timestamptz not null default now(),
  processado_em timestamptz,
  constraint slack_fila_status_valido
    check (status in ('pendente', 'processando', 'concluido', 'ignorado', 'erro'))
);

-- o cron busca sempre pelos pendentes mais antigos
create index if not exists idx_slack_fila_pendentes
  on public.slack_fila (criado_em)
  where status = 'pendente';

-- ---------------------------------------------------------------------------
-- 3. Segurança
--
-- A fila é de uso exclusivo do servidor (service role, que ignora RLS). Com
-- RLS ligada e nenhuma policy, ninguém logado no app enxerga ou mexe nela.
-- ---------------------------------------------------------------------------
alter table public.slack_fila enable row level security;
