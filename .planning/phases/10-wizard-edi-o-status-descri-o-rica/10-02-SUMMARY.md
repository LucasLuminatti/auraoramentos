---
phase: 10-wizard-edi-o-status-descri-o-rica
plan: "02"
subsystem: frontend-types
tags: [typescript, status-sync, cleanup, bugfix]
dependency_graph:
  requires: [10-01]
  provides: [StatusOrcamento-sync, fechado-purge, EncerrarNegociacao-removed]
  affects: [Admin.tsx, AdminDashboard.tsx, ClienteList.tsx, OrcamentoDetalhe.tsx, src/types/orcamento.ts, src/integrations/supabase/types.ts]
tech_stack:
  added: []
  patterns: [supabase-cli-gen-types]
key_files:
  created: []
  modified:
    - src/types/orcamento.ts
    - src/integrations/supabase/types.ts
    - src/components/AdminDashboard.tsx
    - src/components/ClienteList.tsx
    - src/pages/OrcamentoDetalhe.tsx
    - src/pages/Admin.tsx
  deleted:
    - src/components/EncerrarNegociacaoModal.tsx
decisions:
  - "D-25: StatusOrcamento atualizado para 'rascunho' | 'aprovado' | 'perdido' | 'pendente'"
  - "D-26: supabase/types.ts regenerado via CLI — status já era string (sem mudança de literal)"
  - "D-27/D-33: 11 ocorrências hardcoded de 'fechado' eliminadas dos 4 arquivos afetados"
  - "D-31: EncerrarNegociacaoModal deletado — bugado em prod (gravava 'fechado' quebrando CHECK constraint)"
metrics:
  duration: ~25min
  completed: "2026-05-14"
  tasks_completed: 4
  files_modified: 6
  files_deleted: 1
---

# Phase 10 Plan 02: TypeScript Status Sync + Fechado Purge Summary

**One-liner:** Sincronização completa do tipo `StatusOrcamento` com o schema Phase 7 — eliminação de 11 ocorrências hardcoded de `'fechado'` em 5 arquivos e deleção do `EncerrarNegociacaoModal` bugado que gravava valor inválido em prod.

## What Was Built

### Task 1 — StatusOrcamento + regen types.ts (D-25, D-26)

`src/types/orcamento.ts` linha 109:
```typescript
// Antes
export type StatusOrcamento = 'rascunho' | 'fechado' | 'perdido';

// Depois
// Status do orçamento — alinhado com CHECK constraint da Phase 7 (D-25)
export type StatusOrcamento = 'rascunho' | 'aprovado' | 'perdido' | 'pendente';
```

`src/integrations/supabase/types.ts` regenerado via `npx supabase gen types typescript --project-id jkewlaezvrbuicmncqbj`. O campo `status` de `orcamentos` já era `string` nos tipos gerados (PostgREST não exporta CHECK constraints como union) — diff resultou em remoção de campos obsoletos de outras tabelas, zero mudança no literal do status.

### Task 2 — Purga de "fechado" hardcoded (D-27, D-33)

**AdminDashboard.tsx (6 ocorrências):**
- Variável `fechados` renomeada para `aprovados`; filtro `status === "fechado"` → `"aprovado"`
- KPI taxaConversão: usa `aprovados.length` em vez de `fechados.length`
- KPI cicloMedio: fallback usa `[...aprovados, ...perdidos]`
- Top 5 clientes: filtro `"fechado"` → `"aprovado"` (renomeado para "receita aprovada")
- monthlyData: chave `fechado` → chave `pendente`; bar dataKey `fechado` → `pendente` (cor âmbar); bar `aprovado` mantido (cor verde)
- Tooltip/Legend: formatters atualizados para `"pendente"/"aprovado"`

**ClienteList.tsx (2 ocorrências):**
- `statusLabel`: remove `"fechado"`, adiciona `"pendente"`; remove `"enviado"`
- `statusClass`: `"fechado"` (verde) → `"aprovado"` (emerald); `"pendente"` (amarelo) adicionado; paleta alinhada com D-17
- Função `canEncerrar` removida (modal deletado)

**OrcamentoDetalhe.tsx (2 ocorrências):**
- `statusLabel`: remove `"fechado"` e `"enviado"`, adiciona `"pendente"`
- `statusClass`: paleta alinhada — rascunho cinza, pendente âmbar, aprovado emerald, perdido vermelho

**Admin.tsx (3 ocorrências):**
- `STATUS_OPTIONS`: remove `enviado` e `fechado`, adiciona `pendente`; comentário atualizado para referenciar D-33
- `statusLabel`: remove `"fechado"` e `"enviado"`, adiciona `"pendente"`
- `statusClass`: paleta alinhada com D-17 (cinza/âmbar/verde/vermelho)
- `canEncerrar` removida

### Task 3 — Delete EncerrarNegociacaoModal (D-31)

Arquivo `src/components/EncerrarNegociacaoModal.tsx` **deletado**. Componente estava bugado em prod desde Phase 7: gravava `status: "fechado"` que a CHECK constraint rejeita (erro 400 silencioso ao "encerrar negociação como ganha").

Removido de ambos os consumers:
- **Admin.tsx**: import removido, states `encerrarOpen`/`encerrarOrcId` removidos, `canEncerrar` removida, botão Flag removido, JSX `<EncerrarNegociacaoModal>` removido, import `Flag` do lucide removido. Coluna "Ações" na TableRow agora tem placeholder `{/* Plan 10-04 popula com dropdown de status */}`.
- **ClienteList.tsx**: import removido, states removidos, botão Flag removido, JSX do modal removido, import `Flag` removido.

`grep -r "EncerrarNegociacaoModal" src/` → zero matches.

### Task 4 — Validação build + testes

- `npm run build`: exit 0 (✓) — apenas warnings pré-existentes de chunk size
- `npm run test -- --run`: 47/47 testes passando (✓) — 5 suites, zero regressão
- `grep -rn '"fechado"' src/`: zero matches (✓)

## Commits

| Task | Hash | Mensagem |
|------|------|---------|
| 1 | 456bb16 | feat(10-02): sync StatusOrcamento type + regen supabase/types.ts (D-25, D-26) |
| 2+3 | 17a105f | feat(10-02): replace 'fechado' with 'aprovado'/'pendente' + delete EncerrarNegociacaoModal (D-27, D-31, D-33) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] AdminDashboard: chave `fechado` no monthlyData substituída por `pendente` (não `aprovado`)**
- **Found during:** Task 2
- **Issue:** O plano dizia trocar `fechado: inRange.filter(o.status === "fechado")` por `aprovado: inRange.filter(o.status === "aprovado")` no `monthlyData`. Porém `aprovado` já existia como chave separada no mesmo objeto. Duplicar a chave `aprovado` resultaria em colisão e perda de dados no gráfico.
- **Fix:** Chave `fechado` substituída por `pendente` (refletindo o status que substitui semanticamente "em negociação fechada/aguardando"). Bar `pendente` usa cor âmbar, bar `aprovado` mantém cor verde. Tooltip/Legend atualizados de forma consistente.
- **Files modified:** `src/components/AdminDashboard.tsx`
- **Commit:** 17a105f

**2. [Rule 2 - Missing critical functionality] `canEncerrar` removida de ClienteList.tsx também**
- **Found during:** Task 3
- **Issue:** O plano mencionava remover `canEncerrar` de Admin.tsx mas não mencionou explicitamente ClienteList.tsx. ClienteList tinha sua própria função `canEncerrar` que verificava `"enviado"` (status obsoleto) e `"aprovado"`, além de usar o botão Flag.
- **Fix:** Removida `canEncerrar` de ClienteList.tsx junto com o botão Flag e os states do modal.
- **Files modified:** `src/components/ClienteList.tsx`
- **Commit:** 17a105f

## Known Stubs

Nenhum stub introduzido. A coluna "Ações" da TableRow em Admin.tsx tem um comentário placeholder `{/* Plan 10-04 popula com dropdown de status */}` — isso é intencional conforme D-31 do plano (Plan 10-04 será responsável por popular essa coluna com o dropdown de status).

## Threat Flags

Nenhuma nova surface de segurança introduzida. O plano foi inteiramente de cleanup/sync — remoção de código bugado, nenhuma nova rota, endpoint ou acesso a dados adicionado.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/types/orcamento.ts exists | FOUND |
| src/integrations/supabase/types.ts exists | FOUND |
| EncerrarNegociacaoModal.tsx deleted | CONFIRMED DELETED |
| Commit 456bb16 exists | FOUND |
| Commit 17a105f exists | FOUND |
| grep '"fechado"' src/ = 0 | CLEAN |
| npm run build exit 0 | PASS |
| npm run test 47/47 | PASS |
