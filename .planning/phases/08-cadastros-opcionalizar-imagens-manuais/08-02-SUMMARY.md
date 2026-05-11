---
phase: 08-cadastros-opcionalizar-imagens-manuais
plan: 02
subsystem: frontend/cadastros
tags: [form, ux, cliente, opcionalizar, FORM-01]
requirements: [FORM-01]

dependency_graph:
  requires: []
  provides: [ClienteDialog com campos opcionais sinalizados]
  affects: [src/components/ClienteDialog.tsx]

tech_stack:
  added: []
  patterns: [label hint "(opcional)" com span text-muted-foreground]

key_files:
  modified:
    - src/components/ClienteDialog.tsx

decisions:
  - "Hint '(opcional)' via <span className='text-muted-foreground text-xs font-normal'> inline no Label — sem asterisco vermelho (D-15)"
  - "Payload e interface ClienteRow não alterados — já eram null-safe (D-17)"
  - "Nome continua obrigatório (required + disabled do botão Salvar via !nome.trim()) — D-14"

metrics:
  duration: "~5min"
  completed: "2026-05-11"
  tasks_completed: 1
  files_modified: 1
---

# Phase 08 Plan 02: Opcionalizar Campos do ClienteDialog (FORM-01) Summary

**One-liner:** Sinalizou Contato, CPF/CNPJ e Arquiteto como opcionais no ClienteDialog via hint `(opcional)` inline nos labels, sem alterar backend ou schema.

## What Was Done

Task 1 única: substituições cirúrgicas em `src/components/ClienteDialog.tsx`:

1. `<Label htmlFor="cli-contato">Contato</Label>` → label com span `(opcional)` em cinza
2. `<Label htmlFor="cli-cpf">CPF/CNPJ</Label>` → label com span `(opcional)` em cinza
3. `<Label>Arquiteto</Label>` → label com span `(opcional)` em cinza

**Confirmações pós-edit:**
- 3 ocorrências de `(opcional)` no arquivo (grep count = 3)
- 3 ocorrências de `text-muted-foreground text-xs font-normal` (grep count = 3)
- `required` aparece apenas 1 vez, na linha 109 (campo Nome — intacto)
- Inputs de contato (`id="cli-contato"`) e CPF (`id="cli-cpf"`) sem atributo `required`
- `npx eslint src/components/ClienteDialog.tsx` → exit 0 (nenhum erro no arquivo)
- `npx tsc --noEmit -p tsconfig.app.json` → erros apenas em arquivos pré-existentes não relacionados

## What Was NOT Changed

- Interface `ClienteRow` exportada (mantida intacta)
- Payload de submit (linhas 71-76) — já null-safe para os 3 campos
- `formatCpfCnpj`/`unmask` — validação de formato permanece quando campo é preenchido
- `useEffect` de hydration no modo edit — continua carregando null sem erro
- Botão Salvar (`disabled={saving || !nome.trim()}`) — gate de Nome intacto

## Commits

| Task | Commit | Mensagem |
|------|--------|----------|
| Task 1 | e004a2e | feat(08-02): opcionalizar Contato, CPF/CNPJ e Arquiteto no ClienteDialog |

## Deviations from Plan

None — plano executado exatamente como escrito.

## Known Stubs

None — sem stubs introduzidos. O hint `(opcional)` é visual puro; os campos já eram funcionalmente opcionais no payload.

## Threat Flags

None — nenhuma superfície nova introduzida. Mudança puramente UX nos labels.

## Self-Check: PASSED

- [x] `src/components/ClienteDialog.tsx` modificado e commitado (e004a2e)
- [x] 3 ocorrências de `(opcional)` confirmadas via grep
- [x] `required` apenas no campo Nome (linha 109)
- [x] Lint no arquivo sem erros
- [x] Erros TypeScript são todos pré-existentes em outros arquivos
