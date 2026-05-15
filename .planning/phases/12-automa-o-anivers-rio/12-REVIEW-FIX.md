---
phase: 12-automa-o-anivers-rio
fixed_at: 2026-05-15T00:00:00Z
review_path: .planning/phases/12-automa-o-anivers-rio/12-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-05-15
**Source review:** `.planning/phases/12-automa-o-anivers-rio/12-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 5
- Fixed: 4
- Deferred: 1
- Skipped: 0

## Fixed Issues

### WR-05: `colab_email` checado só por trim, não por formato de email

**Files modified:** `supabase/functions/aniversario-clientes/index.ts`
**Commit:** `8eacd24`
**Applied fix:** Adicionado helper `isValidEmail(e)` no topo do arquivo usando regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Substituído o filter de `adminEmails` (linha 80) e o check de `cliente.colab_email` (linha 99) por chamadas a `isValidEmail`. Mensagem do `error_msg` no INSERT `skipped_no_owner` atualizada para refletir "nulo, vazio ou malformado".

### WR-01: Duplicação de email quando colab é admin

**Files modified:** `supabase/functions/aniversario-clientes/index.ts`
**Commit:** `21a97b7`
**Applied fix:** Criada `adminEmailsDedup = adminEmails.filter((e) => e !== cliente.colab_email)` por iteração. Usado tanto no `destinatarios.admin_emails` do log (linha 121) quanto no `toList` do Resend (linha 151), garantindo log fiel ao que foi de fato enviado.

### WR-04: `data_nascimento` parseado como `new Date(string)` — ambiguidade UTC

**Files modified:** `supabase/functions/aniversario-clientes/index.ts`
**Commit:** `4a0b7bd`
**Applied fix:** Removido `new Date(cliente.data_nascimento)` e os `getUTC*`. Agora `data_nascimento` é parseado manualmente via `split("-")` em `yyyy/mm/dd` numéricos. `dataFormatada` e `idadeQueCompleta` derivam diretamente desses valores. Elimina dependência do shape interno de `Date`.

### WR-03: `UPDATE status='failed'` pode silenciosamente falhar

**Files modified:** `supabase/functions/aniversario-clientes/index.ts`
**Commit:** `5bc585c`
**Applied fix:** Destructure `{ error: updateErr }` do `UPDATE aniversario_envios SET status='failed'`. Se `updateErr` existir, loga via `console.error("[failed-update <cliente.id>] log=<logId> <msg>")` — admin consegue rastrear via logs do Supabase quando um log ficou eternamente como `sent` mesmo após falha do Resend.

## Deferred Issues

### WR-02: pg_net não detecta falha HTTP — cron silencioso em 4xx/5xx

**File:** `supabase/migrations/20260515000002_aniversario_cron_schedule.sql:32-43`
**Decision:** `deferred`
**Reason:** O próprio REVIEW.md classifica como trade-off aceito para v1: "Para v1, aceitar trade-off já documentado". A migration do cron já documenta a limitação em comentário (linhas 6–11). A fix proposta (segundo cron 5min depois inserindo em `cron_alerts`) requer:
1. Nova tabela `cron_alerts` (mudança de schema não-trivial)
2. Novo `cron.schedule` (mudança aditiva, mas escopo de v1.1)
3. Decisão de produto sobre roteamento de alerta (email? Slack? só log?)

Mitigação imediata: smoke manual via curl (Phase 13) + admin checa `net._http_response` na primeira semana após deploy. Será reagendado para o backlog v1.1 junto com outras melhorias de observabilidade (referência no MEMORY: `project_aura_v11_backlog`).

**Original issue:** `net.http_post` é assíncrono, retorna `request_id` imediatamente e não falha em HTTP 4xx/5xx. Se a edge function retornar 500 (Resend API key inválida, DB down) ou 404 (edge fn não deployed), o cron marca success e nada é logado.

---

_Fixed: 2026-05-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
