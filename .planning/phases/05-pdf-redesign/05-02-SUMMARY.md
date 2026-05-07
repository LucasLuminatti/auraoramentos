---
phase: 05-pdf-redesign
plan: 02
subsystem: types + wizard UI
tags: [schema-additive, ui-input, pdf-prep, hierarchy-5-levels]
requirements:
  - PDF-01
dependency-graph:
  requires: []
  provides:
    - "SistemaIluminacao.local?: string | null"
    - "Input 'Local (opcional)' no Step2Ambientes (AmbienteCard)"
  affects:
    - "src/types/orcamento.ts"
    - "src/components/AmbienteCard.tsx"
    - "Snapshot persistido em orcamentos.ambientes (jsonb) — campo opcional novo, não-quebrante"
tech-stack:
  added: []
  patterns:
    - "Schema aditivo via campo opcional em interface TypeScript (sem migration — jsonb)"
    - "Input shadcn-ui + Badge 'Opcional' como UI pattern para campos não-obrigatórios"
    - "Normalização string vazia → null no onChange (e.target.value || null)"
key-files:
  created: []
  modified:
    - "src/types/orcamento.ts"
    - "src/components/AmbienteCard.tsx"
decisions:
  - "Campo `local` é string livre opcional (não enum nem entidade nova) — escolha confirmada A5 do RESEARCH"
  - "Vazio normaliza para null (não string vazia) — leitor v2 trata null como pseudo-grupo 'Geral'"
  - "maxLength=40 sem validação dura — orientação por placeholder, não bloqueio"
  - "Inicialização explícita `local: null` em addSistema mantém consistência (todos os campos do tipo presentes em sistemas novos)"
metrics:
  duration: "~12min"
  completed: 2026-05-07
  tasks: 2
  files_changed: 2
  commits: 2
---

# Phase 05 Plan 02: Schema Local + UI Input — Summary

Adiciona campo opcional `local?: string | null` ao tipo `SistemaIluminacao` e expõe input "Local (opcional)" no formulário de sistema dentro do `AmbienteCard.tsx`. Entrega base de dados para a hierarquia 5-níveis do PDF v2 (Ambiente → Local → Sistema → Componentes — locked decisions A4 + B4 do CONTEXT).

## What Was Built

### Task 1 — Type Extension (commit `115336a`)

`src/types/orcamento.ts`: adicionada UMA linha + JSDoc dentro de `SistemaIluminacao`:

```typescript
/** Sub-ambiente / agrupamento opcional (ex: "Sanca", "Rasgo", "Pé-direito"). Phase 5 / PDF-01. */
local?: string | null;
```

- Compatível para trás: snapshots antigos sem o campo continuam type-safe (campo opcional)
- Nenhuma função de cálculo modificada — `local` é metadata visual pura
- Nenhum call site existente quebrou (todos os locais que constroem `SistemaIluminacao` hoje continuam compilando)

### Task 2 — UI Input (commit `d333e16`)

`src/components/AmbienteCard.tsx`: duas mudanças cirúrgicas.

**Mudança 1 — addSistema (linha 65):** novo sistema agora inicia com `local: null` explícito.

**Mudança 2 — Input "Local (opcional)" (linhas 361–375):** bloco novo logo após `<div className="p-4 space-y-3">`, antes do bloco "Fita LED":

```tsx
{/* ── LOCAL (opcional, Phase 5 PDF-01) ── */}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Local</span>
    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Opcional</Badge>
  </div>
  <Input
    value={sis.local ?? ""}
    onChange={(e) => updateSistema(si, { ...sis, local: e.target.value || null })}
    placeholder="Sanca, Rasgo, Pé-direito... (deixe em branco se não aplicar)"
    maxLength={40}
    className="h-8 text-sm"
  />
</div>
```

Comportamento:
- Vazio = `null` → no PDF v2 vira pseudo-grupo "Geral" sem header
- Preenchido = string não-vazia → vira header "Local: Sanca" no PDF v2
- `e.target.value || null` normaliza string vazia para null (consistente com a leitura `sis.local ?? ""`)

## Verification

| Check | Result |
|---|---|
| Task 1 — `local?: string | null` em orcamento.ts | OK (linha 86) |
| Task 1 — `npm run build` | OK (exit 0, 50.92s, 3445 modules) |
| Task 2 — comentário `Local (opcional, Phase 5 PDF-01)` | OK (linha 361) |
| Task 2 — `local: null` em addSistema | OK (linha 65) |
| Task 2 — `value={sis.local ?? ""}` | OK (linha 368) |
| Task 2 — `npm run build` | OK (exit 0, 36.43s) |
| Task 2 — `npm run lint` | Erros pré-existentes apenas (`supabase/functions/*`, `tailwind.config.ts`) — fora do escopo desta plan |

## Files Modified

| File | Change | Lines |
|---|---|---|
| `src/types/orcamento.ts` | +2 (JSDoc + campo) | 86–87 |
| `src/components/AmbienteCard.tsx` | +16 / -1 (init + bloco input) | 65, 361–375 |

## Deviations from Plan

### Auto-fixed Issues

Nenhuma — plan executada exatamente como descrita. Sem necessidade de Rule 1/2/3 fixes.

### Authentication / UAT Gates

**Playwright MCP smoke (mencionado no plan Task 2):** não executado neste agent paralelo — o ambiente do worktree não tem dev server rodando nem ferramentas Playwright MCP (`mcp__plugin_playwright_playwright__*`) expostas. O smoke do input Local fica para a fase de UAT manual no Plan 05-05 (consistente com `nyquist_validation: false` em `.planning/config.json` — RESEARCH Wave 0 Gaps já antecipa que cobertura visual da fase é via UAT com Lenny).

Recomendação para o orchestrator/Lenny: ao final da Phase 5 (após merge das 5 plans), rodar Playwright MCP em `Index → adicionar ambiente → adicionar sistema → preencher 'Sanca' no campo Local → confirmar persistência no PDF v2`.

## Threat Flags

Nenhum. Mudança é puramente aditiva no client-side; não há novo network endpoint, auth path, ou trust boundary novo. O campo `local` é serializado dentro do mesmo jsonb `orcamentos.ambientes` que já passava por RLS existente.

## Known Stubs

Nenhum. O input Local está totalmente wired — captura via React state, persiste via fluxo já existente do Step3Revisao (`supabase.from('orcamentos').insert({ ambientes: ambientesJson })`), sem placeholder ou mock.

## Notes for Downstream Plans

- **Plan 05-04 (template v2):** ao iterar `ambiente.sistemas` no template editorial, agrupar por `sistema.local`. Sistemas com `local === null` (ou ausente em snapshot antigo) viram pseudo-grupo "Geral" sem header de Local.
- **Plan 05-05 (router + UAT):** Validar via Playwright MCP que o input persiste corretamente no jsonb e que o template v2 consome o campo.
- **Compat PDF-05:** Snapshots antigos não têm `local` → ficam undefined → renderer v1 (legacy) os ignora; renderer v2 trata como null (pseudo-grupo "Geral"). Sem regressão.

## Self-Check: PASSED

**Files exist:**
- FOUND: `src/types/orcamento.ts` (linha 86 contém `local?: string | null`)
- FOUND: `src/components/AmbienteCard.tsx` (linha 65 contém `local: null`; linha 361 contém comentário PDF-01; linha 368 contém `sis.local ?? ""`)

**Commits exist:**
- FOUND: `115336a` (feat(05-02): add optional local field to SistemaIluminacao type)
- FOUND: `d333e16` (feat(05-02): add Local (opcional) input to system form in AmbienteCard)
