# Phase 12: Automação Aniversário — Research

**Researched:** 2026-05-14
**Domain:** Supabase backend automation (pg_cron + pg_net + Edge Function Resend)
**Confidence:** HIGH (decisões locked + padrões internos validados em prod; sintaxe pg_cron/pg_net VERIFIED via docs Supabase + WebSearch cruzado)
**Project ref:** `jkewlaezvrbuicmncqbj` (region `sa-east-1`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Cron diário às **06:00 BR = 09:00 UTC** (`'0 9 * * *'`)
- **D-02:** Idempotência via tabela `aniversario_envios` com `UNIQUE(cliente_id, ano_referencia)` + `INSERT ... ON CONFLICT DO NOTHING RETURNING id`
- **D-03:** Cron criado via SQL migration usando `pg_cron` + `pg_net.http_post` (versionado/reproduzível)
- **D-04:** Email do colab dono via `JOIN clientes.user_id = auth.users.id` → `auth.users.email`
- **D-05:** Admin multi-tenant via `has_role(auth.uid(), 'admin')` — todos os admins do sistema recebem. **Divergência consciente do REQ AUTO-02** que pedia "email fixo configurável" — Lenny decidiu broader (Lenny + Lucas hoje, David quando virar admin entra automaticamente)
- **D-06:** Cliente órfão (user_id deletado em auth.users) → row com `status='skipped_no_owner'`, sem email
- **D-07:** Janela D-5 exata: `today + interval '5 days'` bate com `extract(month/day from data_nascimento)`. 1 envio por ano garantido pela UNIQUE constraint
- **D-08:** 29/02 em ano não-bissexto → dispara em 28/02 (helper inline na query SQL)
- **D-09:** Resend falha → `status='failed'` + `error_msg`. **Sem retry** (UNIQUE constraint bloqueia nova tentativa no mesmo ano)
- **Template visual:** seguir padrão do `request-access` (header `#1a1a2e`, card branco, CTA verde)
- **From address:** `"Aura Orçamentos <noreply@orcamentosaura.com.br>"` (domínio Resend já validado)
- **Subject:** `"Aniversário em 5 dias: {nome_cliente}"`
- **CTA URL:** `https://orcamentosaura.com.br/admin?tab=clientes`
- **Smoke trigger:** edge fn é POST público sem body; Lenny dispara `curl` manual em prod com Authorization Bearer service_role pra testar antes do cron rodar

### Claude's Discretion

- Layout exato do HTML email (estrutura, copywriting do corpo) — desde que siga style request-access
- Naming dos cron jobs internos
- Granularidade de logs do edge function (console.log vs structured)
- Decisão técnica: Vault vs hardcode da service_role_key no SQL do cron (research recomenda Vault)

### Deferred Ideas (OUT OF SCOPE)

- UI admin pra reenviar/cancelar aniversário (hoje: edit manual no Supabase Dashboard)
- Notificação WhatsApp ou push
- Customização do template por colab
- Métricas de engajamento Resend (open/click)
- Aniversário do arquiteto
- Notificação D-1 ou D-0 adicional
- Retry automático no dia seguinte
- Index funcional `MONTH(data_nascimento), DAY(data_nascimento)` (Phase 7 D-08 já deferiu)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTO-01 | Sistema envia email 5d antes do aniversário do cliente pro colaborador dono | Finding 1 (query D-5) + Finding 4 (edge function loop) + Finding 3 (JOIN auth.users via user_id) |
| AUTO-02 | Sistema envia email 5d antes pro admin (REQ original dizia "David Grabarz fixo"; CONTEXT D-05 generalizou pra multi-admin via has_role — divergência consciente registrada) | Finding 3 (has_role signature) + Finding 4 (loop admin emails) |

**Nota AUTO-03:** Schema (`clientes.data_nascimento` + index BTREE) já foi entregue na Phase 7 (`20260511000002_clientes_data_nascimento.sql`). Phase 12 apenas consome.
</phase_requirements>

## Summary

Phase 12 implementa o primeiro job assíncrono recorrente do AURA: um cron diário às 06:00 BR que dispara uma edge function Resend pra notificar colaboradores e admins sobre aniversários de clientes 5 dias antes da data. **Toda a infraestrutura é nova pro projeto** — `pg_cron` e `pg_net` ainda não foram usados em produção, mas são extensões managed pela Supabase (disponíveis sem instalação extra; basta `CREATE EXTENSION IF NOT EXISTS`). O padrão da edge function é replicação direta de `request-access/index.ts` (Deno + `npm:resend@2.0.0` + service role client), trocando apenas o handler logic. A idempotência fica garantida no nível do Postgres via `UNIQUE(cliente_id, ano_referencia)` + `INSERT ON CONFLICT DO NOTHING RETURNING id` — independe de bug na edge function.

**Primary recommendation:** Implementar em **2 migrations + 1 edge function**:
1. Migration `20260515000001_aniversario_envios_table.sql` — tabela log + UNIQUE + RLS admin-only SELECT
2. Edge function `supabase/functions/aniversario-clientes/index.ts` — query D-5 + INSERT log + Resend loop
3. Migration `20260515000002_aniversario_cron_schedule.sql` — `CREATE EXTENSION` + `vault.create_secret` + `cron.schedule` chamando edge fn via `net.http_post`

Migration #3 fica por último porque depende do edge function já estar deployed (caso contrário o primeiro cron run falha em produção até deploy).

## Standard Stack

### Core (já no projeto — replicar)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `npm:resend@2.0.0` | 2.0.0 | SDK Resend pra envio de email | Já usado em `request-access` em prod; domínio `orcamentosaura.com.br` validado |
| `@supabase/supabase-js@2` (via esm.sh) | 2.x | Service role client dentro do edge function | Padrão usado em todas as 6 edge functions do AURA |
| `Deno.serve` | runtime | HTTP handler Deno | Padrão Supabase Edge Functions |

### Supporting (extensões Postgres — novas para o projeto)

| Extension | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `pg_cron` | managed Supabase | Agendamento de jobs no Postgres | Phase 12 cron diário 09:00 UTC |
| `pg_net` | managed Supabase | HTTP requests assíncronos a partir do SQL | Phase 12 cron chamando edge function via POST |
| `supabase_vault` | managed Supabase | Storage criptografado de secrets dentro do DB | Phase 12: guardar `service_role_key` pra Authorization header do cron sem hardcode |

**`pg_cron` + `pg_net` em prod:** [VERIFIED via docs Supabase] São extensões managed disponíveis em todos os projetos. Confirmar via MCP `list_extensions` em `jkewlaezvrbuicmncqbj` antes da migration; se já estiverem `installed: true`, o `CREATE EXTENSION IF NOT EXISTS` é no-op safe. Se não, a migration habilita.

**Vault em prod:** [CITED: docs.supabase.com/guides/cron/quickstart] A Supabase recomenda armazenar `service_role_key` no Vault em vez de hardcode na migration (segurança + rotação). Padrão atual do AURA não usa Vault em lugar nenhum (todas as secrets são env vars do edge function via `Supabase Function Secrets`). **Phase 12 introduz Vault pelo motivo certo:** o cron SQL é executado dentro do Postgres, não tem acesso aos env vars do edge function; Vault é a única forma documentada de evitar service_role_key plain-text na migration.

### Não usar
| Don't | Why |
|-------|-----|
| `pg_cron` chamando função SQL local em vez de edge function | Resend SDK não roda em pl/pgsql; precisa de Deno runtime |
| Vercel cron / external scheduler | CONTEXT.md D-03 locked: tudo via Supabase managed |
| `pg_net.http_get` | POST é o método correto pra invocar edge function (mesmo sem body) |

## Architecture Patterns

### Estrutura

```
supabase/
├── functions/
│   └── aniversario-clientes/         # NOVO
│       └── index.ts
└── migrations/
    ├── 20260515000001_aniversario_envios_table.sql      # NOVO — tabela log
    └── 20260515000002_aniversario_cron_schedule.sql     # NOVO — cron schedule
```

### Pattern 1: Idempotência via INSERT ON CONFLICT

Postgres UNIQUE constraint é o único mecanismo que **garante** "1 envio por ano por cliente" mesmo se a edge function crashar no meio do batch ou o cron disparar 2x por bug.

```sql
INSERT INTO aniversario_envios (cliente_id, ano_referencia, destinatarios, status)
VALUES ($1, $2, $3, 'sent')
ON CONFLICT (cliente_id, ano_referencia) DO NOTHING
RETURNING id;
```

Se `RETURNING id` traz 0 rows → já notificado este ano → pula. Sem race condition, sem necessidade de lock.

### Pattern 2: Service role client + Resend (replicado de request-access)

```typescript
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // bypass RLS
);
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
```

### Pattern 3: Cron via Vault-stored service_role_key

```sql
SELECT cron.schedule(
  'aniversario-diario',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000  -- 60s pra cobrir batch grande
  ) AS request_id;
  $$
);
```

### Anti-Patterns

- **Hardcode da service_role_key na migration** — quebra rotação, leak em git history. Vault evita.
- **Cron rodando query SQL direto sem edge function** — Resend só tem SDK Node/Deno, não pl/pgsql. Edge function é mandatório.
- **Loop síncrono por cliente fazendo `await resend.send()` sequencial** — OK pra volume atual (Lenny + Lucas + uns clientes), mas se virar 100+ aniversários no mesmo dia, considerar `Promise.all` em chunks de 10. Por ora, sequencial é mais fácil de debugar.
- **Recalcular ano_referencia manualmente em vez de `EXTRACT(YEAR FROM today + 5 days)`** — bug sutil em 28-31 dezembro (D-5 cai no ano seguinte). Use a data alvo, não today.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecção de "1 envio por ano" | Map em memória ou flag em coluna `notificado_ano DATE` em clientes | UNIQUE constraint em tabela log dedicada | Tabela log dá auditoria + recuperação; UNIQUE é atomic, sem race |
| Scheduling diário | Cron externo (GitHub Actions, Vercel Cron) chamando webhook | `pg_cron` + `pg_net` | CONTEXT D-03 locked; managed pela Supabase, zero infra extra |
| Lookup do admin | Hardcode `ADMIN_EMAIL` env var | `has_role(uuid, app_role) = true` + JOIN auth.users | CONTEXT D-05 locked: multi-admin dinâmico |
| Detecção de leap year | Função custom em JS | `EXTRACT(MONTH FROM ...) AND EXTRACT(DAY FROM ...)` + collapse 29/02→28/02 condicional | Postgres já tem; ver Finding 1 |
| Email HTML | Library MJML, react-email | HTML inline literal (string template) | request-access usa inline há semanas em prod; baixa complexidade não justifica dependência nova |

**Key insight:** Toda a complexidade desta fase é em queries SQL + handling correto de edge cases (29/02, cliente órfão, ano de referência em fim de ano). O TypeScript é boilerplate ≈ request-access.

## Runtime State Inventory

> Phase rename/refactor? **Não.** Phase greenfield (cria tabela + edge function + cron novos). Categoria skipped.

## Common Pitfalls

### Pitfall 1: Cron rodando antes do edge function existir

**O que dá errado:** Migration #2 (cron.schedule) aplica antes do `supabase functions deploy aniversario-clientes` → primeiro run às 09:00 UTC recebe 404 → linha em `net._http_response` com status 404 → silencioso porque não tem retry.

**Como evitar:** Order de execução em prod:
1. `supabase db push` migration #1 (tabela log)
2. `supabase functions deploy aniversario-clientes`
3. Smoke manual via curl
4. `supabase db push` migration #2 (cron schedule)

Plan de execução deve registrar esta ordem explicitamente (não pode ser `db push` de todas as migrations em série antes do deploy do edge fn).

**Warning signs:** Tabela `cron.job_run_details` mostra `status='succeeded'` mesmo quando a edge fn deu 404 (pg_net só falha se TCP/DNS falhar; HTTP 4xx/5xx vira "success" do ponto de vista do http_post). Inspecionar `net._http_response.status_code`.

### Pitfall 2: 29/02 silenciosamente perdido em ano não-bissexto

**O que dá errado:** Cliente nasceu 29/02/1992. Em 2026 (não bissexto), `today + 5 days = 28/02/2026`. Query `WHERE extract(month from data_nascimento) = extract(month from target) AND extract(day from data_nascimento) = extract(day from target)` retorna 0 rows porque `extract(day) = 29 ≠ 28`. Cliente nunca recebe email.

**Como evitar:** Mapping explícito (D-08):

```sql
-- Caso especial: se data_nascimento é 29/02 e o ano corrente NÃO é bissexto,
-- compara com 28/02. Caso contrário, mês/dia direto.
WITH target AS (
  SELECT (CURRENT_DATE + INTERVAL '5 days')::date AS d
)
SELECT c.*
FROM clientes c, target
WHERE c.data_nascimento IS NOT NULL
  AND (
    -- Caso comum: mês/dia bate exato
    (EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM target.d)
     AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM target.d))
    OR
    -- Caso 29/02 em ano não-bissexto: target = 28/02, nascimento = 29/02
    (EXTRACT(MONTH FROM c.data_nascimento) = 2
     AND EXTRACT(DAY FROM c.data_nascimento) = 29
     AND EXTRACT(MONTH FROM target.d) = 2
     AND EXTRACT(DAY FROM target.d) = 28
     AND EXTRACT(MONTH FROM (target.d + INTERVAL '1 day')) = 3)  -- amanhã é março = não-bissexto
  );
```

**Warning signs:** Cliente com data_nascimento 29/02 nunca recebe; testar manualmente inserindo cliente fictício com data_nascimento '1992-02-29' em ano não-bissexto.

### Pitfall 3: ano_referencia errado em fim de ano

**O que dá errado:** Today = 2026-12-30, target = 2027-01-04. Cliente nasceu 04/01/1990. `EXTRACT(YEAR FROM CURRENT_DATE) = 2026`, mas o aniversário-alvo é 2027. Se a edge fn gravar `ano_referencia=2026`, no dia 04/01/2027 (passado o aniversário) o cron volta a rodar pra esse cliente e UNIQUE não bloqueia (ano_referencia=2027 é novo) → cliente recebe 2 emails no mesmo aniversário.

**Como evitar:** Calcular `ano_referencia` a partir do target date, não do today:

```typescript
const target = new Date();
target.setUTCDate(target.getUTCDate() + 5);
const anoReferencia = target.getUTCFullYear();
```

Ou em SQL: `EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '5 days'))::int`.

**Warning signs:** Aniversário 1-5 de janeiro recebendo duplicado em ano que vira. Smoke deve cobrir cliente com data_nascimento 02/01.

### Pitfall 4: Cliente órfão por auth.users deletado

**O que dá errado:** `clientes.user_id NOT NULL` desde Phase 7, mas se admin deletar usuário do auth.users com ON DELETE RESTRICT, o delete falha. Porém, se o user for desabilitado/banido (não deletado), `auth.users` ainda tem o row mas `.email` pode estar inválido/null. JOIN retorna row, Resend recebe email inválido → response error → status='failed'.

**Como evitar (D-06):** Validar `auth.users.email IS NOT NULL AND trim(email) != ''` antes de marcar pra envio. Se vazio:

```typescript
if (!owner.email || owner.email.trim() === '') {
  await supabase.from('aniversario_envios').insert({
    cliente_id: c.id,
    ano_referencia: anoReferencia,
    destinatarios: { colab_email: null, admin_emails: [] },
    status: 'skipped_no_owner',
    error_msg: 'auth.users.email vazio/inválido'
  });
  continue;
}
```

### Pitfall 5: pg_net response status invisível

**O que dá errado:** `net.http_post` retorna `request_id` imediato (async). O status real (200, 4xx, 5xx) chega depois e fica em `net._http_response`. Falha silenciosa: cron mostra "succeeded" mas o edge function deu 500. Não dá pra detectar olhando só `cron.job_run_details`.

**Como evitar:** Smoke obrigatório verifica `SELECT status_code, content, error_msg FROM net._http_response ORDER BY created DESC LIMIT 5;` após primeiro run real do cron.

**Warning signs:** Tabela `aniversario_envios` vazia depois de cron rodar; cron.job_run_details mostra success. Diagnóstico está em `net._http_response`.

### Pitfall 6: CONFLICT silencioso bloqueando re-smoke

**O que dá errado:** Lenny faz smoke manual via curl, envia OK, row criada com `status='sent'`. Quer testar de novo no mesmo dia (ex: ajustou HTML) → INSERT ON CONFLICT DO NOTHING não retorna row → edge fn pula → "nada acontece" (parece bug).

**Como evitar:** Documentar comando de reset no smoke:

```sql
DELETE FROM aniversario_envios
WHERE cliente_id = (SELECT id FROM clientes WHERE nome = 'TESTE Aniversário')
  AND ano_referencia = EXTRACT(YEAR FROM CURRENT_DATE + INTERVAL '5 days')::int;
```

## Code Examples

### Edge Function — esqueleto completo (replica request-access)

```typescript
// supabase/functions/aniversario-clientes/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClienteAniversariante {
  id: string;
  nome: string;
  data_nascimento: string;
  contato: string | null;
  user_id: string;
  colab_email: string | null;  // populated via JOIN
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

  // 1. Calcular target date e ano_referencia
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + 5);
  const anoReferencia = target.getUTCFullYear();

  // 2. Query D-5 (ver Finding 1 para SQL completo)
  const { data: aniversariantes, error: queryErr } = await supabase.rpc(
    'buscar_aniversariantes_d5'  // OU query inline via .from() (ver Finding 1)
  );

  if (queryErr) {
    console.error('Query D-5 failed:', queryErr);
    return new Response(JSON.stringify({ error: queryErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 3. Lookup admins (uma vez só, antes do loop)
  const { data: adminUsers } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  const adminUserIds = (adminUsers ?? []).map(r => r.user_id);
  // Listar emails via auth admin API (service role tem acesso)
  const adminEmails: string[] = [];
  for (const uid of adminUserIds) {
    const { data: u } = await supabase.auth.admin.getUserById(uid);
    if (u?.user?.email) adminEmails.push(u.user.email);
  }

  let processed = 0, sent = 0, failed = 0, skipped = 0;

  // 4. Loop por aniversariante
  for (const cliente of (aniversariantes ?? []) as ClienteAniversariante[]) {
    processed++;

    // 4a. Validar colab dono
    if (!cliente.colab_email || cliente.colab_email.trim() === '') {
      await supabase.from('aniversario_envios').insert({
        cliente_id: cliente.id,
        ano_referencia: anoReferencia,
        destinatarios: { colab_email: null, admin_emails: adminEmails },
        status: 'skipped_no_owner',
        error_msg: 'colab dono sem email',
      });
      skipped++;
      continue;
    }

    const destinatarios = {
      colab_email: cliente.colab_email,
      admin_emails: adminEmails,
    };

    // 4b. INSERT ON CONFLICT (idempotência)
    const { data: inserted, error: insErr } = await supabase
      .from('aniversario_envios')
      .insert({
        cliente_id: cliente.id,
        ano_referencia: anoReferencia,
        destinatarios,
        status: 'sent',  // optimistic; corrigido abaixo se falhar
      })
      .select('id')
      .single();

    if (insErr) {
      // Se foi conflict (já notificado), pula silencioso
      if (insErr.code === '23505') { skipped++; continue; }
      console.error('Insert log failed:', insErr);
      failed++;
      continue;
    }

    const logId = inserted!.id;

    // 4c. Send email
    const toList = [cliente.colab_email, ...adminEmails];
    const dataAniv = new Date(cliente.data_nascimento);
    const idadeQueCompleta = anoReferencia - dataAniv.getUTCFullYear();
    const dataFormatada = `${String(dataAniv.getUTCDate()).padStart(2, '0')}/${String(dataAniv.getUTCMonth() + 1).padStart(2, '0')}`;

    try {
      const result = await resend.emails.send({
        from: "Aura Orçamentos <noreply@orcamentosaura.com.br>",
        to: toList,
        subject: `Aniversário em 5 dias: ${cliente.nome}`,
        html: buildHtml({
          nome: cliente.nome,
          dataFormatada,
          idade: idadeQueCompleta,
          contato: cliente.contato,
        }),
      });

      if (result.error) throw new Error(result.error.message);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from('aniversario_envios')
        .update({ status: 'failed', error_msg: msg })
        .eq('id', logId);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ processed, sent, failed, skipped }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
});

function buildHtml(args: { nome: string; dataFormatada: string; idade: number; contato: string | null }): string {
  // Template estilo request-access — header #1a1a2e, card, CTA verde
  return `<!DOCTYPE html><html>...</html>`;  // ver Finding 5
}
```

### Migration #1 — tabela log

```sql
-- supabase/migrations/20260515000001_aniversario_envios_table.sql
-- Phase 12 / Plan TBD: Tabela log de envios de aniversário (AUTO-01/AUTO-02)
-- Refs: CONTEXT D-02 (UNIQUE cliente_id+ano), D-06 (status skipped_no_owner), D-09 (failed)

BEGIN;

CREATE TABLE public.aniversario_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ano_referencia INT NOT NULL,
  destinatarios JSONB NOT NULL,  -- {colab_email: string|null, admin_emails: string[]}
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_no_owner')),
  error_msg TEXT NULL,
  UNIQUE (cliente_id, ano_referencia)
);

CREATE INDEX idx_aniversario_envios_cliente ON public.aniversario_envios(cliente_id);
CREATE INDEX idx_aniversario_envios_status ON public.aniversario_envios(status) WHERE status = 'failed';

COMMENT ON TABLE public.aniversario_envios IS
  'Log de envios de email de aniversário (Phase 12). UNIQUE(cliente_id, ano_referencia) garante 1 envio/ano. Status sent|failed|skipped_no_owner.';

ALTER TABLE public.aniversario_envios ENABLE ROW LEVEL SECURITY;

-- Admin pode ler tudo (auditoria). Colab nenhum acesso direto (edge fn usa service role).
CREATE POLICY "Admins can read aniversario_envios"
  ON public.aniversario_envios FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Nenhuma policy de INSERT/UPDATE/DELETE pra authenticated — só service role escreve.

COMMIT;
```

### Migration #2 — cron schedule

```sql
-- supabase/migrations/20260515000002_aniversario_cron_schedule.sql
-- Phase 12 / Plan TBD: Cron diário 09:00 UTC chamando aniversario-clientes (AUTO-01/AUTO-02)
-- Refs: CONTEXT D-01 (06:00 BR = 09:00 UTC), D-03 (cron via SQL migration)
--
-- PRÉ-REQUISITO: edge function `aniversario-clientes` JÁ DEVE ESTAR DEPLOYED em prod
-- antes desta migration rodar. Caso contrário, primeiro run dará 404 silencioso.

BEGIN;

-- Extensões managed pela Supabase (no-op se já habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Vault: secret pra service_role_key.
-- ATENÇÃO: ANTES de aplicar esta migration em prod, Lenny precisa rodar
-- (via Supabase Dashboard SQL Editor, NÃO commitado em git):
--   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'Phase 12 cron auth');
-- A migration NÃO insere o valor (não pode estar em git). Migration apenas usa.

-- Cleanup defensivo (caso já exista do unschedule/reschedule)
SELECT cron.unschedule('aniversario-diario') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'aniversario-diario'
);

-- Schedule diário 09:00 UTC = 06:00 BR
SELECT cron.schedule(
  'aniversario-diario',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

COMMIT;
```

## Findings — research por gap

### Finding 1: Query D-5 SQL otimizada (gap #3)

**Decisão pendente pro planner:** implementar como **stored function** (`buscar_aniversariantes_d5()`) ou **inline na edge function via `.from('clientes').select(...).rpc(...)`**?

**Recomendação:** Stored function. Razões:
- Edge function fica simples (1 RPC call vs 30 linhas de SQL stringified)
- Reutilizável pra smoke manual (`SELECT * FROM buscar_aniversariantes_d5()` no SQL Editor)
- Versionada na migration (research/audit fica mais simples)

**SQL ready to paste:**

```sql
-- Função pra buscar clientes aniversariantes 5 dias à frente.
-- Retorna joined com email do colab dono.
CREATE OR REPLACE FUNCTION public.buscar_aniversariantes_d5()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  data_nascimento DATE,
  contato TEXT,
  user_id UUID,
  colab_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT (CURRENT_DATE + INTERVAL '5 days')::date AS d
  ),
  -- Filtra clientes que ainda não foram notificados neste ano
  ja_notificados AS (
    SELECT cliente_id
    FROM public.aniversario_envios
    WHERE ano_referencia = EXTRACT(YEAR FROM (SELECT d FROM target))::int
  )
  SELECT
    c.id,
    c.nome,
    c.data_nascimento,
    c.contato,
    c.user_id,
    u.email::text AS colab_email
  FROM public.clientes c
  CROSS JOIN target t
  LEFT JOIN auth.users u ON u.id = c.user_id
  WHERE c.data_nascimento IS NOT NULL
    AND c.id NOT IN (SELECT cliente_id FROM ja_notificados)
    AND (
      -- Caso comum: mês/dia bate exato
      (EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM t.d)
       AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM t.d))
      OR
      -- Caso 29/02 em ano não-bissexto: target = 28/02
      (EXTRACT(MONTH FROM c.data_nascimento) = 2
       AND EXTRACT(DAY FROM c.data_nascimento) = 29
       AND EXTRACT(MONTH FROM t.d) = 2
       AND EXTRACT(DAY FROM t.d) = 28
       AND EXTRACT(MONTH FROM (t.d + INTERVAL '1 day')) = 3)
    );
$$;

-- Apenas service role chama (edge fn). Authenticated não tem permissão direta.
REVOKE EXECUTE ON FUNCTION public.buscar_aniversariantes_d5() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.buscar_aniversariantes_d5() FROM authenticated;
```

**Por que `SECURITY DEFINER`:** Função lê `auth.users.email`, que `authenticated` não tem acesso direto. Definer roda como dono (postgres role), service role chama via RPC.

**Por que `LEFT JOIN auth.users`:** Cobre D-06 (cliente órfão com `user_id` apontando pra user deletado retorna `colab_email = NULL`).

**Por que `NOT IN ja_notificados`:** Otimização — evita serializar clientes já notificados pro edge fn (UNIQUE constraint cobre, mas reduz round trips Resend desnecessários).

### Finding 2: pg_cron + pg_net na Supabase (gap #1)

**Verificação prévia obrigatória:**

```sql
-- Rodar via Supabase Dashboard SQL Editor antes de criar migration #2
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name IN ('pg_cron', 'pg_net', 'supabase_vault')
ORDER BY name;
```

Espera-se `installed_version` populado pros 3. Se algum vier NULL, ainda assim a migration `CREATE EXTENSION IF NOT EXISTS` resolve — extensões são managed e instalação é instantânea no plano hosted.

**MCP alternativo:** `mcp__plugin_supabase_supabase__list_extensions` retorna lista filtrável. Verificar antes do plan execution.

**URL canônica edge function:** `https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes` [VERIFIED via project ref + pattern Supabase Functions URL]

**Inspecionar execuções do cron:**

```sql
-- Últimas 10 runs
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'aniversario-diario')
ORDER BY start_time DESC
LIMIT 10;

-- Response HTTP real (status_code do edge function)
SELECT id, status_code, content_type, content, error_msg, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
```

**Desabilitar em dev sem dois ambientes:** Lenny só tem prod (`jkewlaezvrbuicmncqbj`). Pra pausar o cron sem deletar:

```sql
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'aniversario-diario'),
  active := false
);
-- Reativar: active := true
-- Deletar: SELECT cron.unschedule('aniversario-diario');
```

[CITED: supabase.com/docs/guides/cron/quickstart, supabase.com/docs/guides/functions/schedule-functions]

### Finding 3: has_role signature exata (gap #2)

**[VERIFIED via grep migrations/20260218165401_f86d5757-ddaf-4bce-befb-c69015b62f13.sql]**

```sql
public.has_role(_user_id uuid, _role app_role) RETURNS boolean
```

- `app_role` é enum: `('admin', 'user')`
- `STABLE`, `SECURITY DEFINER`, `SET search_path = public`
- Cast quando necessário: `'admin'::app_role` (especialmente em `WHERE has_role(..., 'admin'::app_role)`)

**Uso no AURA hoje:**
- 12 migrations diferentes referenciam `public.has_role(auth.uid(), 'admin')` (sem cast explícito; Postgres infere)
- 1 referência usa cast explícito (`20260514000002_orcamentos_status_rls.sql:41`): `public.has_role(auth.uid(), 'admin'::app_role)` — recomendar usar cast em SQL novo pra evitar ambiguidade

**Resolução de admins na edge function:**

```typescript
// Opção A (recomendada): JOIN direto user_roles + auth.users
const { data: admins } = await supabase
  .from('user_roles')
  .select('user_id')
  .eq('role', 'admin');

// Loop pra resolver emails (sem JOIN direto porque auth.users não é querável via PostgREST):
const adminEmails: string[] = [];
for (const { user_id } of (admins ?? [])) {
  const { data } = await supabase.auth.admin.getUserById(user_id);
  if (data?.user?.email) adminEmails.push(data.user.email);
}
```

**Opção B (alternativa, evita N+1):** Criar stored function `buscar_admins_emails()` parecida com `buscar_aniversariantes_d5()` que faz JOIN direto auth.users (SECURITY DEFINER). Mais limpo se houver muitos admins. Hoje (Lenny + Lucas = 2), N+1 é trivial.

**Não usar:** `supabase.rpc('has_role', { _user_id, _role })` em loop por admin — a função é binária (sim/não), não lista admins. has_role serve pra **policy/check em UI**, não pra **enumerar admins** no batch.

### Finding 4: Edge function structure exata (gap #4)

Ver [Code Examples — Edge Function esqueleto](#code-examples) acima. Pontos críticos pro planner:

1. **Sem auth check no handler.** Lenny disparar manual via curl precisa Authorization Bearer service_role no header; mas a edge function não verifica isso explicitamente (Supabase Functions exige Authorization header válido por default, e service_role passa).
2. **CORS mantido** mesmo sem necessidade pro cron — preserva flexibilidade pra curl/browser smoke manual.
3. **Adminemails resolvidos UMA vez** antes do loop (Finding 3).
4. **JSON response** `{processed, sent, failed, skipped}` — útil pra parsing futuro se Lenny quiser dashboard.
5. **Console.error em vez de toast** — edge function não tem UI; logs ficam no Supabase Dashboard > Functions > Logs.

### Finding 5: Email HTML template (gap deferido — Discretion)

Replicar estrutura de `request-access/index.ts` linhas 132-187. Diffs:
- **Subject:** `"Aniversário em 5 dias: ${nome}"`
- **Heading:** "Aniversário próximo" / "Cliente faz aniversário em 5 dias"
- **Stats grid:** Nome cliente · Data (DD/MM) · Idade que completa · Contato (se preenchido)
- **CTA único** (em vez do par Aprovar/Recusar): button verde `#16a34a` → `https://orcamentosaura.com.br/admin?tab=clientes` com label "Abrir clientes no Aura"
- **Footer admin-only:** linha extra com nome do colab dono (visível pro admin; pode ficar pros 2 destinatários porque mesmo HTML, ou condicional sem ganho real — recomendar mesmo HTML por simplicidade, conforme CONTEXT)

Snippet HTML body (substitui linhas 146-179 de request-access):

```html
<h2 style="color:#1a1a2e;margin:0 0 16px;font-size:18px;">Aniversário próximo — 5 dias</h2>
<p style="color:#6b7280;margin:0 0 24px;font-size:14px;">
  <strong>${cliente.nome}</strong> faz aniversário em <strong>${dataFormatada}</strong>${idade ? ` (completa ${idade} anos)` : ''}.
  É uma boa hora pra mandar uma mensagem.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:28px;">
  <tr><td style="padding:6px 0;">
    <span style="color:#6b7280;font-size:13px;font-weight:500;">Cliente</span><br>
    <span style="color:#111827;font-size:15px;font-weight:600;">${cliente.nome}</span>
  </td></tr>
  <tr><td style="padding:6px 0;">
    <span style="color:#6b7280;font-size:13px;font-weight:500;">Data</span><br>
    <span style="color:#111827;font-size:15px;">${dataFormatada}</span>
  </td></tr>
  ${cliente.contato ? `
    <tr><td style="padding:6px 0;">
      <span style="color:#6b7280;font-size:13px;font-weight:500;">Contato</span><br>
      <span style="color:#111827;font-size:15px;">${cliente.contato}</span>
    </td></tr>
  ` : ''}
</table>
<a href="https://orcamentosaura.com.br/admin?tab=clientes" style="display:block;text-align:center;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:8px;font-size:15px;font-weight:600;">
  Abrir clientes no Aura
</a>
```

### Finding 6: Migrations exatas (gap #5)

Ver [Code Examples — Migration #1 e Migration #2](#code-examples). Pontos pro planner:

1. **Ordem:** Migration #1 (tabela log) é safe aplicar **antes** do edge function existir — não tem dependência circular. Migration #2 (cron) tem dependência: edge function precisa estar deployed.
2. **Vault secret é manual:** A migration NÃO insere `service_role_key` (não pode estar em git). O plan precisa documentar: "Antes de aplicar migration #2, rodar `SELECT vault.create_secret(...)` via Supabase Dashboard SQL Editor com o valor real da service_role_key."
3. **Timestamp:** `20260515000001` e `20260515000002` seguem padrão `YYYYMMDDHHNNNN` com ordem inteira pra evitar conflito.
4. **RLS na tabela log:** Admin SELECT apenas (auditoria via Supabase Dashboard ou futura UI). Service role bypass RLS naturalmente.

### Finding 7: Testabilidade / smoke (gap #6)

**Smoke manual via curl (Phase 13 vai consumir):**

```bash
# 1. Inserir cliente de teste (data_nascimento = today + 5 days)
psql # ou Supabase Dashboard SQL Editor:
INSERT INTO clientes (nome, data_nascimento, user_id, contato)
SELECT
  'TESTE Aniversário',
  CURRENT_DATE + INTERVAL '5 days',
  user_id,
  '(11) 99999-9999'
FROM user_roles WHERE role = 'admin' LIMIT 1
RETURNING id;

# 2. Disparar edge function manual
curl -X POST https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"

# Esperado: {"processed":1,"sent":1,"failed":0,"skipped":0}

# 3. Verificar log
SELECT * FROM aniversario_envios
WHERE cliente_id = '<id_do_passo_1>';
# Esperado: 1 row, status='sent', destinatarios com colab_email + admin_emails

# 4. Verificar inbox Resend (Lenny + Lucas)

# 5. Reset pra re-smoke
DELETE FROM aniversario_envios WHERE cliente_id = '<id>';
# OU
DELETE FROM clientes WHERE nome = 'TESTE Aniversário';
```

**Verificação do cron real (após migration #2 + 24h):**

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'aniversario-diario')
ORDER BY start_time DESC LIMIT 5;

SELECT * FROM net._http_response
ORDER BY created DESC LIMIT 5;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cron externo (GitHub Actions, Vercel Cron) | `pg_cron` managed Supabase | 2023+ (pg_cron extension generally available) | Reduz infra, 1 lugar pra debug |
| `service_role_key` hardcoded em migrations | Vault + `vault.decrypted_secrets` | 2024 (Supabase Vault GA) | Rotação safe, sem leak em git |
| `pg_net.http_get` pra invocar edge function | `pg_net.http_post` (mesmo sem body) | desde sempre | Convenção: edge fn = POST |
| Custom retry logic em pl/pgsql | Sem retry; UNIQUE constraint + manual reprocess | (decisão Phase 12 D-09) | Simplicidade > entrega "best effort" |

**Não há nada deprecated relevante.** Toda a stack é current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pg_cron + pg_net + supabase_vault estão disponíveis (managed) no projeto `jkewlaezvrbuicmncqbj` | Finding 2 | Migration #2 falha em `CREATE EXTENSION`; mitigação: verificar via `mcp__list_extensions` ou Dashboard SQL Editor antes de aplicar. Se faltarem, é necessário habilitar via Dashboard (botão Database > Extensions) |
| A2 | `supabase.auth.admin.getUserById` está disponível no Supabase JS SDK 2.95.3 (versão usada no projeto) | Finding 3 / Code Example | Edge fn falha em runtime. Mitigação: trocar pra query direta `from('auth.users')` via service role (alguns projetos preferem) OU criar stored function `buscar_admins_emails()`. Recomenda-se confirmar com 1 chamada em dev antes |
| A3 | Domínio `orcamentosaura.com.br` está validado no Resend (request-access funcionando hoje) | Standard Stack | Email falha entrega; mitigação: confirmar `Resend Dashboard > Domains` antes de Phase 12 |
| A4 | Aniversário sempre dispara D-5 (sem casos onde colab quer D-7 ou D-3) | CONTEXT D-07 | Lenny decidiu D-5; Phase futura pode adicionar parametrização. Não é assumption arriscada — está em CONTEXT.md |
| A5 | Lenny e Lucas são os únicos admins hoje (volume de email pequeno) | Finding 3 | Se volume crescer (10+ admins), N+1 em getUserById fica lento. Aceitável por ora |

## Open Questions

1. **Vault está habilitado no projeto?**
   - Supabase Vault é managed mas precisa ser **ativado** explicitamente em alguns projetos antigos via Dashboard > Database > Vault.
   - Recomendação: verificar via Dashboard antes de Phase 12. Se não estiver ativo, ativar (1 clique).
   - Plan B se Vault for indisponível: hardcode `service_role_key` na migration via heredoc + adicionar `20260515000002_aniversario_cron_schedule.sql` ao `.gitignore` específico (não-ideal mas funciona). **Fortemente desencorajado.**

2. **`supabase.auth.admin.getUserById` vs JOIN direto:**
   - SDK function existe e funciona com service role. Mas faz N+1 (1 chamada/admin).
   - Alternativa: stored function `buscar_admins_emails()` faz JOIN único `user_roles ↔ auth.users` em SECURITY DEFINER e retorna lista.
   - **Recomendação pro planner:** stored function. Reduz round trips e fica reutilizável.

3. **Timezone interpretation:**
   - `CURRENT_DATE + INTERVAL '5 days'` no Postgres usa timezone do servidor (`UTC` na Supabase managed).
   - "Hoje" em São Paulo (UTC-3) às 06:00 BR (= 09:00 UTC) é o **mesmo dia** que UTC pensa que é. **Sem ambiguidade pro horário do cron.**
   - Edge case: cliente cadastrado às 23:00 BR de 31/12 (= 02:00 UTC de 01/01). `data_nascimento` é DATE puro (sem timezone), Postgres armazena como literal. Não há risco aqui.

4. **Volume estimado e timeout do http_post:**
   - Hoje: ~10 clientes ativos (estimativa). 1-2 aniversários/mês. Edge fn termina em < 5s.
   - `timeout_milliseconds := 60000` (60s) é folgado.
   - Se crescer pra 100+ aniversários simultâneos (improvável), considerar batching pg_net ou Promise.all.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Deno runtime (edge fn) | aniversario-clientes/index.ts | ✓ (Supabase managed) | latest | — |
| `npm:resend@2.0.0` | edge fn | ✓ (via esm imports) | 2.0.0 | — |
| `@supabase/supabase-js@2` | edge fn | ✓ (via esm.sh) | 2.x | — |
| `pg_cron` extension | migration #2 | Likely ✓ (assumption A1) | managed | Ativar via Dashboard > Database > Extensions |
| `pg_net` extension | migration #2 | Likely ✓ (assumption A1) | managed | Ativar via Dashboard |
| `supabase_vault` | migration #2 (Vault secret) | Open Q #1 | managed | Hardcode na migration (desencorajado) |
| `RESEND_API_KEY` env (Function Secret) | edge fn | ✓ (já configurado pro request-access) | — | — |
| Resend domain `orcamentosaura.com.br` validado | from address | ✓ (request-access funciona em prod) | — | — |

**Missing dependencies blocking:** Nenhum confirmado bloqueante. Assumption A1 (extensões) precisa verificação antes de aplicar migration #2.

## Validation Architecture

> `workflow.nyquist_validation` não está configurado no `.planning/config.json`. Tratando como enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (frontend) | Vitest 3.2.4 (existing, não usado nesta phase) |
| Framework (edge fn) | **None** — edge fn Deno não roda no Vitest do frontend |
| Config file | `vitest.config.ts` (frontend); Deno tests não configurados |
| Quick run command | `npm run test` (frontend, no-op pra Phase 12) |
| Full suite command | `npm run test` |
| **Smoke command (Phase 12)** | `curl -X POST https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes -H "Authorization: Bearer $SERVICE_ROLE_KEY"` |
| **SQL verification** | `SELECT * FROM aniversario_envios ORDER BY sent_at DESC LIMIT 10;` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification Command | File Exists? |
|--------|----------|-----------|----------------------|--------------|
| AUTO-01 | Colab dono recebe email D-5 | smoke manual | curl → inbox check + SELECT em aniversario_envios | N/A (smoke) |
| AUTO-02 | Admins (multi via has_role) recebem email D-5 | smoke manual | curl → inbox check Lenny + Lucas + SELECT destinatarios JSONB contém ambos | N/A (smoke) |
| (D-06) | Cliente órfão → skipped_no_owner sem email | smoke SQL | INSERT cliente com user_id de auth.user deletado → curl → SELECT status='skipped_no_owner' | N/A |
| (D-08) | 29/02 em ano não-bissexto → dispara 28/02 | smoke SQL | INSERT cliente data_nasc='1992-02-29' + manipular CURRENT_DATE via clock_timestamp mock OR aceitar como verificação manual em fev 2027 | manual |
| (D-09) | Resend falha → status='failed' | smoke manual | Inserir cliente com email inválido no auth.users (não trivial) → confirmar status=failed | manual |
| (idempotência D-02) | 2 runs no mesmo dia não duplicam envio | smoke manual | curl 2x seguidos → 2º retorna {sent:0,skipped:N} | smoke |
| (cron real) | Cron 09:00 UTC dispara automaticamente | smoke 24h | Aguardar 09:00 UTC + SELECT cron.job_run_details | manual (gate Phase 13) |

### Sampling Rate

- **Por task commit (no escopo desta phase):** N/A — sem testes automatizados Vitest. ESLint deve passar (`npm run lint`).
- **Por wave merge:** smoke curl + SELECT log table.
- **Phase gate:** todos os 7 casos da tabela acima cobertos em smoke documentado (SMOKE-RESULTS.md).

### Wave 0 Gaps

- [ ] Sem novos arquivos de teste — edge fn Deno fica fora do harness Vitest existente.
- [ ] Documentar comandos curl + SQL de smoke em `SMOKE-RESULTS.md` na finalização da phase.
- [ ] Stored function `buscar_aniversariantes_d5()` é manualmente testável via SQL Editor (sem unit test, mas verificável).

**Justificativa para manual-only:** Edge functions Deno do AURA não têm suite de testes (padrão histórico do projeto — request-access, create-colaborador, import-produtos, validar-sistema-orcamento, etc. são todos manual). Phase 12 segue convenção. Investimento em Deno testing infra seria scope creep.

## Security Domain

> `security_enforcement` não está configurado no `.planning/config.json` — tratando como enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Edge fn validada via service_role bearer no header (Supabase Functions default behavior) |
| V3 Session Management | no | Cron + edge fn não têm sessão de usuário |
| V4 Access Control | yes | Tabela `aniversario_envios` com RLS admin-only SELECT; service role bypass pra escrita |
| V5 Input Validation | partial | Edge fn não recebe body (cron passa vazio); curl manual também pode passar `{}` — sem input pra validar |
| V6 Cryptography | yes | service_role_key armazenada no Vault (`vault.decrypted_secrets`) em vez de plain-text |
| V9 Communication | yes | HTTPS obrigatório (pg_net + Supabase domain); TLS 1.2+ default |
| V10 Malicious Code | n/a | Nenhuma dependência nova além de Resend SDK (já usado) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service role key leak via migration commitada em git | Information Disclosure | Vault.create_secret rodado fora do git (Dashboard SQL Editor manual) |
| Unauthorized invocation do edge function por terceiros | Spoofing / EOP | Authorization header com Bearer service_role obrigatório (Supabase default) |
| Email spam: cron disparar 2x no mesmo dia | Repudiation / Cliente recebe duplicado | UNIQUE(cliente_id, ano_referencia) bloqueia INSERT — idempotência atomic |
| Cliente sem email recebe email vazio | Information Disclosure | D-06: skipped_no_owner sem envio; valida email não vazio antes de Resend |
| Admin removido recebe email após remoção | Confidentiality | `has_role` é fonte canônica em runtime — admins removidos não aparecem na próxima execução |
| Resend API rate limit / 429 | DoS | D-09: falha registrada em log, sem retry; volume real é baixíssimo (1-2 aniversários/mês) |

## Sources

### Primary (HIGH confidence)

- [Codebase grep] `supabase/migrations/20260218165401_*.sql` lines 13-26 — assinatura exata `has_role(uuid, app_role) RETURNS boolean`
- [Codebase grep] `supabase/migrations/20260511000001_arquitetos_clientes_user_id.sql` — confirma `clientes.user_id NOT NULL ON DELETE RESTRICT`
- [Codebase grep] `supabase/migrations/20260511000002_clientes_data_nascimento.sql` — confirma `clientes.data_nascimento DATE NULL` + index BTREE
- [Codebase] `supabase/functions/request-access/index.ts` — pattern Resend + Deno + HTML template (replicação direta)
- [Supabase official docs] [Cron Quickstart](https://supabase.com/docs/guides/cron/quickstart) — `cron.schedule` sintaxe + Vault pattern
- [Supabase official docs] [Schedule Functions](https://supabase.com/docs/guides/functions/schedule-functions) — `net.http_post` com headers jsonb + Authorization
- [Supabase official docs] [pg_net Extension](https://supabase.com/docs/guides/database/extensions/pg_net) — `net._http_response` table + async behavior

### Secondary (MEDIUM confidence)

- [Supabase Discussions] [Issue #4287 - Recommended Pattern for pg_cron to Edge Function Auth](https://github.com/supabase/cli/issues/4287) — Vault como padrão recomendado
- [Medium - Samuel Mpwanyi] [Cron Jobs with Edge Functions](https://medium.com/@samuelmpwanyi/how-to-set-up-cron-jobs-with-supabase-edge-functions-using-pg-cron-a0689da81362) — exemplo prático verificado contra docs oficiais
- [DEV.to - kanta13jp1] [pg_cron Complete Guide](https://dev.to/kanta13jp1/supabase-pgcron-complete-guide-automate-scheduled-jobs-in-postgresql-5dih) — `cron.alter_job`, `cron.unschedule` syntax

### Tertiary (LOW confidence — flagged)

- [PostgreSQL community thread] Leap year birthday queries — cross-validated com lógica manual; sem ferramenta autoritativa única

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Resend + Supabase patterns são replicação direta do que já está em prod (request-access)
- Architecture (pg_cron + Vault): HIGH — docs oficiais Supabase + 4 fontes terceiras concordando
- Pitfalls: HIGH — pitfalls 1-3 vêm de lógica matemática direta (timezone, leap year, ano_referencia); 4-6 vêm de inspeção do código existente
- has_role signature: HIGH — verified em grep direto do codebase
- Vault disponibilidade em prod: MEDIUM — assumption A1; verificação ao plan execution time

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (Supabase pg_cron/pg_net são estáveis; única coisa que pode mudar é Resend API)

## RESEARCH COMPLETE
