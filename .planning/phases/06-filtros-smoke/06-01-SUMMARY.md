---
phase: 06-filtros-smoke
plan: 01
subsystem: ui
tags: [react, shadcn, autocomplete, filter, lucide-react, supabase]

# Dependency graph
requires:
  - phase: 02-cadastros-arquiteto-crud
    provides: ArquitetoAutocomplete (mode='select' base com [Nenhum arquiteto])
provides:
  - ArquitetoAutocomplete com prop opcional `mode: 'select' | 'filter'` (default 'select')
  - Em mode='filter', dropdown prepend `[Todos]` (ícone ListFilter) acima de `[Nenhum arquiteto]` (ícone X)
  - Callback `onSelect` aceita 2º argumento opcional `kind: 'arquiteto' | 'none' | 'all'` para desambiguar `null`
  - Retro-compatibilidade total: ClienteDialog e ProdutoEditDialog não tocados, kind ignorado pelos callers atuais
affects: [06-02-clientes-filtro, 06-03-produtos-filtro, 06-04-pedidos-filtros]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prop opcional com default no corpo (`const m = mode ?? 'select'`) — retrocompat sem refatorar callers"
    - "Sentinel via 2º argumento opcional do callback — distingue null-significados sem trocar o tipo do 1º arg"

key-files:
  created: []
  modified:
    - src/components/ArquitetoAutocomplete.tsx

key-decisions:
  - "Prop default='select' tratado dentro do componente (não no destructuring) — preserva tipo `mode?:` opcional sem default truthy ambíguo"
  - "Ícone do [Todos] = ListFilter (lucide-react) para distinção visual de [Nenhum arquiteto] (X)"
  - "Callback estendido com 2º arg opcional em vez de criar variante onFilter — mantém 1 componente, 1 prop name"

patterns-established:
  - "Componentes reusáveis com modo dual (select vs filter) via prop opcional, sem duplicação"
  - "Sentinel kind no callback ('arquiteto' | 'none' | 'all') — desambigua null sem trocar shape do payload"

requirements-completed: [FIL-01, FIL-02, FIL-03]

# Metrics
duration: 1min
completed: 2026-05-07
---

# Phase 6 Plan 01: ArquitetoAutocomplete mode='filter' Summary

**Componente ArquitetoAutocomplete estendido com prop opcional `mode='filter'` que prepend `[Todos]` no dropdown e desambigua o callback via 2º argumento `kind`, sem tocar nos 2 callers existentes (ClienteDialog, ProdutoEditDialog).**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-07T19:45:20Z
- **Completed:** 2026-05-07T19:46:42Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Prop `mode?: 'select' | 'filter'` adicionada (default 'select')
- Opção `[Todos]` aparece SOMENTE em mode='filter', no topo do dropdown, com ícone `ListFilter`
- Callback `onSelect` agora aceita `kind: 'arquiteto' | 'none' | 'all'` como 2º argumento opcional
- ClienteDialog (linha 132) e ProdutoEditDialog (linha 289) seguem funcionando sem mudança — TypeScript valida a retro-compatibilidade
- Foundation pronta para Plans 02/03/04 (filtros nas tabs Cadastros > Clientes, Cadastros > Produtos, Pedidos)

## Task Commits

1. **Task 1: Estender ArquitetoAutocomplete com prop mode + opção [Todos] + kind no callback** — `18de780` (feat)

## Files Created/Modified

- `src/components/ArquitetoAutocomplete.tsx` — adicionada prop `mode`, item `[Todos]` condicional, callback estendido com `kind`

## API Nova do Componente

### Tipos exportados/internos

```ts
export interface ArquitetoOption {
  id: string;
  nome: string;
}

interface ArquitetoAutocompleteProps {
  value: string;
  onSelect: (
    arquiteto: ArquitetoOption | null,
    kind?: 'arquiteto' | 'none' | 'all'
  ) => void;
  placeholder?: string;
  className?: string;
  mode?: 'select' | 'filter';  // default 'select'
}
```

### Semântica do callback

| Cenário | 1º arg | 2º arg (`kind`) | Disponível em |
|---------|--------|------------------|---------------|
| Usuário escolheu um arquiteto | `ArquitetoOption` | `'arquiteto'` | select + filter |
| Usuário escolheu "[Nenhum arquiteto]" | `null` | `'none'` | select + filter |
| Usuário escolheu "[Todos]" (limpa filtro) | `null` | `'all'` | filter ONLY |

Em `mode='select'` o segundo arg ainda é passado (`'arquiteto'` ou `'none'`), mas os callers atuais ignoram (TypeScript permite — assinatura mais larga é aceitável para callers com assinatura mais estreita).

## Exemplos de Uso

### Modo `select` (uso atual em forms — não muda)

```tsx
// ClienteDialog.tsx / ProdutoEditDialog.tsx (já funcionando, não foi tocado)
<ArquitetoAutocomplete
  value={arquitetoNome}
  onSelect={(arq) => {
    if (arq === null) {
      setArquitetoId(null);
      setArquitetoNome("");
    } else {
      setArquitetoId(arq.id);
      setArquitetoNome(arq.nome);
    }
  }}
  placeholder="Buscar arquiteto..."
/>
```

### Modo `filter` (Plans 02/03/04)

```tsx
// Padrão para Cadastros > Clientes (Plan 02)
<ArquitetoAutocomplete
  mode="filter"
  value={filtroNome}
  onSelect={(arq, kind) => {
    if (kind === 'all') {
      // Remove o param da URL: ?arq_clientes desaparece
      setSearchParams((sp) => { sp.delete('arq_clientes'); return sp; });
      setFiltroNome("");
    } else if (kind === 'none') {
      // Filtra arquiteto_id IS NULL: ?arq_clientes=none
      setSearchParams((sp) => { sp.set('arq_clientes', 'none'); return sp; });
      setFiltroNome("(sem arquiteto)");
    } else if (arq) {
      // Filtra arquiteto_id = arq.id: ?arq_clientes=<uuid>
      setSearchParams((sp) => { sp.set('arq_clientes', arq.id); return sp; });
      setFiltroNome(arq.nome);
    }
  }}
  placeholder="Filtrar por arquiteto..."
/>
```

### Tradução para query Supabase (referência D-07 do CONTEXT)

```ts
const arqParam = searchParams.get('arq_clientes'); // null | 'none' | uuid

let q = supabase.from('clientes').select('id, nome, arquitetos(nome)');
if (arqParam === 'none') {
  q = q.is('arquiteto_id', null);
} else if (arqParam) {
  q = q.eq('arquiteto_id', arqParam);
}
// arqParam === null → sem .eq(), retorna todos (sentinel "[Todos]")
```

## Contratos para Plans 02/03/04

- **Plan 02 (Cadastros > Clientes):** importar `ArquitetoAutocomplete` com `mode="filter"`, ler/escrever `?arq_clientes=<id|none>`, filtro Supabase `.eq('arquiteto_id', id)` ou `.is('arquiteto_id', null)` ou ausente.
- **Plan 03 (Cadastros > Produtos):** idem, com `?arq_produtos=<id|none>` filtrando `produtos.arquiteto_id`.
- **Plan 04 (Pedidos):** `?arq_pedidos=<id|none>` filtrando via JOIN `clientes!inner(arquiteto_id)` (D-11 do CONTEXT — sem coluna direta em `orcamentos`).

Em todos os 3, ao receber `kind === 'all'`: deletar o param da URL (URL limpa quando filtro tá desligado, conforme D-04).

## Decisions Made

- **`const m = mode ?? 'select'` no corpo, não no destructuring:** preserva o tipo `mode?:` como opcional (não deduzido como `'select'` quando omitido) — backward-compat sem sinalizar default truthy ambíguo no nível de tipo.
- **Ícone `ListFilter` para [Todos]:** distinção visual clara do `X` usado em [Nenhum arquiteto]. Lucide-react já importado no projeto.
- **2º argumento opcional ao callback (em vez de prop `onFilter` separada):** mantém 1 prop name (`onSelect`), 1 import, 1 mental model. TypeScript com `strict: false` (já config do projeto) tolera callers que ignoram o 2º arg.

## Deviations from Plan

None — plan executado exatamente como escrito.

## Issues Encountered

None. Os erros TypeScript pré-existentes em `ImportMaster.tsx`, `PrecosBatch.tsx`, `Step3Revisao.tsx`, `OrcamentoDetalhe.tsx`, `useProdutoSearch.ts`, `ClienteArquivos.tsx`, `PrecosBatch.test.tsx` são independentes deste plan (existem desde antes da Phase 6) — `tsconfig.app.json` excluí-los do scope dos arquivos do plan; verifier `! grep -E "src/components/(ArquitetoAutocomplete|ClienteDialog|ProdutoEditDialog)\.tsx.*error"` confirmou ausência de regressão nos 3 arquivos relevantes.

## User Setup Required

None — mudança puramente UI, sem env vars, sem migration, sem config externa.

## Next Phase Readiness

- ✅ Plans 02, 03, 04 podem importar `ArquitetoAutocomplete mode="filter"` direto
- ✅ Padrão de URL params (`?arq_<scope>=<id|none>`) documentado no exemplo de uso
- ✅ Padrão de query Supabase (`.eq` / `.is null` / ausente) documentado
- Smoke test (Plan 05 / WRAP-01) precisa cobrir item #8 do checklist do CONTEXT (D-09) — filtrar Clientes / Pedidos por arquiteto

## Self-Check: PASSED

- ✅ `src/components/ArquitetoAutocomplete.tsx` modificado e committed
- ✅ Commit `18de780` existe (`git log --oneline | grep 18de780`)
- ✅ Acceptance criteria patterns verificados via grep
- ✅ TypeScript sem regressão nos 3 arquivos relevantes (ArquitetoAutocomplete + ClienteDialog + ProdutoEditDialog)
- ✅ ESLint clean nos 3 arquivos
- ✅ ClienteDialog e ProdutoEditDialog não foram tocados (`git diff` retorna 0 linhas)

---
*Phase: 06-filtros-smoke*
*Completed: 2026-05-07*
