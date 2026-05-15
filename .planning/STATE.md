---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: "**Goal**: Base de dados pronta para receber multi-tenancy, edição de wizard, descrição rica e automação — todas as migrations aditivas aplicadas em produção sem quebrar nada existente"
status: executing
last_updated: "2026-05-15T02:55:00.000Z"
last_activity: 2026-05-15
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 27
  completed_plans: 20
  percent: 74
---

# STATE: AURA

**Last updated:** 2026-05-15 — Phase 12 Plan 03 complete (Vault secret criado + migration cron aplicada + smoke E2E PASS — Phase 12 entregue end-to-end, ready for Phase 13 UAT closure)

## Project Reference

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** v1.1 — Polimento UAT + Multi-tenancy + Automação
- **Mode:** yolo
- **Granularity:** coarse
- **Current Focus:** Phase 12 — automa-o-anivers-rio

## Current Position

Phase: 12 (automa-o-anivers-rio) — COMPLETE (3/3 plans)
Next: Phase 13 (Smoke & UAT Closure) — ou Phase 9 (Multi-tenancy RLS) em paralelo

- **Phase:** 12 COMPLETE (Wave 1 schema + Wave 2 edge fn + Wave 3 cron — chain E2E live em prod)
- **Plan:** 12-03 COMPLETE (Vault secret criado, migration aplicada, cron `aniversario-diario` ativo @ 09:00 UTC, smoke pós-deploy status_code=200)
- **Status:** Phase 12 entregue — pronto para `verify_phase_goal` (Phase 13 closure)
- **Progress:** 5/7 phases completas · 20/27 plans
- **Last activity:** 2026-05-15

## Roadmap v1.1 (resumo)

| Phase | Tema | Reqs | Depends on |
|-------|------|------|------------|
| 7 | Schema & Prep | RLS-03, AUTO-03 | — |
| 8 | Cadastros (FORM) | FORM-01..04 | 7 |
| 9 | Multi-tenancy RLS | RLS-01, RLS-02 | 7 |
| 10 | Wizard edição | WIZ-01..05 | 7 |
| 11 | PDF + Dashboard | PDF-01, PDF-02, DASH-01 | 10 |
| 12 | Automação aniversário | AUTO-01, AUTO-02 | 7, 9 |
| 13 | Smoke & Closure | (closure) | 8, 9, 10, 11, 12 |

## Latest Milestone Shipped

**v1.0 — Melhorias v1** (2026-04-23 → 2026-05-07, 15 dias)

- 6 phases, 28 plans, 163 commits
- 40/42 requirements entregues + 1 obsoleto + 1 deferido
- Smoke prod 8/8 passed (2026-05-07)
- Archive: `.planning/milestones/v1.0-ROADMAP.md` + `v1.0-REQUIREMENTS.md`

## Accumulated Context

### Decisions carryover (v1.0 → v1.1)

- Schema sempre aditivo (perpetual) — confirmado v1.0 (9 migrations, zero regressão)
- Drive RLS via `user_id` direto (D-02 errata) — padrão a replicar em `arquitetos` e `clientes` na Phase 9
- PDF v1/v2 router (`pdf_template_version`) — ajustes da Phase 11 ficam no template v2 apenas; v1 não pode regredir
- ImportMaster XLSX (2.088 SKUs oficiais) é fonte da verdade pra descrição rica — Phase 7 verifica gaps antes de planar WIZ-05

### Todos

- [ ] Phase 7 plan #1: auditar `product_variants` vs ImportMaster XLSX pra confirmar quais campos de descrição rica já existem

### Blockers

- (nenhum)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260511-cwq | Fix request-access HTTP status: retornar 200 nos casos pending/approved (frontend cai em res.error e mostra toast genérico) | 2026-05-11 | 16c0b14 | [260511-cwq-fix-request-access-http-status-retornar-](./quick/260511-cwq-fix-request-access-http-status-retornar-/) |

## Next Action

`/gsd-verify-phase 12` (ou `/gsd-plan-phase 13` para iniciar UAT closure). Phase 12 entregue end-to-end:
- Wave 1: tabela `aniversario_envios` + stored fns `buscar_aniversariantes_d5` + `buscar_admins_emails` em prod
- Wave 2: edge fn `aniversario-clientes` deployed via MCP, smoke 2-run E2E PASS
- Wave 3: Vault secret `service_role_key` criado, migration `20260515000002_aniversario_cron_schedule` aplicada, cron `aniversario-diario` ativo @ 09:00 UTC, smoke pós-deploy status_code=200 + content JSON `{"processed":0,...}`

**Próxima execução real do cron:** 2026-05-15 09:00 UTC = 06:00 BRT.

**Atenção:** Phase 7 deixou `user_id NOT NULL` sem `DEFAULT auth.uid()`. Hotfix `71d28d7` (08-05) injeta user_id no payload do dialog. Avaliar se Phase 9 (que vai adicionar policy `WITH CHECK (user_id = auth.uid())`) torna isso redundante OU se vale adicionar `DEFAULT auth.uid()` na coluna como cinto-e-suspensórios.

### Phase 12 — Decisões carryover (Plan 12-01 + 12-02 + 12-03)

- **Stored fns vs JOIN inline (12-01):** `buscar_aniversariantes_d5()` + `buscar_admins_emails()` SECURITY DEFINER pra evitar N+1 e desacoplar schema da edge fn
- **UNIQUE(cliente_id, ano_referencia) = idempotência atomic (12-01):** edge fn trata PG 23505 como "já enviado nesse ano" — mas na prática stored fn já filtra antes (better-than-spec confirmado em 12-02)
- **LEFT JOIN auth.users (12-01):** cliente órfão (D-06) retorna `colab_email=NULL` → edge fn registra `status='skipped_no_owner'`
- **Edge case 29/02 (12-01):** já tratado no SQL — dispara em 28/02 em ano não-bissexto
- **REVOKE EXECUTE pattern (12-01):** authenticated não chama as fns; só service role via RPC
- **target-based ano_referencia (12-02):** edge fn calcula ano a partir de today+5d (não today) — corrige Pitfall 3 cross-year
- **INSERT optimistic 'sent' + UPDATE 'failed' (12-02):** mantém row única por (cliente, ano), preserva auditoria mesmo em falha de Resend
- **Multi-admin dinâmico via RPC (12-02):** substitui hardcode ADMIN_EMAIL legacy do request-access; suporta N admins sem redeploy
- **Pattern Deno + Resend (12-02):** edge fn replica request-access (imports esm.sh + npm:, createClient com SERVICE_ROLE, OPTIONS+CORS, from `noreply@orcamentosaura.com.br`) — pattern já validado em prod
- **Vault subquery em RUNTIME (12-03):** cron command lê `decrypted_secret` a cada disparo (não em schedule-time) — rotação propaga sem redeploy
- **DO $$ BEGIN ... END $$ defensive cleanup (12-03):** `cron.unschedule` retorna void, não funciona em WHERE — bloco anônimo PL/pgSQL é o padrão
- **timeout_milliseconds=60000 (12-03):** 60s folgado pro volume atual; reduzir pra 10s no futuro se quiser fail-fast
- **Schedule literal `'0 9 * * *'` (12-03):** 09:00 UTC = 06:00 BR direto, sem timezone math em SQL

### Phase 12 — Follow-ups separados (NÃO bloqueiam Wave 3)

- [ ] Auditoria SPF/DKIM/DMARC do domínio `orcamentosaura.com.br` — email caiu em Junk no Outlook do Lenny no smoke 12-02 (Resend entregou; Outlook classificou). Issue de infra de email, não da edge fn.
- [ ] Dedup do `toList` na edge fn: `Array.from(new Set([colab_email, ...admin_emails]))` — owner=admin causa duplicação no campo Para. Fix trivial (1 linha) pra próxima iteração.

## Session Continuity

- ROADMAP.md: 7 phases (7-13), 18 reqs mapeados, coverage 100%
- REQUIREMENTS.md: traceability preenchido (todos REQ-ID com Phase atribuída) — AUTO-01/AUTO-02 ficam parcialmente atendidos (schema + edge fn OK; entrega final só com cron Wave 3)
- MILESTONES.md: índice ainda só com v1.0 — atualizar na Phase 13 (closure)

**Last activity:** 2026-05-15 — Plan 12-03 fechado (Vault secret `service_role_key` criado em prod via MCP execute_sql, migration `20260515000002_aniversario_cron_schedule` aplicada via MCP apply_migration, cron `aniversario-diario` ativo `0 9 * * *`, smoke E2E `net._http_response.status_code=200` + content JSON. Phase 12 entregue end-to-end).

---
*STATE refreshed: 2026-05-15 ao fechar Plan 12-03 (commit e03dd4c do SQL migration + docs commit final do plano).*
