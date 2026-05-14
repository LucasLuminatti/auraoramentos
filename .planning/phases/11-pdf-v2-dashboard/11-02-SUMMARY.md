---
phase: 11-pdf-v2-dashboard
plan: "02"
subsystem: admin-dashboard
tags: [dashboard, kpi-cleanup, tanstack-query, orcamentos-em-aberto]
dependency_graph:
  requires: []
  provides: [AdminDashboard-DASH-01]
  affects: [src/components/AdminDashboard.tsx]
tech_stack:
  added: [useQuery from @tanstack/react-query, FileClock from lucide-react]
  patterns: [TanStack Query useQuery, useMemo client-side aggregation]
key_files:
  modified:
    - src/components/AdminDashboard.tsx
decisions:
  - "Removidos 6 cards KPI (Receita Efetiva/Prevista/Pipeline/Ticket Médio/Conversão/Ciclo Médio) + useMemo kpis completo"
  - "Adicionado card único 'Orçamentos em Aberto' com useQuery + useMemo de agregação"
  - "Icon escolhido: FileClock (decorativo — combina orçamento + tempo em aberto)"
  - "Paleta: border-l-4 border-l-primary (design token, sem cor hardcoded)"
  - "fechado_at removido da interface local Orcamento (campo órfão após remoção do useMemo kpis)"
  - "Label 'Top 5 Clientes por Receita Fechada' renomeada para 'Top 5 Clientes por Receita Aprovada' (D-13)"
metrics:
  duration: ~8min
  completed_date: "2026-05-14"
  tasks_completed: 3
  files_modified: 1
---

# Phase 11 Plan 02: Dashboard DASH-01 — Card Único "Orçamentos em Aberto" Summary

**One-liner:** Substituídos 6 cards KPI defasados por 1 card "Orçamentos em Aberto" com useQuery TanStack + agregação rascunho/pendente/total client-side.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remover 6 KPI cards + useMemo kpis + imports órfãos + rename label | `804a06f` | AdminDashboard.tsx |
| 2 | Adicionar card "Orçamentos em Aberto" via useQuery | `804a06f` | AdminDashboard.tsx |
| 3 | Smoke: lint + build + tests | (no commit) | — |

*Tasks 1 e 2 foram escritas atomicamente em um único Write, capturadas no mesmo commit.*

## Diff Summary

### Imports antes → depois

**lucide-react (l.5):**
```diff
- import { DollarSign, TrendingUp, Target, BarChart3, Clock, Trophy, ThumbsDown } from "lucide-react";
+ import { Trophy, ThumbsDown, FileClock } from "lucide-react";
```

**date-fns (l.6):**
```diff
- import { differenceInDays, subDays, startOfMonth, subMonths, format, isAfter } from "date-fns";
+ import { subDays, startOfMonth, subMonths, format, isAfter } from "date-fns";
```

**Novos imports adicionados:**
```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
```

### useMemo kpis removido (l.59-102)

Bloco completo de ~44 linhas removido — calculava `receitaEfetiva`, `receitaPrevista`, `pipeline`, `ticketMedio`, `taxaConversao`, `cicloMedio` (todos órfãos após remoção dos cards).

### const cards removido (l.156-163)

Array de 6 items mapeando KPI para icon removido.

### Grid de KPI cards removido (l.182-195)

```diff
- {/* KPI Cards */}
- <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
-   {cards.map((c) => ( ... ))}
- </div>
```

### Campo órfão removido da interface

```diff
- fechado_at?: string | null;
```

(`fechado_at` era usado apenas pelo `cicloMedio` — removido junto com o useMemo.)

### Label renomeada (D-13)

```diff
- Top 5 Clientes por Receita Fechada
+ Top 5 Clientes por Receita Aprovada
```

### Card "Orçamentos em Aberto" adicionado

```typescript
// Hook
const { data: emAberto, isLoading: emAbertoLoading } = useQuery({
  queryKey: ['orcamentos-em-aberto'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('orcamentos')
      .select('status, valor')
      .in('status', ['rascunho', 'pendente']);
    if (error) throw error;
    return data ?? [];
  },
});

const emAbertoTotais = useMemo(() => {
  const rascunho = (emAberto ?? [])
    .filter((o) => o.status === 'rascunho')
    .reduce((s, o) => s + Number(o.valor ?? 0), 0);
  const pendente = (emAberto ?? [])
    .filter((o) => o.status === 'pendente')
    .reduce((s, o) => s + Number(o.valor ?? 0), 0);
  return { rascunho, pendente, total: rascunho + pendente };
}, [emAberto]);
```

```jsx
{/* Orçamentos em Aberto (DASH-01) */}
<Card className="border-l-4 border-l-primary">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
    <CardTitle className="text-sm font-medium">Orçamentos em Aberto</CardTitle>
    <FileClock className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Rascunho</span>
      <span className="font-medium">{emAbertoLoading ? '—' : formatCurrency(emAbertoTotais.rascunho)}</span>
    </div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Pendente</span>
      <span className="font-medium">{emAbertoLoading ? '—' : formatCurrency(emAbertoTotais.pendente)}</span>
    </div>
    <div className="border-t pt-2 flex items-center justify-between">
      <span className="font-semibold">Total</span>
      <span className="text-lg font-bold">{emAbertoLoading ? '—' : formatCurrency(emAbertoTotais.total)}</span>
    </div>
  </CardContent>
</Card>
```

## Claude's Discretion Choices

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Icon do card | `FileClock` | Combina orçamento (File) + tempo em aberto (Clock); disponível em lucide-react |
| Paleta | `border-l-4 border-l-primary` | Design token nativo shadcn — destaque sem cor hardcoded |
| Loading state | `'—'` (dash) | Discreto, não quebra layout; consistente com padrões do projeto |
| staleTime | padrão TanStack (0ms) | Fresh em cada abertura do dashboard — D-14 não especificou staleTime customizado |

## queryKey

`['orcamentos-em-aberto']` — estável, sem deps dinâmicas. Revalida em cada mount (staleTime default = 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Residual `fechado` no arquivo via campo `fechado_at`**
- **Found during:** Verificação pós-edição (check `fechado` case-insensitive)
- **Issue:** Interface local `Orcamento` ainda continha `fechado_at?: string | null` — campo usado apenas pelo `useMemo kpis` (removido). Causaria falha no critério "zero ocorrências de fechado"
- **Fix:** Removido `fechado_at` da interface local (coluna existe no banco mas não é mais consumida por este componente)
- **Files modified:** `src/components/AdminDashboard.tsx`
- **Commit:** `804a06f`

## Smoke Results (Task 3)

| Check | Result |
|-------|--------|
| `npm run lint` | PASSED — 0 erros/warnings |
| `npm run build` | PASSED — exit 0, 3460 modules transformed |
| `npm run test -- --run` | PASSED — 55/55 testes |

## Known Stubs

Nenhum. Card "Orçamentos em Aberto" busca dados reais via useQuery; empty state (R$ 0,00) é tratado via `Number(o.valor ?? 0)` com fallback natural do reduce.

## Threat Flags

Nenhum. Query nova (`SELECT status, valor FROM orcamentos WHERE status IN (...)`) está dentro do trust boundary documentado no PLAN.md (T-11-04 a T-11-07, todos `accept` ou `mitigate` já registrados).

## Self-Check: PASSED

- `src/components/AdminDashboard.tsx` existe e contém as mudanças esperadas
- Commit `804a06f` existe em `git log`
- lint + build + tests passaram
