# Phase 12: Automação Aniversário - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Sistema dispara automaticamente um email **5 dias antes** do aniversário do cliente para (a) o **colaborador dono** do cliente (`clientes.user_id`) e (b) **todos os admins** do sistema (`has_role(admin)`), via:

1. **Tabela log** `aniversario_envios` com UNIQUE(cliente_id, ano_referencia) — garante idempotência (1 envio/ano/cliente)
2. **Edge function** `aniversario-clientes` (Deno + Resend SDK) — query D-5 + INSERT ON CONFLICT DO NOTHING + envia + atualiza status
3. **pg_cron** diário às 06:00 BR (09:00 UTC) via SQL migration — chama a edge function por pg_net HTTP POST

**Out of scope da Phase 12 (mas presente no marco):** Smoke & UAT closure (Phase 13). Edição manual da tabela log via admin UI fica deferred. Notificação por outros canais (WhatsApp, push) deferred.

</domain>

<decisions>
## Implementation Decisions

### A) Cron schedule & idempotência

- **D-01:** **Horário:** pg_cron diário às **06:00 BR = 09:00 UTC** (`'0 9 * * *'`). Colab vê email no começo do expediente; aniversário D-5 ainda dá tempo de organizar contato.
- **D-02:** **Idempotência via tabela log:**
  ```sql
  CREATE TABLE aniversario_envios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    ano_referencia INT NOT NULL,           -- ano do aniversário-alvo (ex: 2026)
    destinatarios JSONB NOT NULL,          -- {colab_email, admin_emails[]}
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('sent','failed','skipped_no_owner')),
    error_msg TEXT NULL,
    UNIQUE (cliente_id, ano_referencia)
  );
  ```
  Edge fn faz `INSERT ... ON CONFLICT (cliente_id, ano_referencia) DO NOTHING RETURNING id`. Se retornou 0 rows → cliente já notificado neste ano, pula. Se retornou row → envia.
- **D-03:** **Cron via SQL migration** com `cron.schedule('aniversario-diario', '0 9 * * *', $$ SELECT net.http_post(url, headers, body) $$)` — versionado, reproduzível. Migration habilita `CREATE EXTENSION IF NOT EXISTS pg_cron` + `pg_net` se não existirem em prod (verificar antes via `list_extensions`).

### B) Resolução do destinatário

- **D-04:** **Email do colab dono:** JOIN `clientes.user_id = auth.users.id` → `auth.users.email`. Direto, sem JOIN extra com `colaboradores`.
- **D-05:** **Admin: multi-admin via `has_role('admin')`** — query `SELECT u.email FROM auth.users u JOIN user_roles ur ON ur.user_id = u.id WHERE ur.role = 'admin'`. **Divergência consciente do AUTO-02 spec** (que dizia "David Grabarz email fixo configurável"): user escolheu broader — todos os admins do sistema recebem (hoje: Lenny + Lucas; David quando virar admin entra automaticamente). Sem env var fixa, sem hardcode.
- **D-06:** **Cliente órfão** (`user_id IS NULL` ou `auth.users` deletado): edge fn registra row com `status='skipped_no_owner'`, NÃO envia email, segue batch. Lenny olha tabela manualmente se quiser reassignar.

### C) Janela & edge cases

- **D-07:** **Janela exata D-5:** `today + interval '5 days'` bate com `extract(month from data_nascimento) + extract(day from data_nascimento)`. Um cliente é notificado **uma vez por ano** (UNIQUE constraint garante).
- **D-08:** **29/fev em ano não-bissexto:** dispara em **28/fev**. Implementação: na query SQL, se `data_nascimento` = 29/02 e ano corrente não-bissexto, mapear comparação para today+5 = 28/02. Helper inline na query do edge fn.
- **D-09:** **Resend falha (rate limit, email inválido, etc.):** row marcada com `status='failed'` + `error_msg = response.error`. **Sem retry** — UNIQUE constraint impede tentativa nova no mesmo ano. Lenny inspeciona tabela `aniversario_envios WHERE status='failed'` manualmente.

### D) Email content (Claude's Discretion)

- **Template visual:** seguir padrão do `request-access` (header `#1a1a2e`, card branco, prose 14-15px, CTA button verde)
- **From:** `"Aura Orçamentos <noreply@orcamentosaura.com.br>"` (mesmo do request-access, domínio já validado)
- **Subject:** `"Aniversário em 5 dias: {nome_cliente}"`
- **Body:** nome cliente, data aniversário (DD/MM), idade que completa (ano corrente - ano nascimento), contato cliente (se preenchido), nome colab dono (visível só pro admin), CTA "Abrir cliente no Aura" → `https://orcamentosaura.com.br/admin?tab=clientes`
- Conteúdo único para colab + admin (mesmo HTML) — admin recebe linha extra com nome do colab dono

### E) Implementação técnica

- **Edge function nova:** `supabase/functions/aniversario-clientes/index.ts`
  - Deno + `npm:resend@2.0.0` + `@supabase/supabase-js@2` (service role)
  - Endpoint POST sem body — cron passa nada, edge fn calcula tudo
  - Auth: usa service role key (não user auth) — pg_net chama com Authorization header
- **Migrations:**
  1. `20260515000001_aniversario_envios_table.sql` — CREATE TABLE log + UNIQUE constraint + RLS (admin SELECT-only via has_role, colab nenhum acesso direto)
  2. `20260515000002_aniversario_cron_schedule.sql` — extensions + cron.schedule chamando edge fn via pg_net
- **Env vars (Supabase Function Secrets):**
  - `RESEND_API_KEY` (já existe — request-access usa)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injetadas pela Supabase)
  - Nenhuma nova precisa
- **Manual trigger (smoke):** edge fn é POST endpoint público (verifica service role no header) → Lenny pode `curl` manual em prod pra testar antes do cron rodar

### Folded Todos

[Nenhum todo dobrado. Os 2 matches do cross_reference_todos são de PDF (Phase 11 já fechada), não aplicam aqui.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrão Resend + edge function (template validado em prod)
- `supabase/functions/request-access/index.ts` — pattern completo Deno + Resend + HTML email. Phase 12 replica:
  - Import Resend (l.2)
  - `Deno.serve` handler (l.26)
  - Resend `.emails.send` (l.128) com `from: "Aura Orçamentos <noreply@orcamentosaura.com.br>"`
  - HTML template style (header `#1a1a2e`, card layout, CTA buttons)
  - CORS headers (l.4-8) — Phase 12 NÃO precisa de CORS (chamada server-side via pg_net), mas se Lenny quiser trigger manual via curl/browser, manter

### Schema upstream (Phase 7 + Phase 9 — pré-requisitos prontos)
- `supabase/migrations/20260511000001_arquitetos_clientes_user_id.sql` — confirma `clientes.user_id UUID NOT NULL` (RLS-03)
- `supabase/migrations/20260511000002_clientes_data_nascimento.sql` — confirma `clientes.data_nascimento DATE NULL` + index BTREE (AUTO-03)
- `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql` — confirma RLS policies de `clientes` (não afeta edge fn que usa service role)

### Auth & roles
- `supabase/migrations/...has_role*.sql` — função `has_role(uuid, app_role)` (verificar nome exato durante research) usada pra resolver admins multi
- `auth.users` (Supabase managed) — `.email` é fonte canônica
- `user_roles` table — JOIN `user_id` + `role='admin'`

### pg_cron + pg_net (Supabase managed extensions)
- Docs: https://supabase.com/docs/guides/cron/quickstart
- Docs: https://supabase.com/docs/guides/database/extensions/pg_net
- Verificar via `list_extensions` MCP se já estão `installed: true` em prod antes da migration; se não, `CREATE EXTENSION` na migration

### Projeto + marco
- `.planning/PROJECT.md` — milestone v1.1 frente #6 ("Automação — aniversário do cliente")
- `.planning/REQUIREMENTS.md` §AUTO-01, AUTO-02, AUTO-03 — IDs cobertos
- `.planning/ROADMAP.md` §Phase 12 — goal, depends_on (Phase 7 + 9), success_criteria
- `.planning/phases/07-schema-prep-v1-1/07-CONTEXT.md` §D-07..D-09 — schema `data_nascimento` confirma decisões aqui

### Memory (auto-loaded)
- AURA Resend: Lucas owner + Lenny teammate, domínio próprio `orcamentosaura.com.br` validado → from address já funciona

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`request-access/index.ts`**: template completo de edge fn Resend (Deno + npm:resend@2.0.0 + service role client + HTML inline). Phase 12 copia estrutura, troca handler logic, mantém Resend setup + HTML style.
- **`from: "Aura Orçamentos <noreply@orcamentosaura.com.br>"`**: já validado no Resend, dispara sem warning de domínio.
- **`ADMIN_EMAIL` env var**: já existe pro request-access. Phase 12 NÃO usa (multi-admin via DB query), mas pattern de env var fica disponível se Lenny quiser fallback futuro.
- **`auth.users` JOIN pattern**: edge functions sempre usam service role client (`SUPABASE_SERVICE_ROLE_KEY`) — não bate com RLS, vê tudo. Phase 12 segue o mesmo.

### Established Patterns
- **Schema aditivo:** tabela nova `aniversario_envios` não toca nada existente. Padrão v1.0/v1.1 mantido.
- **Migration por domínio:** 2 arquivos separados (table + cron). Padrão Phase 7 (D-19).
- **Idempotência via UNIQUE constraint:** padrão Postgres seguro pra batch jobs — não depende de aplicação acertar.
- **Edge function = Deno + service role:** create-colaborador, import-produtos, request-access, review-access, validar-sistema-orcamento, import-precos seguem todos esse padrão.

### Integration Points
- **`clientes.data_nascimento`** (Phase 7) — coluna existe + index BTREE. Query D-5 filtra com extract(month/day).
- **`clientes.user_id`** (Phase 7 + 9) — NOT NULL desde 2026-05-11; JOIN auth.users sempre encontra (D-06 cobre edge case raro de auth.user deletado).
- **`user_roles` table** (v1.0) — fonte de admin via `has_role` ou JOIN direto.
- **Resend domain `orcamentosaura.com.br`** — validado em prod (request-access funcionando).

</code_context>

<specifics>
## Specific Ideas

- **Manual smoke trigger:** edge fn é POST endpoint sem body — Lenny pode disparar via `curl -X POST https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes -H "Authorization: Bearer $SERVICE_ROLE"` pra testar antes do cron rodar (sem precisar esperar 06:00 BR). Útil pra Phase 13 smoke.
- **Tabela log com RLS admin-only SELECT:** Lenny consegue inspecionar `aniversario_envios` direto pelo admin UI ou via Supabase Dashboard — útil pra auditar entregas Resend falhadas (`status='failed'`).
- **`destinatarios JSONB`** guarda lista exata enviada — se admin adicionar/remover no meio do ano, fica registrado quem realmente recebeu naquela execução.
- **Sem UI nova:** Phase 12 é zero-frontend. Toda visibilidade vem da tabela log (que pode ganhar UI em phase futura se virar requisito).

</specifics>

<deferred>
## Deferred Ideas

- **UI admin pra reenviar/cancelar aniversário** — phase futura se virar requisito (hoje: edit manual no Supabase Dashboard).
- **Notificação por WhatsApp ou push** — out of scope, email-only.
- **Customização do template do email por colab** (ex: assinatura, cor) — out of scope.
- **Métrica de engajamento Resend** (open rate, click rate) — out of scope, Resend já registra no dashboard deles se Lenny quiser olhar.
- **Aniversário do arquiteto** — só cliente. Se virar requirement, vira phase nova (precisa de `data_nascimento` em arquitetos também — já existe via Phase 8 FORM-02!).
- **Notificação D-1 ou D-0 extra** — só D-5. Adicionar segunda janela vira phase nova.
- **Retry automático no dia seguinte** — D-09 explicitamente sem retry; revisar se taxa de falha Resend virar problema.
- **Index funcional `MONTH(data_nascimento), DAY(data_nascimento)`** — Phase 7 D-08 já deferiu; revisar se query D-5 ficar lenta com volume.

### Reviewed Todos (not folded)
- `2026-04-27-pdf-zuado-input-para-phase-5.md` — pertence à Phase 11 (já fechada)
- `2026-05-06-pdf-orcamento-estetica-ruim.md` — pertence à Phase 11 (já fechada)

</deferred>

---

*Phase: 12-automa-o-anivers-rio*
*Context gathered: 2026-05-14*
