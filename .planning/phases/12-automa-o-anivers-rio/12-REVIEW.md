---
phase: 12-automa-o-anivers-rio
reviewed: 2026-05-14T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - supabase/migrations/20260515000001_aniversario_envios_table.sql
  - supabase/functions/aniversario-clientes/index.ts
  - supabase/migrations/20260515000002_aniversario_cron_schedule.sql
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Revisão da automação diária de aniversário (D-5): migration SQL (tabela log + stored fns SECURITY DEFINER + RLS), edge function Deno (Resend batch) e cron schedule via `pg_cron`/`pg_net` lendo `service_role_key` do Vault.

Boa notícia: não há issues **críticos**. SQL injection não é exposto porque os stored fns não recebem parâmetros e não usam `EXECUTE` dinâmico; RLS está correto (admin-only SELECT, escrita via service_role bypass); secret do Vault não vaza no body do request (`pg_net.http_post` não loga o header `Authorization` em texto plano nas tabelas `net._http_response`).

Pontos de atenção que valem a pena endereçar antes do smoke em produção (Wave 4):

1. **Deduplicação do `to` no Resend** — quando o colab é admin (ex: Lenny), `colab_email` cai duas vezes na lista `toList`. Resend aceita, mas o destinatário recebe duplicado (ou Resend silenciosamente dedupe — comportamento não-documentado). Conforme `<config>` flagged como known issue.
2. **Edge case 29/02** — a lógica do stored fn dispara em 28/02 de anos não-bissextos, **mas também dispara em 28/02 de anos bissextos** (porque o check `EXTRACT(MONTH FROM t.d + 1 day) = 3` só confirma "não-bissexto" se 28/02 + 1 dia salta para março, o que **só é verdadeiro em anos não-bissextos**) — então a lógica está correta. Falso alarme; mantido como Info para registro.
3. **pg_net não falha em HTTP 4xx/5xx** — a migration do cron já documenta isso em comentário (linhas 6–11). Não há monitoramento ativo de `net._http_response`. Aceito como trade-off pra v1 (smoke manual via curl cobre).
4. **Race condition** — `pg_cron` não roda concorrente o mesmo job, então paralelismo só aconteceria com chamada manual + cron sobrepostos. UNIQUE constraint cobre via `23505`.
5. **Timezone DST Brasil** — Brasil aboliu horário de verão em 2019, então `09:00 UTC = 06:00 BRT` é estável. Sem risco de drift.

## Warnings

### WR-01: Duplicação de email quando colab é admin

**File:** `supabase/functions/aniversario-clientes/index.ts:142`
**Issue:** `toList = [cliente.colab_email, ...adminEmails]` não deduplica. Se o colab dono do cliente é admin (caso real: Lenny no AURA prod), o email dele aparece **duas vezes** no campo `to` do Resend. Comportamento depende de como o Resend trata duplicates — pode entregar 2 cópias, dedupe silenciosamente, ou retornar erro. Não está documentado.
**Fix:**
```typescript
// Deduplicar via Set, preservando colab_email em primeiro (destinatário primário)
const toList = Array.from(new Set([cliente.colab_email, ...adminEmails]));
```
Aplicar o mesmo dedup também em `destinatarios.admin_emails` no INSERT (linhas 100, 113) pra que o log fique fiel ao que de fato foi enviado.

### WR-02: pg_net não detecta falha HTTP — cron silencioso em 4xx/5xx

**File:** `supabase/migrations/20260515000002_aniversario_cron_schedule.sql:32-43`
**Issue:** `net.http_post` é assíncrono e retorna `request_id` imediatamente; **não falha em HTTP 4xx/5xx**. Se a edge function retornar 500 (ex: Resend API key inválida, DB down) ou 404 (edge fn não deployed), o cron vai marcar success e nada é logado. O comentário no topo do arquivo (linhas 6–11) reconhece o risco, mas **não há mitigação** — nenhum monitoramento de `net._http_response`, nenhum alerta.
**Fix:** Para v1, aceitar trade-off já documentado. Para v1.1, considerar:
```sql
-- Segundo cron 5min depois confere o response do primeiro
SELECT cron.schedule('aniversario-diario-check', '5 9 * * *', $$
  INSERT INTO public.cron_alerts(job, status_code, error_msg, checked_at)
  SELECT 'aniversario-diario', status_code, error_msg, now()
  FROM net._http_response
  WHERE created > now() - interval '10 minutes'
    AND (status_code >= 400 OR status_code IS NULL);
$$);
```
Mínimo aceitável para v1: registrar no `.planning/STATE.md` que admin deve checar `net._http_response` manualmente na semana de smoke.

### WR-03: `UPDATE status='failed'` pode silenciosamente falhar

**File:** `supabase/functions/aniversario-clientes/index.ts:170-173`
**Issue:** Quando Resend lança, o código faz `UPDATE aniversario_envios SET status='failed' WHERE id=logId` mas não checa o `error` retornado. Se o UPDATE falhar (DB indisponível, conexão derrubada, RLS — improvável com service_role mas possível), o log fica eternamente como `'sent'` mesmo o email não tendo ido, e o admin não terá como saber via auditoria.
**Fix:**
```typescript
const { error: updateErr } = await supabase
  .from("aniversario_envios")
  .update({ status: "failed", error_msg: msg })
  .eq("id", logId);
if (updateErr) {
  console.error(`[failed-update ${cliente.id}] ${updateErr.message}`);
}
failed++;
```

### WR-04: `data_nascimento` parseado como `new Date(string)` — ambiguidade UTC

**File:** `supabase/functions/aniversario-clientes/index.ts:143-147`
**Issue:** `new Date("2000-04-15")` (string ISO date-only) é parseado como **midnight UTC** em V8/Deno. `dataAniv.getUTCDate()` então retorna 15 (correto). Mas se algum dia o Postgres devolver `data_nascimento` com timezone diferente (ex: `'2000-04-15T00:00:00-03:00'`), `getUTCDate()` retornaria 14 — dia errado no email. Postgres `DATE` não tem timezone, então hoje é estável, mas é frágil.
**Fix:** Parsear manualmente para garantir:
```typescript
const [yyyy, mm, dd] = cliente.data_nascimento.split("-").map(Number);
const dataFormatada = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}`;
const idadeQueCompleta = anoReferencia - yyyy;
```
Elimina dependência de `Date` parsing e o uso de `getUTC*`.

### WR-05: `colab_email` checado só por trim, não por formato de email

**File:** `supabase/functions/aniversario-clientes/index.ts:94`
**Issue:** Se `auth.users.email` tiver um valor lixo (ex: `"x"`, espaços, string sem `@`), o código segue adiante e tenta enviar pra Resend, que retorna erro de validação. Marca como `failed` desnecessariamente — deveria ser `skipped_no_owner`.
**Fix:**
```typescript
const isValidEmail = (e: string | null) =>
  !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

if (!isValidEmail(cliente.colab_email)) {
  // ...insert skipped_no_owner
}
```
Validar também `adminEmails` no filter da linha 76 com a mesma função.

## Info

### IN-01: `EXTRACT(YEAR FROM target.d)` recalculado dentro do WITH

**File:** `supabase/migrations/20260515000001_aniversario_envios_table.sql:66`
**Issue:** Subquery `(SELECT d FROM target)` é executada dentro do `EXTRACT` no CTE `ja_notificados`. Postgres geralmente inline isso, mas seria mais explícito reusar via JOIN.
**Fix:** Aceitável como está; otimização não-necessária.

### IN-02: Lógica do edge case 29/02 — validar com teste manual

**File:** `supabase/migrations/20260515000001_aniversario_envios_table.sql:86-90`
**Issue:** A condição `EXTRACT(MONTH FROM (t.d + INTERVAL '1 day')) = 3` confirma que `t.d` é 28/02 de **não-bissexto** (porque 28/02 + 1 dia = 1/3 só em ano não-bissexto). Lógica correta. Não há bug — mas seria bom ter um teste SQL no Phase 12 SMOKE rodando contra `2027-02-23` (target=2027-02-28 não-bissexto) e `2028-02-23` (target=2028-02-28 bissexto) pra confirmar comportamento.
**Fix:** Adicionar à smoke checklist:
```sql
-- Smoke 29/02
INSERT INTO clientes(nome, data_nascimento, user_id)
  VALUES ('Teste Bissexto', '2000-02-29', '<colab_id>');
SELECT current_date, * FROM buscar_aniversariantes_d5();
-- Esperado: dispara em 23/02 de anos não-bissextos (target=28/02), não dispara em 23/02 bissextos (porque 29/02 será target real)
```

### IN-03: HTML do email — vulnerabilidade XSS interna (baixo risco)

**File:** `supabase/functions/aniversario-clientes/index.ts:213-258`
**Issue:** `${nome}` e `${contato}` são interpolados direto no HTML sem escape. Se um cliente cadastrar nome como `<script>alert(1)</script>` ou `"><img src=x onerror=...>`, o HTML renderiza isso. Caixa de email moderna (Gmail, Outlook) já sanitiza `<script>`, mas pode quebrar layout via tags HTML. Risco real é mínimo porque o destinatário é interno (colab/admin), não cliente externo.
**Fix:**
```typescript
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// usar escapeHtml(nome), escapeHtml(contato) no template
```

### IN-04: `result.error` do Resend não cobre todas as falhas

**File:** `supabase/functions/aniversario-clientes/index.ts:150-164`
**Issue:** Resend SDK v2 retorna `{ data, error }` shape. Atualmente o código checa `result.error` mas não checa se `result.data?.id` existe. Em teoria, ambos podem ser undefined (network parcial). Aceitável — `try/catch` cobre, mas log de sucesso não tem o `message_id` do Resend pra audit.
**Fix (opcional v1.1):**
```typescript
if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
if (!result.data?.id) throw new Error("Resend retornou sem message_id");
// Salvar result.data.id em coluna nova: resend_message_id
```

### IN-05: `error_msg` truncamento — risco de overflow se stack trace gigante

**File:** `supabase/functions/aniversario-clientes/index.ts:167-172`
**Issue:** `error_msg` é `TEXT` (sem limite) então não há overflow físico, mas erros do Resend podem trazer stack traces gigantes ou payloads JSON com PII. Salvar tudo é OK pra debug, só ficar atento.
**Fix:** Opcional — truncar a 2KB:
```typescript
const msg = (err instanceof Error ? err.message : String(err)).slice(0, 2048);
```

### IN-06: Cleanup defensivo do cron — sem `EXCEPTION WHEN`

**File:** `supabase/migrations/20260515000002_aniversario_cron_schedule.sql:19-25`
**Issue:** O `DO $$ ... IF EXISTS ... PERFORM cron.unschedule(...) ... $$` é defensivo correto. Não há issue real — bloco `EXISTS` previne o erro de "job not found". Já está idempotente.
**Fix:** Nenhum. Padrão correto.

---

_Reviewed: 2026-05-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
