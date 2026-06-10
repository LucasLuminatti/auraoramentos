---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: milestone
status: executing
last_updated: "2026-06-10T14:17:43.115Z"
last_activity: 2026-06-10 -- Phase 14 planning complete
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# STATE: AURA

**Last updated:** 2026-06-10 — Roadmap v1.2 criado. 5 fases (14–18), 18/18 reqs mapeados. Pronto para `/gsd-plan-phase 14`.

## Project Reference

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação (iniciado 2026-06-10)
- **Mode:** yolo
- **Granularity:** coarse
- **Current Focus:** Phase 14 — Catálogo & Dados (próximo a ser planejado)

## Current Position

Phase: 14 (não iniciada)
Plan: —
Status: Ready to execute
Last activity: 2026-06-10 -- Phase 14 planning complete

```
Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/5 phases)
```

## Roadmap v1.2

| Phase | Tema | Reqs | Status |
|-------|------|------|--------|
| 14 | Catálogo & Dados | CAT-01, CAT-02 | Not started |
| 15 | Tensão & Validação | TENS-01, TENS-02, SIST-04, UX-02 | Not started |
| 16 | Cálculo & Metragem | CALC-01, CALC-02, CALC-03 | Not started |
| 17 | Resumo & Apresentação | RES-01..05 | Not started |
| 18 | UX Transversal | UX-01, UX-03, UX-04, UX-05 | Not started |

## Build Order & Key Constraints

- **Phase 14 first (hard):** CAT-01 é SQL puro aditivo; corrige `tipo_produto` errado (WALL WASHER → `'perfil'`, LM3475, LM3291, CANTONEIRA) que bloqueia os seletores de perfil/driver usados pelas Phases 15–16.
- **Phase 16 atomic calc patch:** CALC-01/02/03 exigem patch simultâneo dos 5 sites de cálculo (`calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita`, `isSistemaVazio` em pdfTemplates/v2.ts) — risco de fita com wm=0 sumindo do PDF silenciosamente. Não dividir.
- **Phase 16 migration antes de UI:** CALC-03 exige migration de sync `passadas_padrao` (`regras_compatibilidade_perfil` → `produtos`) ANTES do unlock da UI, senão perfil 50mm fica com 1 passada em vez de 3.
- **Phase 15 grouping key fix:** TENS-02 exige mudança do grouping key de `calcularDriversPorProjeto` para `(codigo + voltagem)` ANTES de desbloquear tensões diferentes por ambiente — evita subtotal fisicamente nonsensical.
- **Schema sempre aditivo** — não quebrar wizard, orçamentos antigos, PDF v1/v2.
- **UX-05 (checklist pré-PDF)** é flag estrutural: se implementação exigir mudança no Step 3 além de overlay/panel, registrar decisão antes de prosseguir.

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

**Previous milestone:** v1.0 — Melhorias v1 (2026-04-23 → 2026-05-07, 15 dias, 28 plans, 163 commits, 40/42 entregues + 1 obsoleto + 1 deferido).

## Accumulated Context

### Decisions carryover (v1.0 → v1.1 → v1.2)

- **Schema sempre aditivo (perpetual)** — confirmado v1.0 (9 migrations) + v1.1 (11 migrations, zero regressão)
- **Drive RLS via `user_id` direto (D-02 errata)** — replicado em `arquitetos` + `clientes` na Phase 9
- **PDF v1/v2 router (`pdf_template_version`)** — ajustes ficam no template v2 apenas; v1 não pode regredir
- **ImportMaster XLSX (2.088 SKUs oficiais)** é fonte da verdade pra descrição rica
- **Multi-admin dinâmico via `has_role(admin)` (D-22)** — RPC `buscar_admins_emails()` SECURITY DEFINER
- **Vault subquery em RUNTIME (Phase 12-03)** — cron lê `decrypted_secret` a cada disparo

### v1.2 Technical Notes (da pesquisa PITFALLS.md)

- **Snapshot backward-compat (C-1):** recategorizar `tipo_produto` não afeta snapshots salvos (jsonb autocontido) — só novas buscas. OK.
- **isSistemaVazio pitfall (C-2):** patch obrigatório em `isSistemaVazio` ao tocar tipos de sistema — fita com wm=0 some do PDF silenciosamente.
- **metragemManual=null pitfall (C-3):** guard no Step 2 advancement é a fix correta para CALC-01; não alterar defaults de `addSistema()`.
- **Voltage cross-ambiente pitfall (C-4):** grouping key deve mudar para `(codigo+voltagem)` antes de desbloquear tensões por ambiente (TENS-02).
- **passadas_padrao sync pitfall (C-5):** migration de sync `regras_compatibilidade_perfil` → `produtos` antes do unlock UI (CALC-03).
- **Step 3 JSX fita dedup pitfall (M-1):** RES-02 fix não pode tocar `rowFita` em pdfTemplates/v2.ts — são code paths separados.
- **LOCAL no fita summary pitfall (N-1):** RES-01 precisa de decisão design (annotation vs accounting separado) antes de codar.

### v1.2 Execution Directives (Lenny — aprovação do roadmap 2026-06-10)

- **Filosofia (todas as fases):** não só corrigir o sintoma reportado — atacar a causa-raiz e propor melhorias que deixem o sistema mais intuitivo, didático e difícil de configurar errado.
- **Sinalizar antes de absorver:** qualquer item que comece a virar mudança estrutural relevante deve ser sinalizado e avaliado com o Lenny, não absorvido silenciosamente na v1.2.
- **RES-01 (decisão travada):** apenas **anotação visual do LOCAL** no resumo. NÃO mexer em cálculos nem em subtotais por LOCAL nesta milestone (não tocar `calcularRolosPorGrupo`).
- **UX-05 (decisão travada):** checklist/painel de validação antes do PDF **dentro do fluxo atual** (overlay/panel no Step 3). Se exigir reestruturar os steps ou mudar significativamente a navegação → **consultar o Lenny antes**.

### Todos

- (nenhum — aguardando plano Phase 14)

### Blockers

- (nenhum)

## Next Action

`/gsd-plan-phase 14` — Catálogo & Dados (CAT-01, CAT-02)

---
*STATE refreshed: 2026-06-10 — roadmap v1.2 criado (5 fases, 18/18 reqs). Próxima ação: `/gsd-plan-phase 14`.*
