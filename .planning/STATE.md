---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: "**Goal**: Corrigir o subsistema fita/perfil/driver/módulos/magneto do wizard (UAT 19 comentários, 2026-06-10) sem quebrar luminária comum nem orçamentos antigos"
status: defining_requirements
last_updated: "2026-06-10T00:00:00.000Z"
last_activity: 2026-06-10
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# STATE: AURA

**Last updated:** 2026-06-10 — Milestone v1.2 iniciado (Correções UAT do Wizard de Sistemas de Iluminação). Definindo requisitos a partir dos 19 comentários dos funcionários (com prints). Roadmap continua no phase 14.

## Project Reference

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** v1.2 — Correções UAT do Wizard de Sistemas de Iluminação (iniciado 2026-06-10)
- **Mode:** yolo
- **Granularity:** coarse
- **Current Focus:** Definindo requisitos do v1.2 a partir dos 19 comentários dos funcionários (UAT com prints).

## Current Position

Phase: Not started (definindo requisitos)
Plan: —
Status: Defining requirements
Last activity: 2026-06-10 — Milestone v1.2 iniciado (continua no phase 14)

## Roadmap v1.1 (resumo final)

| Phase | Tema | Reqs | Status |
|-------|------|------|--------|
| 7 | Schema & Prep | RLS-03, AUTO-03 | Complete (2026-05-11) |
| 8 | Cadastros (FORM) | FORM-01..04 | Complete (2026-05-14) |
| 9 | Multi-tenancy RLS | RLS-01, RLS-02 | Complete (2026-05-15) |
| 10 | Wizard edição | WIZ-01..05 | Complete (2026-05-14) |
| 11 | PDF + Dashboard | PDF-01, PDF-02, DASH-01 | Complete (2026-05-15) |
| 12 | Automação aniversário | AUTO-01, AUTO-02 | Complete (2026-05-15) |
| 13 | Smoke & Closure | (closure) | Complete (2026-05-15) |

## Latest Milestone Shipped

**v1.1 — Polimento UAT + Multi-tenancy + Automação** (2026-05-11 → 2026-05-15, 5 dias)

- 7 phases, 29 plans, 96 commits
- 17/18 DELIVERED + 1 DELIVERED with deviation (AUTO-02 — multi-admin via `has_role(admin)`) = 18/18 covered
- 11 migrations aditivas (zero destrutivas)
- 1 nova edge function: `aniversario-clientes` (Deno + Resend, cron-triggered)
- Extensions habilitadas: pg_cron 1.6.4 + pg_net 0.20.0
- Smoke prod 4/4 cenários integration PASS (Phase 13)
- BUG-13-01 capturado e fixed inline (`b3ae4db`) durante smoke
- Archive: `.planning/milestones/v1.1-ROADMAP.md` + `v1.1-REQUIREMENTS.md` + `MILESTONES.md`

**Previous milestone:** v1.0 — Melhorias v1 (2026-04-23 → 2026-05-07, 15 dias, 28 plans, 163 commits, 40/42 entregues + 1 obsoleto + 1 deferido). Archive em [milestones/MILESTONES.md](milestones/MILESTONES.md).

## Accumulated Context

### Decisions carryover (v1.0 → v1.1 → v1.2+)

- **Schema sempre aditivo (perpetual)** — confirmado v1.0 (9 migrations) + v1.1 (11 migrations, zero regressão)
- **Drive RLS via `user_id` direto (D-02 errata)** — replicado em `arquitetos` + `clientes` na Phase 9 com sucesso (zero-code-change no client, preflight 11 callsites = 0 Risk)
- **PDF v1/v2 router (`pdf_template_version`)** — ajustes da Phase 11 ficam no template v2 apenas; v1 não pode regredir
- **ImportMaster XLSX (2.088 SKUs oficiais)** é fonte da verdade pra descrição rica (WIZ-05 Phase 10: builder `construirDescricaoRica` com fallback ao snapshot puro pra produtos removidos do master)
- **Phase 9 zero-code-change no client** — auditoria dos 11 callsites em `arquitetos`/`clientes` classifica todos como OK natural/admin-only. RLS + DEFAULT `auth.uid()` cobre 100% sem mexer em frontend.
- **Phase 12 multi-admin dinâmico via `has_role(admin)` (D-22)** — substitui hardcode "David Grabarz" do AUTO-02. RPC `buscar_admins_emails()` SECURITY DEFINER escala pra N admins sem redeploy. Pattern também usado pra substituir `ADMIN_EMAIL` legacy do `request-access`.
- **Vault subquery em RUNTIME (Phase 12-03)** — cron command lê `decrypted_secret` a cada disparo (não em schedule-time) — rotação propaga sem redeploy.
- **UNIQUE(cliente_id, ano_referencia) = idempotência atomic (Phase 12-01)** — edge fn trata PG 23505 como "já enviado nesse ano".

### Todos

- (nenhum — marco fechado)

### Blockers

- (nenhum)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260511-cwq | Fix request-access HTTP status: retornar 200 nos casos pending/approved (frontend cai em res.error e mostra toast genérico) | 2026-05-11 | 16c0b14 | [260511-cwq-fix-request-access-http-status-retornar-](./quick/260511-cwq-fix-request-access-http-status-retornar-/) |

## Next Action

**Definir próximo marco** via `/gsd-new-milestone` ou pausar até Lenny escolher foco.

**Candidatos provisórios para v1.2+** (do PROJECT.md + follow-ups deferidos do v1.1):

- **Preços via CSV** (IMP-02 deferido v1.0) + tabela de custos (desbloqueia margem)
- **Margem no pedido** — agregada por arquiteto/colaborador/período
- **Documentação + testes das fórmulas de cálculo** (fita/driver/perfil/agrupamento)
- **Follow-ups técnicos v1.1:**
  - SPF/DKIM/DMARC do domínio `orcamentosaura.com.br` (email Junk em Outlook)
  - WR-02 pg_net 4xx/5xx monitoring/alerts pro cron aniversário
  - Dedup `toList` na edge fn aniversário (owner=admin)
  - Bucket singular `produto-imagens` cleanup + `has_role(admin)` gate explícito em edge fn

### Phase 12 — Decisões carryover (preservadas para futuras referências de automação)

- **Stored fns vs JOIN inline (12-01):** `buscar_aniversariantes_d5()` + `buscar_admins_emails()` SECURITY DEFINER pra evitar N+1 e desacoplar schema da edge fn
- **UNIQUE(cliente_id, ano_referencia) = idempotência atomic (12-01):** edge fn trata PG 23505 como "já enviado nesse ano"
- **LEFT JOIN auth.users (12-01):** cliente órfão (D-06) retorna `colab_email=NULL` → edge fn registra `status='skipped_no_owner'`
- **Edge case 29/02 (12-01):** já tratado no SQL — dispara em 28/02 em ano não-bissexto
- **REVOKE EXECUTE pattern (12-01):** authenticated não chama as fns; só service role via RPC
- **target-based ano_referencia (12-02):** edge fn calcula ano a partir de today+5d (não today) — corrige Pitfall 3 cross-year
- **INSERT optimistic 'sent' + UPDATE 'failed' (12-02):** mantém row única por (cliente, ano), preserva auditoria mesmo em falha de Resend
- **Multi-admin dinâmico via RPC (12-02):** substitui hardcode ADMIN_EMAIL legacy do request-access; suporta N admins sem redeploy
- **Pattern Deno + Resend (12-02):** edge fn replica request-access (imports esm.sh + npm:, createClient com SERVICE_ROLE, OPTIONS+CORS, from `noreply@orcamentosaura.com.br`)
- **Vault subquery em RUNTIME (12-03):** cron command lê `decrypted_secret` a cada disparo
- **DO $$ BEGIN ... END $$ defensive cleanup (12-03):** `cron.unschedule` retorna void, bloco anônimo PL/pgSQL é o padrão
- **timeout_milliseconds=60000 (12-03):** 60s folgado pro volume atual
- **Schedule literal `'0 9 * * *'` (12-03):** 09:00 UTC = 06:00 BR direto, sem timezone math em SQL

### Phase 12 — Follow-ups deferidos pra v1.2+

- [ ] Auditoria SPF/DKIM/DMARC do domínio `orcamentosaura.com.br` — email caiu em Junk no Outlook do Lenny no smoke 12-02
- [ ] Dedup do `toList` na edge fn: `Array.from(new Set([colab_email, ...admin_emails]))` — owner=admin causa duplicação no campo Para
- [ ] WR-02 pg_net 4xx/5xx monitoring/alerts pro cron aniversário

## Session Continuity

- **ROADMAP.md:** Phase 13 marcada [x], nota "v1.1 archived 2026-05-15" no topo, Shipped Milestones atualizado com entry v1.1
- **REQUIREMENTS.md:** 18 REQs marcados [x] (AUTO-02 com flag `[~]` deviation), Traceability com coluna Status, marco fechado no header
- **MILESTONES.md:** criado com entries v1.0 + v1.1, stats acumulados, "Next milestone" com candidatos v1.2+
- **PROJECT.md:** Current Milestone agora "Nenhum marco ativo", section "Validated Requirements (v1.1)" adicionada
- **Archives criados:** `.planning/milestones/v1.1-ROADMAP.md` + `v1.1-REQUIREMENTS.md`

**Last activity:** 2026-05-15 — Phase 13 Plan 02 (archive) completo. Marco v1.1 oficialmente fechado.

---
*STATE refreshed: 2026-05-15 — milestone v1.1 archived (17 DELIVERED + 1 DELIVERED with deviation = 18/18 covered). Próxima ação: `/gsd-new-milestone` para definir foco v1.2+.*
