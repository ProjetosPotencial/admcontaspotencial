# Contas de Consumo — Grupo Potencial

Sistema interno de controle das contas de consumo (água, energia, telefone, IPTU, condomínio, aluguéis e custos gerais) das COBANs e quiosques. Login por perfil, painel de pendências do mês, fila de aprovação e cofre de credenciais com log de auditoria.

Stack: Next.js 14 (App Router), Supabase (Auth + Postgres + RLS + Vault), Tailwind CSS. Pronto para Vercel.

## Antes de começar

O banco já precisa estar de pé no Supabase, com o `schema_contas_consumo.sql` e o `seed_contas_consumo.sql` executados. Este app só se conecta a ele.

## 1. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha com os dados do seu projeto Supabase (em Project Settings > API):

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

## 2. Criar o seu usuário

O login usa o Supabase Auth. Crie o usuário e promova a admin:

1. No Supabase, vá em Authentication > Users > Add user, e crie com o seu e-mail e uma senha.
2. No SQL Editor, rode (o perfil é criado automaticamente por trigger no primeiro acesso; se já existir, isto ajusta o papel):

```sql
update perfis set papel = 'admin' where email = 'voce@potencialgrupo.com.br';
```

Papéis disponíveis: `admin`, `gestor` (aprova), `operador` (lança) e `leitura`.

## 3. Rodar local

```
npm install
npm run dev
```

Abra http://localhost:3000 e entre com o e-mail e senha criados.

## 4. Subir no GitHub

```
git init
git add .
git commit -m "Contas de consumo - versao inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/contas-consumo.git
git push -u origin main
```

O `.gitignore` já exclui `node_modules`, `.next` e o `.env.local`, então suas chaves não vão para o repositório.

## 5. Deploy no Vercel

1. Em vercel.com, New Project e importe o repositório do GitHub.
2. O Vercel detecta Next.js sozinho, não precisa configurar build.
3. Em Environment Variables, adicione as duas: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, com os mesmos valores do `.env.local`.
4. Deploy.

Depois do deploy, vá em Supabase > Authentication > URL Configuration e adicione a URL do Vercel em Site URL e Redirect URLs, para o login funcionar em produção.

## Boletos pelo Slack (opcional)

A loja posta o PDF do boleto num canal do Slack e ele cai na Caixa de Entrada
já lido pela IA, com valor, tipo, loja e vencimento preenchidos. O bot responde
na thread dizendo o que entendeu. Continua passando pela confirmação humana —
nada vira lançamento sozinho.

É a mesma fila da varredura do Drive, só que outra porta de entrada: chega na
hora em vez de esperar o cron, e tem nome de quem enviou.

### 1. Criar o app no Slack

1. Em [api.slack.com/apps](https://api.slack.com/apps), **Create New App > From scratch**, escolha o workspace.
2. Em **OAuth & Permissions > Bot Token Scopes**, adicione:
   - `files:read` — baixar o PDF que foi postado
   - `chat:write` — responder na thread
   - `users:read` — descobrir o nome de quem enviou
3. Ainda nessa tela, **Install to Workspace**. Copie o **Bot User OAuth Token** (`xoxb-...`) para `SLACK_BOT_TOKEN`.
4. Em **Basic Information > App Credentials**, copie o **Signing Secret** para `SLACK_SIGNING_SECRET`.

### 2. Apontar os eventos para o app

1. Em **Event Subscriptions**, ligue o botão e ponha em Request URL:
   `https://SEU-APP.vercel.app/api/slack-eventos`
   O Slack chama a URL na hora pra validar — precisa já estar publicada, com
   `SLACK_SIGNING_SECRET` configurado no ambiente da Vercel.
2. Em **Subscribe to bot events**, adicione `file_shared`.
3. Salve e reinstale o app quando ele pedir.

### 3. Criar o canal e liberar o resto

1. Crie o canal (ex.: `#contas-boletos`) e convide o bot: `/invite @nome-do-app`.
2. Pegue o ID do canal (clique no nome do canal, o ID aparece no rodapé da aba
   Sobre, tipo `C0123ABCDEF`) e ponha em `SLACK_CANAL_BOLETOS`. Arquivo postado
   em qualquer outro canal é ignorado de propósito, pra ninguém gerar
   lançamento sem querer ao compartilhar um PDF.
3. Rode `sql/2026-08-18-slack-entrada.sql` no SQL Editor do Supabase.
4. O arquivo também é arquivado no Drive, em `Boletos-Entrada/Slack/AAAA-MM/`,
   então as credenciais do Drive precisam estar configuradas.

O que chega fora do horário ou com a leitura falhando fica numa fila
(`slack_fila`) e é recolhido pelo cron diário da Caixa de Entrada — no máximo
três tentativas por arquivo, e o bot avisa na thread quando desiste.

## Avisos no Slack

São três coisas diferentes, e vale saber qual é qual:

| O quê | Quando | Vai pra onde |
|---|---|---|
| Resumo diário | Dias úteis, 8h | `SLACK_WEBHOOK_URL` |
| Resumo semanal | Segunda de manhã | `SLACK_WEBHOOK_URL` |
| Eventos do sistema | Na hora em que acontece | `SLACK_WEBHOOK_EVENTOS` |

Os eventos são disparados pelo uso: conta lançada, aprovada, reprovada,
reenviada pra fila, paga, conta ou fornecedor cadastrado, excluído, encerrado
ou reativado, e loja concluída. São muitas mensagens por dia — por isso vão
num canal separado, pra não afogar o resumo diário.

Se `SLACK_WEBHOOK_EVENTOS` ficar vazio, tudo cai no canal do resumo.

O resumo diário também lista **valores acima do padrão da loja**: contas
cobrando mais de 1,6× a média histórica daquele fornecedor no ano, ignorando
valores abaixo de R$ 80 (onde a porcentagem engana) e fornecedores com menos
de duas cobranças anteriores. É o mesmo critério do alerta do Painel.

## Telas

- **Painel**: ativas, a lançar em julho, aguardando pagamento e origem a mapear, com um card por tipo de conta.
- **Contas**: tabela filtrável por tipo, praça e status; cada linha abre a ficha com o cofre e o histórico de lançamentos.
- **Aprovações**: lançamentos já feitos no SIP aguardando decisão de pagamento.
- **Cofre**: lista de credenciais e o log de quem revelou o quê e quando.

## Segurança

As senhas dos portais ficam no Supabase Vault, nunca em texto na tabela. A leitura passa pela função `credencial_ler`, que exige perfil autorizado e grava o acesso em `cofre_acessos`. O RLS controla o que cada papel enxerga e altera.
