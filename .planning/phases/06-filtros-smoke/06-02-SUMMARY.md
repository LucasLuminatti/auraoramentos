---
phase: 06-filtros-smoke
plan: 02
subsystem: ui
tags: [react, react-router, supabase, filter, url-state, autocomplete]

# Dependency graph
requires:
  - phase: 06-filtros-smoke
    provides: ArquitetoAutocomplete mode='filter' (Plan 01)
  - phase: 02-cadastros-arquiteto-crud
    provides: clientes.arquiteto_id schema + RLS admin
provides:
  - Filtro por arquiteto na tab Cadastros > Clientes (3 estados: Todos / arquiteto X / Nenhum)
  - URL state `?arq_clientes=<uuid|none>` (ausente = Todos), sobrevive refresh + bookmark
  - Pattern de refetch Supabase-side (`fetchClientes(arqFilter)`) reutilizável pelos Plans 03 e 04
  - Empty state diferenciado por filtro ativo (3 mensagens)
affects: [06-03-produtos-filtro, 06-04-pedidos-filtros]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL search param como source of truth para filtro de tabela (refetch dispara via effect com deps=[param])"
    - "Sentinel `none` no param URL ↔ `.is('arquiteto_id', null)` no Supabase; ausência do param ↔ sem cláusula"
    - "Effect duplo: 1 para refetch quando o filtro muda + 1 para sincronizar o display name no input do autocomplete via arquitetosMap"
    - "Função fetch refatorada para aceitar filtro opcional (arqFilter?: string | null) — retro-compat com chamada sem arg = sem filtro"

key-files:
  created: []
  modified:
    - src/pages/Admin.tsx

key-decisions:
  - "Initial mount fetchClientes movido para effect dedicado [arqClientesParam] (em vez de chamar 2x: 1x no mount + 1x no effect) — evita race + simplifica raciocínio"
  - "arqClientesNome local state sincronizado via effect a partir de (arqClientesParam + arquitetosMap) — UUID na URL vira nome legível assim que o map carrega"
  - "Empty state com 3 branches em vez de só 2 ('Nenhum cliente') para diferenciar o caso 'sem arquiteto' do caso 'arquiteto X sem clientes'"
  - "ClienteDialog onSuccess + handleDeleteCliente passam arqClientesParam explicitamente para preservar o filtro pós-mutation"

patterns-established:
  - "URL param `?arq_<scope>=<id|none>` para cada filtro de tab no Admin (D-04 do CONTEXT) — Plans 03 e 04 reproduzem trocando o nome do scope"
  - "fetchX(arqFilter) com 3 branches Supabase: `.is(null)` para 'none', `.eq()` para UUID, sem cláusula para falsy — Plans 03 e 04 reproduzem (Plan 04 usa `clientes!inner(arquiteto_id)` via JOIN)"
  - "Empty state branched: filtro ativo + UUID, filtro ativo + 'none', sem filtro — 3 mensagens distintas"

requirements-completed: [FIL-01]

# Metrics
duration: 3min
completed: 2026-05-07
---

# Phase 6 Plan 02: Filtro Arquiteto em Cadastros > Clientes Summary

**Tab Cadastros > Clientes ganhou filtro por arquiteto via `ArquitetoAutocomplete mode='filter'`, com 3 estados (Todos / arquiteto X / Nenhum), estado em URL `?arq_clientes=<uuid|none>`, refetch Supabase-side e empty state diferenciado por filtro ativo — entregando FIL-01 e estabelecendo o pattern para Plans 03/04.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-07T19:50:05Z
- **Completed:** 2026-05-07T19:53:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `ArquitetoAutocomplete mode="filter"` rendered no header da tab Clientes (à esquerda do "+ Novo Cliente"), responsivo (`flex-col sm:flex-row`)
- URL param `?arq_clientes` é a única source of truth do filtro:
  - ausente → sem filtro (lista todos os clientes)
  - `none` → `clientes.arquiteto_id IS NULL`
  - `<uuid>` → `clientes.arquiteto_id = <uuid>`
- `fetchClientes(arqFilter)` refatorado: query Supabase parametrizada conforme o param (D-07 do CONTEXT, sem filtro client-side)
- Initial mount fetchClientes removido do `useEffect-mount` e movido para effect dedicado `[arqClientesParam]` — evita 2 fetches duplicados na carga inicial
- `arqClientesNome` (display do input do autocomplete) sincronizado via effect com `arqClientesParam + arquitetosMap` — UUID em URL pasted/bookmarked vira nome legível assim que o map de arquitetos chega
- Empty state com 3 branches:
  - "Nenhum cliente cadastrado" (filtro ausente)
  - "Nenhum cliente vinculado a este arquiteto" (filtro = UUID)
  - "Nenhum cliente sem arquiteto" (filtro = `none`)
- `handleDeleteCliente` + 2 `ClienteDialog onSuccess` (create/edit) trocados de `fetchClientes` (sem arg) para `fetchClientes(arqClientesParam)` — pós-mutation o filtro é preservado
- Outras tabs (Produtos / Arquitetos / Colaboradores / Pedidos / Preços / Exceções) e o consumidor existente do `ArquitetoAutocomplete` (ClienteDialog, ProdutoEditDialog) não foram tocados — zero risco de regressão fora do escopo

## Task Commits

1. **Task 1: Filtro arquiteto em Cadastros > Clientes** — `78b56fa` (feat)

## Files Created/Modified

- `src/pages/Admin.tsx` — +80 / −10 linhas
  - Import `ArquitetoAutocomplete`
  - `arqClientesParam` derivado de `searchParams` + helper `setArqClientesParam`
  - State `arqClientesNome` para o display do autocomplete
  - 2 effects novos (`[arqClientesParam]` para refetch, `[arqClientesParam, arquitetosMap]` para sync nome)
  - `fetchClientes(arqFilter?: string | null)` refatorado com 3 branches `.is(null)` / `.eq(uuid)` / nenhum
  - UI da tab Clientes: header com 2 colunas (filtro + botão), empty state com 3 branches
  - 3 callsites de `fetchClientes()` trocados para `fetchClientes(arqClientesParam)`

## Pattern para Plans 03 e 04

### Pattern URL + fetch (mesmo nos 3 planos, trocando só o scope)

```ts
// Plan 02 (Clientes) — entregue
const arqParam = searchParams.get('arq_clientes'); // null | 'none' | uuid

const fetchClientes = async (arqFilter?: string | null) => {
  let q = supabase.from('clientes').select('...');
  if (arqFilter === 'none') q = q.is('arquiteto_id', null);
  else if (arqFilter) q = q.eq('arquiteto_id', arqFilter);
  const { data, error } = await q.order('nome');
  if (error) { toast.error('Erro ao carregar clientes'); return; }
  setClientes(data || []);
};

useEffect(() => { fetchClientes(arqParam); }, [arqParam]);
```

### Plan 03 (Produtos) — adaptação

```ts
const arqProdutosParam = searchParams.get('arq_produtos'); // mesmo shape
// fetchProdutos(search, arqFilter) — chained .eq('arquiteto_id', X) ou .is(null)
// Atenção: fetchProdutos JÁ tem search param + debounce; effect precisa depender de [produtoSearch, arqProdutosParam]
```

### Plan 04 (Pedidos) — adaptação via JOIN

```ts
const arqPedidosParam = searchParams.get('arq_pedidos');
// orcamentos não tem coluna arquiteto_id direta — JOIN com clientes (D-11):
let q = supabase.from('orcamentos').select('*, clientes!inner(nome, arquiteto_id), ...');
if (arqPedidosParam === 'none') q = q.is('clientes.arquiteto_id', null);
else if (arqPedidosParam) q = q.eq('clientes.arquiteto_id', arqPedidosParam);
```

### Pattern UI (header da tab + empty state)

```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div className="w-full sm:max-w-xs">
    <ArquitetoAutocomplete mode="filter" value={nome} onSelect={(arq, kind) => { ... }} />
  </div>
  <Button>+ Novo X</Button>
</div>

// Empty state
{lista.length === 0 && (
  <TableCell colSpan={N}>
    {arqParam
      ? (arqParam === 'none' ? 'Nenhum X sem arquiteto' : 'Nenhum X vinculado a este arquiteto')
      : 'Nenhum X cadastrado'}
  </TableCell>
)}
```

## Decisions Made

- **Initial mount fetchClientes via effect dedicado, não chamada direta:** ao remover `fetchClientes()` do `useEffect-mount` e deixar SÓ o effect com `[arqClientesParam]`, eliminamos 1 fetch duplicado na carga inicial (que sempre tem param vazio nesse momento). Trade-off: leitor precisa entender que esse effect roda no mount também — comentário inline esclarece.
- **arqClientesNome separado do arqClientesParam:** o param da URL é UUID/sentinel/null; o input do autocomplete precisa do **nome** legível. Effect que sincroniza os dois via `arquitetosMap` resolve sem precisar buscar o nome no Supabase a cada render.
- **Empty state com 3 branches:** D-Specifics do CONTEXT pediu diferenciação; a branch para `'none'` ('Nenhum cliente sem arquiteto') é um plus além da plan que melhora UX em ~5 segundos de implementação.
- **ClienteDialog onSuccess vira closure (`() => fetchClientes(arqClientesParam)`):** retorno direto de `fetchClientes` quebra a assinatura (ClienteDialog passaria `undefined` como 1º arg, o que coincidentemente seria correto, mas é frágil). Closure explícita expressa a intenção.

## Pipeline D-12 (code-review + Playwright)

### code-review skill — sobre o diff (`git diff src/pages/Admin.tsx`)

**Verdict: clean.** Itens checados:
- Type safety: `arqFilter?: string | null` cobre os 3 estados; `kind` no callback vem do contrato do Plan 01.
- Race conditions: 2 effects independentes, nenhum loop possível (`setArqClientesNome` não muda o param).
- Security T-06-02-01 (URL param como input em `.eq()`): Supabase JS parametriza — sem injection. UUID inválido = 0 rows silenciosamente (UX leve, não bug). RLS de admin segue a única fronteira real (T-06-02-02 accept).
- Regressão: `fetchClientes` callsites todos atualizados (3 sites: handleDelete + 2 dialogs); outras tabs e callers do ArquitetoAutocomplete intocados.
- A11y / responsivo: header com `flex-col sm:flex-row` cobre mobile; ícones via lucide-react; empty state texto pt-BR.

Nenhuma correção pós-review aplicada.

### Playwright MCP — **NÃO EXECUTADO**

O agente executor desta task não tinha as ferramentas `mcp__plugin_playwright_playwright__*` no toolset disponível (verificado: apenas Bash/Read/Edit/Write/Grep/Glob expostos no agent thread). Conforme regra do CLAUDE.md global ("Se não for possível testar via Playwright … avisar explicitamente em vez de assumir que funcionou"), o smoke test no navegador **fica pendente**.

**Substitutos rodados (não substitui Playwright, mas reduz risco):**
- `npx tsc --noEmit -p tsconfig.app.json` em `src/pages/Admin.tsx`: zero erros (todos os erros TS pré-existentes do projeto continuam só nos 7 arquivos legados de antes da Phase 6 — `ImportMaster`, `PrecosBatch`, `Step3Revisao`, `OrcamentoDetalhe`, `useProdutoSearch`, `ClienteArquivos`, `PrecosBatch.test`)
- `npx eslint src/pages/Admin.tsx`: 7 erros `no-explicit-any` — **idênticos a HEAD pré-diff** (verificado via `git stash` + relint). Zero warnings/erros novos.
- `curl http://localhost:8080/admin` → 200; `curl http://localhost:8080/src/pages/Admin.tsx` → módulo transformado pelo Vite com sucesso (HMR runtime + JSX compilado, sem erro do dev server) — confirma que o módulo carrega no client em runtime sem TypeError de import/syntax.

**Smoke manual a executar pelo Lenny** (substituindo o Playwright que faltou): em `http://localhost:8080/admin?tab=cadastros&sub=clientes`:
1. Confirmar que o input "Filtrar por arquiteto..." aparece à esquerda do botão "+ Novo Cliente" (header em 2 colunas em desktop).
2. Clicar no input → dropdown abre com `[Todos]` + `[Nenhum arquiteto]` + lista de arquitetos.
3. Selecionar um arquiteto X → URL muda para `?tab=cadastros&sub=clientes&arq_clientes=<uuid>`, lista refetch e mostra só clientes desse arquiteto (ou empty state "Nenhum cliente vinculado a este arquiteto").
4. Selecionar `[Nenhum arquiteto]` → URL `?...&arq_clientes=none`, lista mostra só clientes sem arquiteto (ou empty state "Nenhum cliente sem arquiteto").
5. Selecionar `[Todos]` → URL volta a `?tab=cadastros&sub=clientes` (sem `arq_clientes`), lista mostra todos.
6. Trocar para `?tab=pedidos` e voltar → filtro preservado via URL (se ainda estava setado).
7. Refresh com URL filtrada → filtro sobrevive.
8. Editar/deletar cliente via dialog → após sucesso, lista refetch com o filtro preservado.
9. Console JS sem erros novos.

## Deviations from Plan

None na implementação. Única deviation de **processo** documentada acima: Playwright MCP não rodou por falta de ferramenta (ver seção Pipeline D-12 — Playwright NÃO EXECUTADO). Code-review (D-12 obrigatório) foi executado.

## Issues Encountered

- **ESLint warning sobre `eslint-disable-next-line` desnecessário:** ao adicionar a diretiva `// eslint-disable-next-line react-hooks/exhaustive-deps` no effect `[arqClientesParam]`, o ESLint reclamou que era unused (a regra não estava acusando nada). Removida a diretiva — o effect só usa `arqClientesParam` como dep, que está corretamente declarada. Fix aplicado pré-commit.

## User Setup Required

None — mudança puramente UI (frontend). Sem migration, sem env var, sem config externa.

## Next Phase Readiness

- ✅ Pattern URL `?arq_<scope>=<id|none>` documentado e funcional
- ✅ Pattern fetch refatorado com 3 branches Supabase pronto para reuso
- ✅ Pattern UI (header 2 colunas + empty state branched) pronto para reuso
- ⏭️ Plan 03 (Cadastros > Produtos): aplicar mesmo pattern, atenção ao search debounce já existente em fetchProdutos (effect deps = `[produtoSearch, arqProdutosParam]`)
- ⏭️ Plan 04 (Pedidos): mesmo pattern + JOIN `clientes!inner(arquiteto_id)` (D-11) + filtros adicionais (cliente / período / status) per D-05
- ⏭️ Plan 05 (Smoke / WRAP-01): item #8 do checklist (D-09) cobre validação real de FIL-01 em produção; este SUMMARY documenta o pattern para o autor do UAT puxar

## Self-Check: PASSED

- ✅ `src/pages/Admin.tsx` modificado e committed (`78b56fa`)
- ✅ Commit `78b56fa` existe (`git log --oneline | grep 78b56fa`)
- ✅ Acceptance criteria do PLAN verificados via grep:
  - 6 matches de `arq_clientes` (>= 3 ✓)
  - 1 match de `searchParams.get("arq_clientes")` ✓
  - 1 instância de `<ArquitetoAutocomplete mode="filter"` ✓
  - 3 mensagens de empty state presentes ✓
  - 1 `.eq("arquiteto_id"` + 1 `.is("arquiteto_id", null)` ✓
  - 4 callsites de `fetchClientes(arqClientesParam)` (>= 2 ✓)
- ✅ TypeScript clean em `src/pages/Admin.tsx` (zero erros novos; 0 erros antigos)
- ✅ ESLint sem regressão em `src/pages/Admin.tsx` (7 erros `no-explicit-any` idênticos a HEAD pré-diff)
- ✅ Outras tabs e ArquitetoAutocomplete callers existentes não tocados (verificado via diff)
- ⚠️ Playwright MCP smoke pendente (ferramenta não disponível neste agent thread) — caminho substituto: smoke manual do Lenny em `/admin?tab=cadastros&sub=clientes` conforme checklist da seção Pipeline D-12

---
*Phase: 06-filtros-smoke*
*Completed: 2026-05-07*
