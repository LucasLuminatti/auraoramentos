---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: — Sistemas Compostos (MAGNETO / TINY / MODULAR)
status: executing
last_updated: "2026-06-12T17:53:53.214Z"
last_activity: 2026-06-12
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
  percent: 33
---

# STATE: AURA

**Last updated:** 2026-06-12 — Phase 19 Plan 01 concluído: `ItemComposicao`, `composicao?`, `REGRAS_COMPOSICAO`, `calcularSubtotalComposicao`, `calcularTotalAmbienteSemFita` extendido. 137 testes verdes, 4 calc sites intactos.

## Current Position

Phase: 19 (funda-o-compostos) — EXECUTING
Plan: 2 of 3
Status: Plan 01 complete — executing Plan 02
Last activity: 2026-06-12 — Plan 01 complete (data model TypeScript)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-12)

- **Project:** AURA (sistema de orçamentos de iluminação da Luminatti)
- **Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.
- **Current Milestone:** v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)
- **Current Focus:** Phase 19 — funda-o-compostos
- **Mode:** yolo

## Roadmap Summary (v1.3)

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 19. Fundação Compostos | Data model aditivo + `produto_composicao` table + CAT-03 catalog fix | CAT-03 | Not started |
| 20. Fluxos Magnéticos | Seletor de tipo + MAGNETO 48V + TINY 24V + checklist + voltage lock + driver auto | SIST-05, SIST-01, SIST-02, COMP-01, COMP-02, COMP-03, DRV-01, DRV-02 | Not started |
| 21. SYSTEM MOLD + Validação & Reuso | SYSTEM MOLD + aviso Step 2→3 + duplicar composto | SIST-03, VAL-01, DUP-01 | Not started |
| 22. PDF v3 — Sistemas Compostos | Seção "Sistemas Compostos" no PDF v3 sem arriscar v2 | PDF-03 | Not started |

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
- **Compostos em `luminarias[].composicao?`, não em `sistemas[]` (v1.3 — decisão aprovada)** — opção mais conservadora; evita guards nas funções de cálculo de fita; snapshot-compat via campo undefined; `sistemas[]` permanece exclusivo para Fita Padrão
- **ItemComposicao forward-complete com comprimento?/potenciaW? (Phase 19 / D-02)** — fundação paga custo de modelagem uma vez; Phase 20/21 não reabrem o tipo nem migram snapshots
- **REGRAS_COMPOSICAO no código, não na tabela (Phase 19 / D-07)** — 3 famílias fixas (magneto_48v/tiny_magneto/embutir); produto_composicao reservada para sugestões SKU↔SKU; validador Phase 20 desacoplado de dados seedados
- **calcularSubtotalComposicao com guard ?.length (Phase 19)** — backward-compat provada por teste unitário com snapshot literal sem chave composicao

### Key v1.3 architectural constraints (pré-Phase 19)

- `ItemLuminaria.composicao?: ItemComposicao[]` — campo opcional, old snapshots têm `undefined` e continuam funcionando
- Os 5 calculation sites que NÃO devem ser alterados sem cuidado: `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita`, `isSistemaVazio` em v2.ts
- `calcularSubtotalComposicao()` é função nova folha — só depois modifica `calcularTotalAmbienteSemFita()` via `?.length` guard
- `analisarMagneto48V()` continua lendo `amb.luminarias` — não migrar para `sistemas[]`
- `pdf_template_version: 3` só quando `ambientes.some(a => a.luminarias.some(l => l.composicao?.length))` — não bump incondicional
- CAT-03: `useProdutoSearch` precisa de `filtro='conector'` e `filtro='kit_fixacao'` + migration de `tipo_produto` para os SKUs afetados (LM2338, LM2987, LM3168, LM3169, e famílias afins)
- COMP-03 é hard lock (eletricamente impossível misturar voltagens no mesmo trilho) — as demais validações são advisory

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

Executar Phase 19 Plan 02 (`19-02-PLAN.md`). NOTA: Plan 03 tem task [BLOCKING] autonomous:false — Lenny aplica as 2 migrations via service role + migration repair (db push inseguro neste projeto).

---
*STATE refreshed: 2026-06-12 — Plan 19-01 concluído (data model TypeScript). Próximo: Plan 19-02.*
