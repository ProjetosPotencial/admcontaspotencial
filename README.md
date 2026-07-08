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

## Telas

- **Painel**: ativas, a lançar em julho, aguardando pagamento e origem a mapear, com um card por tipo de conta.
- **Contas**: tabela filtrável por tipo, praça e status; cada linha abre a ficha com o cofre e o histórico de lançamentos.
- **Aprovações**: lançamentos já feitos no SIP aguardando decisão de pagamento.
- **Cofre**: lista de credenciais e o log de quem revelou o quê e quando.

## Segurança

As senhas dos portais ficam no Supabase Vault, nunca em texto na tabela. A leitura passa pela função `credencial_ler`, que exige perfil autorizado e grava o acesso em `cofre_acessos`. O RLS controla o que cada papel enxerga e altera.
