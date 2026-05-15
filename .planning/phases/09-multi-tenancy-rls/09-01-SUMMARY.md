---
phase: 09-multi-tenancy-rls
plan: 01
subsystem: database
tags: [rls, supabase, multi-tenancy, audit, preflight, postgres]

requires:
  - phase: 07-schema-prep-v11
    provides: "user_id NOT NULL em arquitetos/clientes + hotfix 71d28d7 (payload manual)"
provides:
  - "Baseline auditoria de 11 callsites client em arquitetos/clientes (File:Line + Class + Justification)"
  - "Confirmação read-only de que Phase 9 não precisa modificar código frontend (D-09, D-11)"
  - "Mapa pra investigação pós-migration (qualquer regressão volta nessa tabela)"
affects: [09-multi-tenancy-rls, 09-03 (migration RLS), 09-04+ (smoke tests pós-RLS)]

tech-stack:
  added: []
  patterns:
    - "Pre-flight callsite audit antes de aplicar policy RLS (read-only, classifica colab/admin/risk)"

key-files:
  created:
    - .planning/phases/09-multi-tenancy-rls/09-PREFLIGHT.md
  modified: []

key-decisions:
  - "Phase 9 não modifica código do client — RLS filtra naturalmente e admin tem has_role(admin)"
  - "Hotfix 71d28d7 (user_id manual no payload INSERT) torna-se redundância segura após DEFAULT auth.uid() — cinto-e-suspensórios"
  - "Nenhum callsite classificado como Risk; 0 action items adicionais pra 09-03"

patterns-established:
  - "Pre-flight callsite audit: antes de policy RLS apertar, mapear toda query SELECT/INSERT/UPDATE/DELETE em File:Line e classificar surface (admin/colab/both) + class (OK natural / OK admin-only / Risk)"

requirements-completed: []  # Plan 09-01 estabelece baseline read-only; RLS-01/RLS-02 só ficam completos após 09-03 (migration) + smoke posterior

duration: 5min
completed: 2026-05-15
---

# Phase 09 Plan 01: Pre-flight Callsite Audit Summary

**Auditoria read-only dos 11 callsites client em `arquitetos`/`clientes` — todos classificados OK natural (7) ou OK admin-only (4); 0 Risk; Phase 9 confirma que não precisa tocar código frontend.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T12:55:30Z
- **Completed:** 2026-05-15T12:57:36Z
- **Tasks:** 1
- **Files modified:** 1 (criado)

## Accomplishments

- 10 callsites SELECT/DELETE + 1 bloco INSERT dialogs auditados com File:Line concreto
- 7 callsites classificados OK natural (colab+admin, RLS filtra como desejado)
- 4 callsites classificados OK admin-only (rota /admin gated, has_role libera)
- 0 callsites classificados Risk — nenhum action item adicional para 09-03
- Baseline documentado em `09-PREFLIGHT.md` pra eventual investigação pós-migration

## Task Commits

1. **Task 1: Auditar 10 callsites + bloco INSERT dialogs** — `4fdba6a` (docs)

## Files Created/Modified

- `.planning/phases/09-multi-tenancy-rls/09-PREFLIGHT.md` — Tabela markdown 11 linhas + seção Risk Callsites (vazia) + Conclusão; cross-references D-09/D-11/hotfix 71d28d7

## Decisions Made

- **Numeração de linhas validada in-place:** O plano lista linhas aproximadas (ex: Admin.tsx:286, 347, 364, 379, 404), mas a leitura direta dos arquivos mostrou os pontos reais de SELECT/DELETE: 341 (clientes by id), 402 (`fetchClientes`), 419 (`fetchArquitetos`), 434 (`handleDeleteArquiteto`), 459 (`handleDeleteCliente`). Tabela do PREFLIGHT usa os números reais — não os aproximados do plano — pra que grep crosscheck dê hit exato.
- **PrecosBatch reclassificado de "admin-only" com justificativa explícita:** Confirmado que o componente só monta dentro da subtab Preços do Admin.tsx (rota gated por AdminRoute).
- **ClienteDialog:45 fica OK natural com nota:** É um SELECT pontual `.eq(id).maybeSingle()`; passa por RLS-01 (cliente do user) → arquiteto referenciado é do mesmo user na prática nova.

## Deviations from Plan

Nenhum bug fix ou correção crítica necessária. Único ajuste foi precisão dos números de linha (descrito em Decisions Made acima) — não é deviation, é correção de erro de transcrição no plano. Não havia código pra modificar; auditoria é read-only.

## Issues Encountered

- O arquivo `09-CONTEXT.md` referenciado no `<read_first>` do plano não existe na pasta (Phase 09 tem PLAN files de 01 a 07, mas nenhum CONTEXT.md). Não impactou execução: o contexto necessário (D-09/D-10/D-11) está documentado dentro do próprio plano e foi suficiente pra classificar os callsites. Marcado pra mention se algum reviewer perguntar.

## User Setup Required

None — auditoria 100% read-only, zero código modificado, zero schema mudado.

## Next Phase Readiness

- 09-PREFLIGHT.md publicado como baseline
- 09-03 (migration RLS) NÃO ganha task adicional (esperado: 0 Risk callsites encontrados)
- Quando RLS for aplicado, qualquer regressão visual em prod (lista vazia, autocomplete vazio, etc.) cai direto na tabela de 11 linhas pra triagem rápida
- Hotfix `71d28d7` continua funcional mas torna-se redundante após DEFAULT `auth.uid()` (D-04 já validado em Phase 7)

## Self-Check: PASSED

- `.planning/phases/09-multi-tenancy-rls/09-PREFLIGHT.md` — FOUND
- Commit `4fdba6a` — FOUND (`git log` confirma)
- Tabela contém `## Callsite Audit`, 11 linhas numeradas, `## Risk Callsites (Action Items para 09-03)`, `## Conclusão` — todos verificados na escrita
- Todos os File:Line citados existem no repo (validados via Read tool durante auditoria)

---
*Phase: 09-multi-tenancy-rls*
*Completed: 2026-05-15*
