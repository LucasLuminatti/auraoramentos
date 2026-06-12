---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: milestone
status: milestone_complete
stopped_at: v1.2 archived
last_updated: "2026-06-12T14:59:32.179Z"
last_activity: 2026-06-12
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# STATE: AURA

**Last updated:** 2026-06-12 — Milestone v1.2 fechado e arquivado (Phases 14-18, 18/18 requirements). Audit `tech_debt` com débito aceito. Próximo: planejar v1.3.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-12)

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** nenhum ativo — v1.2 shipped
- **Current Focus:** Planejar próximo marco (v1.3 candidato — Sistemas Compostos) via `/gsd-new-milestone`
- **Mode:** yolo

## Latest Milestone Shipped

**v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação** (2026-06-10 → 2026-06-12, 3 dias)

- 5 phases (14-18), 16 plans, 89 commits
- 18/18 requirements DELIVERED (100%) em 6 categorias (CAT, TENS/SIST, UX, CALC, RES)
- 2 migrations aditivas: `tipo_produto_correcao_catalogos`, `sync_passadas_padrao`
- 0 edge functions novas (PDF/cálculo client-side)
- Audit `tech_debt`: 18/18 satisfeitos, build verde, 128 testes verdes, integração cross-phase limpa, 0 blockers
- Validação: e2e/catalogo.spec.ts 3/3 PROD + Playwright E2E Phase 18 (0 erros) + 128 unit tests
- Escopo movido p/ v1.3: montagem de sistemas compostos MAGNETO/TINY/MODULAR (SIST-01/02/03)
- Archive: `.planning/milestones/v1.2-ROADMAP.md` + `v1.2-REQUIREMENTS.md` + `v1.2-MILESTONE-AUDIT.md` + `MILESTONES.md`

**Previous:** v1.1 (2026-05-11 → 2026-05-15, 7 phases, 29 plans) · v1.0 (2026-04-23 → 2026-05-07, 6 phases, 28 plans).

## Accumulated Context

### Decisions carryover (perpetual)

- **Schema sempre aditivo** — confirmado v1.0 (9) + v1.1 (11) + v1.2 (2 migrations), zero regressão
- **Drive RLS via `user_id` direto (D-02 errata)** — replicado em `arquitetos` + `clientes` (Phase 9)
- **PDF v1/v2 router (`pdf_template_version`)** — ajustes só no template v2; v1 não regride
- **ImportMaster XLSX (2.088 SKUs oficiais)** é fonte da verdade pra descrição rica
- **Multi-admin dinâmico via `has_role(admin)` (D-22)** — RPC `buscar_admins_emails()` SECURITY DEFINER
- **Recategorizar `tipo_produto` via migration aditiva (v1.2)** — snapshot jsonb autocontido; não afeta orçamentos salvos
- **Divergência de voltagem é advisory, nunca bloqueio (v1.2)** — validação só por-sistema
- **Clones com `crypto.randomUUID()` em toda a árvore (v1.2)** — cálculo agrupa por código, não por id

### Open tech debt (v1.2 — aceito, rastreado no audit)

- **WR-01:** passadas travadas em [1] para 160 produtos de famílias sem regra (`light_30/light_12/light_15`); fix 1 linha `produto.passadas ?? 3` em AmbienteCard.tsx:203
- Advisory TINY 24V fora do checklist pré-PDF / não ressurge em rascunho (LOW)
- Tag `<\strong>` cosmética em Step3Revisao.tsx ~819
- 3 warnings de code review Phase 18 (advisory loop, clone herda fita 0m, fallback sem flag cancelled) + IN-02 dead code
- 11 itens de UAT visual pendentes de confirmação manual em prod (Phases 15/16/17 — Marco 1)

### Follow-ups técnicos deferidos (v1.1)

- SPF/DKIM/DMARC do domínio `orcamentosaura.com.br` (email Junk no Outlook)
- WR-02 pg_net monitoring pro cron aniversário · dedup `toList` aniversário · bucket singular `produto-imagens` cleanup + `has_role(admin)` gate explícito

### Todos

- (nenhum)

### Blockers

- (nenhum)

## Next Action

Milestone v1.2 fechado. Iniciar próximo marco com `/gsd-new-milestone` (candidato: v1.3 — Sistemas Compostos MAGNETO/TINY/MODULAR, já registrado no Backlog do ROADMAP). Alternativamente, endereçar tech debt do v1.2 (mín. WR-01) antes via `/gsd-quick` ou `/gsd-plan-milestone-gaps`.

---
*STATE refreshed: 2026-06-12 — v1.2 milestone complete + archived. Próximo marco a planejar.*
