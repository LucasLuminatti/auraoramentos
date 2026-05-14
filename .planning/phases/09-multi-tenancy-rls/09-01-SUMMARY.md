---
phase: 09-multi-tenancy-rls
plan: 01
subsystem: rls-audit
tags: [rls, audit, preflight, multi-tenancy]
dependency_graph:
  requires: []
  provides: [09-PREFLIGHT.md, callsite-audit-baseline]
  affects: [09-03-PLAN.md]
tech_stack:
  added: []
  patterns: [callsite-audit-table]
key_files:
  created:
    - .planning/phases/09-multi-tenancy-rls/09-PREFLIGHT.md
  modified: []
decisions:
  - "0 callsites Risk encontrados — Phase 9 não requer mudanças no código do client"
  - "ClienteFilterAutocomplete confirmado admin-only (usado só em Admin.tsx)"
  - "ArquitetoAutocomplete confirmado colab+admin (usado em Index.tsx via ClienteDialog)"
  - "INSERT hotfix 71d28d7 documentado como redundância segura após DEFAULT auth.uid()"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-14"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 9 Plan 01: Preflight Callsite Audit Summary

**One-liner:** Auditoria read-only de 11 callsites em arquitetos/clientes classificou todos como OK (7 natural + 4 admin-only), confirmando zero mudanças de código necessárias para Phase 9 RLS.

## What Was Done

Leitura e classificação de todos os callsites de SELECT/INSERT/UPDATE/DELETE em `arquitetos` e `clientes` no codebase, seguindo a classificação D-09/D-10 do 09-CONTEXT.md. Resultado documentado em `09-PREFLIGHT.md` com tabela de 11 linhas.

## Callsite Summary

| Class | Count | Examples |
|-------|-------|---------|
| OK natural | 7 | ArquitetoAutocomplete, ClienteList, ClienteDialog:45, DriveSidebar, DriveExplorer, INSERTs de dialog |
| OK admin-only | 4 | ClienteFilterAutocomplete, PrecosBatch, ProdutoEditDialog, Admin.tsx fetches + DELETEs |
| Risk | 0 | — |

## Key Findings

**ClienteFilterAutocomplete** — confirmado admin-only via grep (usado exclusivamente em Admin.tsx, não em Index.tsx ou páginas de colab). Plano previa colab+admin, auditoria corrigiu para admin-only — sem impacto pois classe permanece OK.

**ArquitetoAutocomplete** — confirmado colab+admin (usado em ClienteDialog que é renderizado em Index.tsx pelo wizard). RLS filtra por user_id → colab vê só os arquitetos dele = comportamento desejado.

**INSERT dialogs** — pós-hotfix 71d28d7, ambos `ArquitetoDialog.tsx:84` e `ClienteDialog.tsx:85` injetam `user_id: userData.user.id` explicitamente. WITH CHECK `(user_id = auth.uid())` passa porque os valores são idênticos em runtime. DEFAULT auth.uid() do D-04 (a ser aplicado em 09-03) vira defesa extra sem precisar remover o hotfix.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

**Ajuste de classificação de surface (não é desvio de rule, é auditoria):** `ClienteFilterAutocomplete` foi reclassificado de `colab+admin` para `admin-only` após grep confirmar uso exclusivo em Admin.tsx. Classe final permanece `OK admin-only` — sem impacto em decisões de Phase 9.

## Risk Callsites

Nenhum identificado. Phase 9 não requer modificações no código do client.

## Known Stubs

Nenhum. Plano é read-only (apenas documentação).

## Threat Flags

Nenhum. Plano é read-only, não introduz nova surface.

## Self-Check: PASSED

- [x] `.planning/phases/09-multi-tenancy-rls/09-PREFLIGHT.md` existe
- [x] Commit `4b261d6` existe
- [x] Arquivo contém `## Callsite Audit`
- [x] Arquivo contém 11 linhas numeradas na tabela
- [x] Arquivo contém `## Risk Callsites (Action Items para 09-03)`
- [x] Arquivo contém `## Conclusão`
