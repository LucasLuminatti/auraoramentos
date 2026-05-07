---
phase: 06-filtros-smoke
plan: 03
subsystem: ui
tags: [react, react-router, supabase, filter, url-state, autocomplete, search-and-filter]

# Dependency graph
requires:
  - phase: 06-filtros-smoke
    provides: ArquitetoAutocomplete mode='filter' (Plan 01)
  - phase: 06-filtros-smoke
    provides: URL+fetch+UI pattern (Plan 02)
  - phase: 03-produtos-importacao
    provides: product_variants.arquiteto_id schema + RLS admin
provides:
  - Filtro por arquiteto na tab Cadastros > Produtos (3 estados: Todos / arquiteto X / Nenhum)
  - URL state `?arq_produtos=<uuid|none>` (ausente = Todos), sobrevive refresh + bookmark
  - Pattern de combinação search + filter (AND-chained na mesma query Supabase) — model para Plan 04 (Pedidos com mais filtros adicionais)
  - Empty state diferenciado por filtro ativo + search (4 mensagens)
affects: [06-04-pedidos-filtros]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Combinação search.or() + arquiteto.eq()/.is() AND-chained na mesma query Supabase (filtros independentes, opcionais, encadeados)"
    - "Effect debounce com 2 deps: [produtoSearch, arqProdutosParam] — single source de fetch para a tabela Produtos"
    - "Initial fetch movido do useEffect-mount para o effect de debounce — evita 2 fetches duplicados na carga inicial (mesmo trade-off do Plan 02)"

key-files:
  created:
    - .planning/phases/06-filtros-smoke/06-03-SUMMARY.md
  modified:
    - src/pages/Admin.tsx

key-decisions:
  - "Initial mount fetchProdutos('') removido do useEffect-mount; o debounce effect [produtoSearch, arqProdutosParam] cobre o mount também — evita race + simplifica raciocínio (mesma decisão do Plan 02)"
  - "Effect de sync de arqProdutosNome separado do effect de debounce — UUID na URL vira nome legível assim que arquitetosMap carrega, sem refetch extra"
  - "Empty state com 4 branches em vez de 3 (search+filter, filter só, search só, nenhum) — Plan 02 tinha 3 porque não tinha search; Plan 04 vai precisar de matriz ainda maior por causa de cliente+período+status"
  - "ProdutoEditDialog onSuccess vira closure (`() => fetchProdutos(produtoSearch, arqProdutosParam)`) — preserva search E filtro pós-mutation"

patterns-established:
  - "Search debounce + filtro arquiteto unificados num único effect com deps=[search, arqParam] — Plan 04 (Pedidos) reproduz adicionando mais filtros como deps no mesmo effect"
  - "Sentinel `none`/`null`/UUID com 3 branches (`.is(null)` / `.eq(uuid)` / sem cláusula) acumula com a query base — Plan 04 usa o mesmo shape com JOIN `clientes!inner(arquiteto_id)`"

requirements-completed: [FIL-02]

# Metrics
duration: 2min
completed: 2026-05-07
---

# Phase 6 Plan 03: Filtro Arquiteto em Cadastros > Produtos Summary

**Tab Cadastros > Produtos ganhou filtro por arquiteto via `ArquitetoAutocomplete mode='filter'`, combinado AND com a busca por código/descrição já existente — URL `?arq_produtos=<uuid|none>`, refetch Supabase-side com `.or()` (search) + `.eq()`/.is() (arquiteto), empty state com 4 branches — entregando FIL-02 e estabelecendo o pattern de combinação search+filter para o Plan 04 (Pedidos).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-07T19:57:02Z
- **Completed:** 2026-05-07T19:59:21Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `ArquitetoAutocomplete mode="filter"` rendado no header da tab Produtos, à esquerda do "+ Novo Produto", convivendo com o input de busca por código/descrição existente
- Layout do header refatorado para `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` — search ocupa a primeira "coluna", filtro+botão a segunda; responsivo para mobile
- URL param `?arq_produtos` é a única source of truth do filtro arquiteto na tab Produtos:
  - ausente → sem filtro (lista todos os produtos, possivelmente filtrados só por search)
  - `none` → `product_variants.arquiteto_id IS NULL`
  - `<uuid>` → `product_variants.arquiteto_id = <uuid>`
- `fetchProdutos(search, arqFilter)` refatorado: agora aceita 2 critérios, encadeados na mesma query Supabase (D-07 do CONTEXT, sem filtro client-side):
  - `if (search.trim().length >= 2)` → `.or('codigo.ilike.%X%,descricao.ilike.%X%')` (pré-existente)
  - `if (arqFilter === 'none')` → `.is('arquiteto_id', null)` (novo)
  - `else if (arqFilter)` → `.eq('arquiteto_id', arqFilter)` (novo)
  - Filtros opcionais e independentes; AND-chain natural via PostgREST
- `useEffect-mount` simplificado: `fetchProdutos('')` removido; o effect de debounce `[produtoSearch, arqProdutosParam]` cobre o mount também (1 fetch único na carga inicial)
- `arqProdutosNome` (display do input do autocomplete Produtos) sincronizado via effect com `arqProdutosParam + arquitetosMap` — UUID em URL pasted/bookmarked vira nome legível assim que o map de arquitetos chega
- Empty state com 4 branches:
  - "Nenhum produto encontrado" (filtro ausente — search só ou nada)
  - "Nenhum produto vinculado a este arquiteto" (filtro = UUID, sem search)
  - "Nenhum produto deste arquiteto bate com a busca" (filtro = UUID + search)
  - "Nenhum produto sem arquiteto" (filtro = `none`, sem search)
  - "Nenhum produto sem arquiteto bate com a busca" (filtro = `none` + search)
- 2 `ProdutoEditDialog onSuccess` (create/edit) trocados de `fetchProdutos(produtoSearch)` para `fetchProdutos(produtoSearch, arqProdutosParam)` — pós-mutation tanto search quanto filtro são preservados
- Outras tabs (Clientes / Arquitetos / Colaboradores / Pedidos / Preços / Exceções), `ArquitetoAutocomplete` (assinatura), e o filtro de Clientes do Plan 02 não foram tocados — zero risco de regressão fora do escopo

## Task Commits

1. **Task 1: Filtro arquiteto em Cadastros > Produtos** — `0d5af92` (feat)

## Files Created/Modified

- `src/pages/Admin.tsx` — +71 / −11 linhas
  - `arqProdutosParam` derivado de `searchParams` + helper `setArqProdutosParam`
  - State `arqProdutosNome` para o display do autocomplete
  - 1 effect novo `[arqProdutosParam, arquitetosMap]` para sync nome
  - Effect de debounce existente atualizado: `[produtoSearch, arqProdutosParam]`
  - `fetchProdutos(search: string, arqFilter?: string | null)` com 3 branches `.is(null)` / `.eq(uuid)` / nenhum
  - `useEffect-mount` aliviado: `fetchProdutos('')` removido
  - UI da tab Produtos: header em 2 colunas (search à esquerda, filtro+botão à direita), empty state com 4-branch ternary
  - 2 callsites de `fetchProdutos(produtoSearch)` trocados para `fetchProdutos(produtoSearch, arqProdutosParam)`

## Pattern para Plan 04 (Pedidos)

### Search + Filter combinados (estabelecido aqui)

```ts
// Plan 03 (Produtos) — entregue
const arqParam = searchParams.get('arq_produtos');

const fetchProdutos = async (search: string, arqFilter?: string | null) => {
  let q = supabase.from('product_variants').select('...');
  if (search.trim().length >= 2) {
    q = q.or(`codigo.ilike.%${search}%,descricao.ilike.%${search}%`);
  }
  if (arqFilter === 'none') q = q.is('arquiteto_id', null);
  else if (arqFilter) q = q.eq('arquiteto_id', arqFilter);
  const { data } = await q.order('codigo').limit(100);
  setProdutos(data || []);
};

// Effect único com todas as deps
useEffect(() => {
  const t = setTimeout(() => fetchProdutos(produtoSearch, arqParam), 300);
  return () => clearTimeout(t);
}, [produtoSearch, arqParam]);
```

### Plan 04 (Pedidos) — adaptação com mais filtros + JOIN

```ts
const arqPedidosParam = searchParams.get('arq_pedidos');
const cliPedidosParam = searchParams.get('cli_pedidos');
const dataDe = searchParams.get('de');
const dataAte = searchParams.get('ate');
const statusParam = searchParams.get('status');

let q = supabase.from('orcamentos').select('*, clientes!inner(nome, arquiteto_id), ...');
// Arquiteto via JOIN (D-11) — orcamentos não tem coluna direta
if (arqPedidosParam === 'none') q = q.is('clientes.arquiteto_id', null);
else if (arqPedidosParam) q = q.eq('clientes.arquiteto_id', arqPedidosParam);
// Cliente direto
if (cliPedidosParam) q = q.eq('cliente_id', cliPedidosParam);
// Período
if (dataDe) q = q.gte('data', dataDe);
if (dataAte) q = q.lte('data', dataAte);
// Status
if (statusParam) q = q.eq('status', statusParam);

// Effect com todas as deps
useEffect(() => {
  fetchOrcamentos(arqPedidosParam, cliPedidosParam, dataDe, dataAte, statusParam);
}, [arqPedidosParam, cliPedidosParam, dataDe, dataAte, statusParam]);
```

### Empty state matrix

Plan 03 tem 5 ramos (incluindo o caso "filter+search ambos vazios" que é o "encontrado"). Plan 04 vai escalar para mais combinações; sugestão de simplificação: testar `(arqParam || cliParam || dataDe || dataAte || statusParam)` como "tem algum filtro ativo" e diferenciar de "lista vazia sem filtro nenhum" — não tentar enumerar todas as 32 combinações.

## Decisions Made

- **Initial mount fetchProdutos removido, único fetch via debounce effect:** mesma decisão arquitetural do Plan 02 — mantém um único caminho de fetch na carga (debounce com timeout 300ms ainda dispara o request imediatamente porque a primeira render já tem `produtoSearch=''` e o param da URL). Trade-off mínimo: 300ms de delay no primeiro paint da tabela. Aceitável.
- **Empty state com 4 ramos (vs 3 do Plan 02):** Plan 02 não tinha search, só filtro; Plan 03 tem ambos. A diferenciação extra ("bate com a busca" vs "sem produtos") ajuda o admin a identificar se o filtro está confundindo a busca ou se o arquiteto realmente não tem produtos.
- **AND-chain natural via PostgREST:** Supabase JS encadeia `.or()` e `.eq()` como `WHERE (codigo ILIKE x OR descricao ILIKE x) AND arquiteto_id = y` — comportamento que já é o esperado (D-07 do CONTEXT confirma). Sem tunings extras.
- **`whitespace-nowrap` no botão "+ Novo Produto":** com o filtro adicionado à direita, em viewport apertado o botão poderia quebrar de linha. Manter num único line é UX limpo.

## Pipeline D-12 (code-review + Playwright)

### code-review skill — sobre o diff (`git diff src/pages/Admin.tsx`)

**Verdict: clean.** Itens checados:
- Type safety: `arqFilter?: string | null` cobre os 3 estados; novo callback respeita o contrato `kind` do Plan 01.
- Race conditions: 2 effects independentes (debounce + sync nome); `setArqProdutosNome` não muda o param, sem loop possível. Combinação com `produtoSearch` (state local) é coerente: typing rápido cancela timers anteriores via cleanup.
- Security T-06-03-01 (URL param em `.eq`): Supabase JS parametriza, UUID inválido = 0 rows silenciosamente (admin only via RLS). T-06-03-02 (search em `.or()` interpolado): pré-existente, fora de escopo (admin role + RLS).
- Regressão: `fetchProdutos` callsites todos atualizados (3 callers totais: 1 effect + 2 dialog onSuccess); o effect de mount ainda chama `fetchColaboradores`, `fetchOrcamentos`, `fetchArquitetos` (não tocados); outras tabs intocadas.
- A11y / responsivo: header com `flex-col sm:flex-row` cobre mobile; ícones via lucide-react; placeholder pt-BR; empty state texto pt-BR.
- Plan 02 (Clientes) intacto: filtros `arq_clientes` e o `<ArquitetoAutocomplete mode="filter">` da tab Clientes não foram tocados (verificado via diff).

Nenhuma correção pós-review aplicada.

### Playwright MCP — **NÃO EXECUTADO**

Mesma situação do Plan 02: o agente executor desta task não tem `mcp__plugin_playwright_playwright__*` no toolset disponível. Por instrução explícita do orchestrator no prompt deste plan ("Playwright MCP is not available in this subagent; substitute with tsc + lint + a manual Vite render check (curl). The orchestrator will run Playwright validation after Wave 5"), o smoke no navegador fica delegado ao Wave 5.

**Substitutos rodados:**
- `npx tsc --noEmit -p tsconfig.app.json` em `src/pages/Admin.tsx`: **0 erros novos** (verificado via `grep "src/pages/Admin.tsx" wc -l = 0`). Erros TS pré-existentes continuam só nos 7 arquivos legados de antes da Phase 6 (`ImportMaster`, `PrecosBatch`, `PrecosBatch.test`, `Step3Revisao`, `OrcamentoDetalhe`, `useProdutoSearch`, `ClienteArquivos`).
- `npx eslint src/pages/Admin.tsx`: 7 erros `no-explicit-any` — **idênticos a HEAD pré-diff** (mesmas linhas que estavam em produção antes da phase 6). Zero warnings/erros novos.
- `curl http://localhost:8080/admin` → 200; `curl http://localhost:8080/src/pages/Admin.tsx` → 200 — Vite dev server compila e serve o módulo Admin.tsx sem erro de syntax/import.

**Smoke manual a executar pelo Lenny no Wave 5** (em `http://localhost:8080/admin?tab=cadastros&sub=produtos`):
1. Confirmar header: input "Buscar produto..." à esquerda + "Filtrar por arquiteto..." à direita do "+ Novo Produto" (desktop em 1 linha; mobile em coluna).
2. Selecionar arquiteto X → URL `?...&arq_produtos=<uuid>`, lista refetch e mostra só variants desse arquiteto.
3. Sem limpar filtro, digitar SKU ex: `AU0` → lista combina filtro + search (intersecção).
4. Limpar search (input vazio), filtro mantém-se → lista volta a mostrar todos os variants do arquiteto.
5. Selecionar `[Nenhum arquiteto]` → URL `?...&arq_produtos=none`, lista mostra variants sem arquiteto.
6. Selecionar `[Todos]` → URL volta a `?tab=cadastros&sub=produtos`, lista mostra todos.
7. URL com `?tab=cadastros&sub=produtos&arq_produtos=<uuid>` carrega filtrado direto (refresh + bookmark).
8. Editar produto via Pencil → após salvar, lista refetch e filtro+search preservados.
9. Trocar para sub-tab Clientes → filtro de Clientes (Plan 02) ainda funcional, sem interferência.
10. Console JS sem erros novos.

## Deviations from Plan

None na implementação. Única deviation de **processo** documentada: Playwright MCP não rodou (instrução explícita do orchestrator + ferramenta indisponível neste agent thread). Code-review (D-12 obrigatório) foi executado.

## Issues Encountered

Nenhum. O pattern do Plan 02 (URL+fetch+UI) replicou limpo para Produtos com a única adaptação esperada: combinar com o search debounce já existente.

## User Setup Required

None — mudança puramente UI (frontend). Sem migration, sem env var, sem config externa.

## Next Phase Readiness

- ✅ Pattern URL `?arq_<scope>=<id|none>` replicado e funcional em 2 tabs (Clientes + Produtos)
- ✅ Pattern de combinação search+filter (AND-chained na mesma query) estabelecido — pronto para Plan 04 escalar para 4+ filtros (arquiteto + cliente + período + status)
- ✅ Pattern de empty state branched por filtro+search ativos pronto para reuso
- ⏭️ Plan 04 (Pedidos): mesmo pattern + JOIN `clientes!inner(arquiteto_id)` (D-11) + filtros adicionais (cliente / período / status) per D-05 + popover "Filtros" para mobile per D-06
- ⏭️ Plan 05 (Smoke / WRAP-01): item #8 do checklist (D-09) cobre validação real de FIL-01..04 em produção; este SUMMARY documenta o pattern para o autor do UAT puxar

## Self-Check: PASSED

- ✅ `src/pages/Admin.tsx` modificado e committed (`0d5af92`)
- ✅ Commit `0d5af92` existe (verificado via `git log`)
- ✅ Acceptance criteria do PLAN verificados via grep:
  - 6 matches de `arq_produtos` em Admin.tsx (>= 3 ✓)
  - 2 instâncias de `mode="filter"` (Clientes + Produtos) — equivalente ao critério "regex retorna 2"
  - 1 match `Nenhum produto vinculado a este arquiteto` ✓
  - 2 matches `Nenhum produto sem arquiteto` (com e sem busca) ✓
  - 1 match `Nenhum produto encontrado` (preservado) ✓
  - 3 matches `fetchProdutos(produtoSearch, arqProdutosParam)` (>= 2 ✓ — 1 effect + 2 onSuccess)
  - 1 match `fetchProdutos = async (search: string, arqFilter` (assinatura nova ✓)
  - `npx tsc --noEmit -p tsconfig.app.json` — zero erros em Admin.tsx
  - `npx eslint src/pages/Admin.tsx` — 7 erros `no-explicit-any` idênticos a HEAD pré-diff (zero regressão)
- ✅ Vite dev server serve `src/pages/Admin.tsx` (HTTP 200) — módulo compila e carrega
- ✅ Outras tabs e callers do `ArquitetoAutocomplete` existentes não tocados (verificado via diff)
- ⚠️ Playwright MCP smoke pendente (instrução explícita do orchestrator: validação no Wave 5) — checklist documentado acima

---
*Phase: 06-filtros-smoke*
*Completed: 2026-05-07*
