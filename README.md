# AURA - Criador de Orçamentos

Sistema de criação de orçamentos de iluminação para a Luminatti.

## Stack

- React 18 + Vite + TypeScript
- Supabase (auth, PostgreSQL, edge functions, storage)
- TanStack Query, React Router v6
- shadcn-ui (Radix UI) + Tailwind CSS
- Deploy: Vercel

## Desenvolvimento

```bash
npm install
npm run dev      # dev server
npm run build    # build de produção
npm run lint     # lint
npm run test     # testes (vitest)
```

## Variáveis de ambiente

Crie um `.env` na raiz com:

```
VITE_SUPABASE_PROJECT_ID=...
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Deploy

- Frontend: Vercel (auto-deploy ao push na `main`)
- Backend: Supabase (migrations em `supabase/migrations/`, edge functions em `supabase/functions/`)

### Aplicar migrations

```bash
supabase link --project-ref <project-id>
supabase db push
```

### Deploy de edge functions

```bash
supabase functions deploy <nome-da-funcao>
```
