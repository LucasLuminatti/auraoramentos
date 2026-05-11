# Phase 7: Schema & Prep v1.1 — Summary

**Phase:** 07-schema-prep-v1-1
**Status:** SHIPPED
**Date:** 2026-05-11
**Requirements delivered:** RLS-03, AUTO-03
**Plans:** 07-01, 07-02, 07-03 (Wave 1 paralelo) + 07-04 (Wave 2 checkpoint)

## What was delivered

3 migrations aditivas aplicadas em prod (zero regressão confirmada via smoke 4/4 D-22):

1. **`20260511000001_arquitetos_clientes_user_id.sql`** — `user_id UUID NOT NULL` em `arquitetos` + `clientes` (RLS-03)
   - Pattern Drive D-02 errata replicado (Blocos 1-4 apenas — policies ficam para Phase 9, D-06)
   - Pre-flight assert (`EXISTS admin in user_roles`) + backfill (admin mais antigo) + NOT NULL + 2 indexes BTREE + COMMENT
   - ON DELETE RESTRICT divergente consciente do Drive (D-01) para garantir consistência referencial

2. **`20260511000002_clientes_data_nascimento.sql`** — `data_nascimento DATE NULL` em `clientes` (AUTO-03)
   - Aditivo trivial (D-07: sem default, nullable) + index BTREE (D-08) + COMMENT cita Phase 12 cron (D-09)

3. **`20260511000003_orcamentos_status_enum.sql`** — UPDATE `fechado`→`aprovado` + CHECK constraint (AUTO-03 corolário, destrava WIZ-04)
   - Pre-flight assert anti-regressão (D-14) + UPDATE in-place (D-10) + ADD CHECK enforçando enum {rascunho|aprovado|perdido|pendente} (D-11)
   - DEFAULT `'rascunho'` preservado (D-12); TS desatualizado de propósito (D-13 — Phase 10 sincroniza)
   - UPDATE foi no-op em prod (0 linhas com 'fechado'), mas CHECK constraint agora previne regressão

4 documentos da phase produzidos: AUDIT-PRODUCT-VARIANTS, PUSH-LOG, SMOKE-RESULTS, SUMMARY (este).

## Decisions implementadas

| D | Resumo | Onde |
|---|--------|------|
| D-01 | FK ON DELETE RESTRICT (divergente do Drive) | Plan 07-01 migration |
| D-02 | Backfill com admin mais antigo de `user_roles` | Plan 07-01 migration |
| D-03 | SET NOT NULL após backfill | Plan 07-01 migration |
| D-04 | Index BTREE `user_id` em arquitetos + clientes | Plan 07-01 migration |
| D-05 | COMMENT em cada coluna para rastreabilidade | Plans 07-01, 07-02, 07-03 |
| D-06 | NÃO criar policies aqui (Phase 9 cuida) | Plan 07-01 omite Blocos 5+ |
| D-07 | `data_nascimento` DATE NULL sem default | Plan 07-02 |
| D-08 | Index BTREE simples (sem WHERE/partial) | Plan 07-02 |
| D-09 | COMMENT cita Phase 12 cron de aniversário | Plan 07-02 |
| D-10 | UPDATE `fechado`→`aprovado` in-place | Plan 07-03 |
| D-11 | ADD CHECK constraint após UPDATE | Plan 07-03 |
| D-12 | DEFAULT `rascunho` mantido (sem ALTER COLUMN) | Plan 07-03 |
| D-13 | `src/types/orcamento.ts` TS NÃO sincronizado nesta phase | (Phase 10 sync) |
| D-14 | Pre-flight assert anti-regressão antes do CHECK | Plan 07-03 |
| D-15 | Descrição rica em JSONB `atributos`, sem migration | Plan 07-04 audit |
| D-16 | Auditoria de gaps via SQL (3 campos críticos) | Plan 07-04 → AUDIT |
| D-17 | Gaps viram FOLLOW-UP, não bloqueiam Phase 7 | Plan 07-04 → AUDIT |
| D-18 | `origem='coringa'` (16) e `origem='legado'` (2871) fora do escopo | Plan 07-04 → AUDIT |
| D-19 | 3 migrations separadas (uma por concern) | Plans 07-01..07-03 |
| D-20 | BEGIN/COMMIT em cada arquivo | Plans 07-01..07-03 |
| D-21 | Ordem de push: user_id → data_nascimento → status | Plan 07-04 Task 2 (timestamps 000001/000002/000003 → CLI aplica nessa ordem) |
| D-22 | Smoke pós-push: 4 checks (counts, JOIN, CHECK, Playwright) | Plan 07-04 Task 4 → SMOKE-RESULTS |
| D-23 | Formato SMOKE-RESULTS herda padrão v1.0 | SMOKE-RESULTS.md |

23 decisões D-XX cobertas.

## Smoke results (D-22)

Resumo (detalhe em `07-SMOKE-RESULTS.md`):

| Check | Resultado |
|-------|-----------|
| 1 — SQL counts (consistência com PUSH-LOG) | PASS |
| 2 — SQL JOIN wizard | PASS |
| 3 — SQL CHECK constraint válida | PASS |
| 4 — Playwright login + render + console limpo | PASS |

**Veredicto: 4/4 PASS.** Critério #5 do ROADMAP (zero regressão em prod) atendido.

## Audit findings (product_variants)

Resumo (detalhe em `07-AUDIT-PRODUCT-VARIANTS.md`):

| Métrica | Valor | % |
|---------|-------|---|
| Total masters | 2088 | 100% |
| Masters com gap em ≥1 dos 3 campos críticos | 1525 | 73,0% |
| gap_temperatura_k | 1252 | 60,0% |
| gap_irc | 1468 | 70,3% |
| gap_nicho | 823 | 39,4% |
| gap_cor_iluminacao | 1189 | 56,9% |
| Coringa (D-18: fora do escopo) | 16 | — |
| Legado (D-18: fora do escopo) | 2871 | — |

**Conclusão:** Schema atual de `product_variants.atributos` (JSONB) é suficiente para WIZ-05. Gaps são problema de **dados**, não de **schema** — viram FOLLOW-UP.

## FOLLOW-UPs (não bloqueiam Phase 7)

- [ ] **FOLLOW-UP-WIZ-05-AUDIT**: 1525 masters com gap em ≥1 dos 3 campos críticos. Caminhos: re-importar via ImportMaster com XLSX completo; OU edição manual no admin (Phase 8 FORM-03 cobre coringa); OU aceitar gap (Phase 10 WIZ-05 já trata variant sem dado).
- [ ] **FOLLOW-UP-WIZ-05-PRIORITY**: Priorizar `irc` (70,3% gap) e `temperatura_k` (60,0% gap) — mais visíveis no PDF.
- [ ] **FOLLOW-UP-PHASE-10**: Sincronizar `src/types/orcamento.ts:109` para incluir `'aprovado'` e `'pendente'` + regenerar `src/integrations/supabase/types.ts` (D-13).
- [ ] **FOLLOW-UP-SECURITY**: Trocar senha da conta `lenny.wajcberg@luminattiled.com.br` (a senha usada no Check 4 Playwright passou em texto puro pelo chat — boa prática rotacionar).

## Downstream impact

- **Phase 8 (Cadastros FORM)**: paralelo, sem dependência direta — pode rodar agora.
- **Phase 9 (RLS multi-tenancy)**: desbloqueada. Pode escrever policies `USING (user_id = auth.uid() OR has_role(admin))` em `arquitetos` + `clientes` — colunas prontas com FK + NOT NULL.
- **Phase 10 (Wizard edição)**: desbloqueada. Pode adicionar status badges/select para `'aprovado'` e `'pendente'` + sync TS (D-13) — CHECK constraint protege contra regressão.
- **Phase 11 (PDF + Dashboard)**: indireta via Phase 10.
- **Phase 12 (Cron aniversário)**: desbloqueada. `data_nascimento DATE NULL` + index pronto; cron + edge function podem consumir.

## Files changed

**Migrations (prod schema):**
- `supabase/migrations/20260511000001_arquitetos_clientes_user_id.sql` (new)
- `supabase/migrations/20260511000002_clientes_data_nascimento.sql` (new)
- `supabase/migrations/20260511000003_orcamentos_status_enum.sql` (new)

**Phase artifacts:**
- `.planning/phases/07-schema-prep-v1-1/07-01-SUMMARY.md` (new)
- `.planning/phases/07-schema-prep-v1-1/07-02-SUMMARY.md` (new)
- `.planning/phases/07-schema-prep-v1-1/07-03-SUMMARY.md` (new)
- `.planning/phases/07-schema-prep-v1-1/07-AUDIT-PRODUCT-VARIANTS.md` (new)
- `.planning/phases/07-schema-prep-v1-1/07-PUSH-LOG.md` (new)
- `.planning/phases/07-schema-prep-v1-1/07-SMOKE-RESULTS.md` (new)
- `.planning/phases/07-schema-prep-v1-1/07-SUMMARY.md` (new — este)

**Code (intencionalmente NÃO alterado):**
- `src/types/orcamento.ts` (D-13 — Phase 10 sincroniza)
- `src/integrations/supabase/types.ts` (D-13 — Phase 10 regenera)

---
*Phase 7 fechada em 2026-05-11. Próxima fase recomendada: 8 (Cadastros FORM) ou 9 (RLS) — paralelizáveis.*
