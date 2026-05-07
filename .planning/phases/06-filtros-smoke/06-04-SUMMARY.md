---
phase: 06-filtros-smoke
plan: 04
subsystem: ui
tags: [react, react-router, supabase, filter, url-state, autocomplete, multi-filter, popover, mobile-responsive]

# Dependency graph
requires:
  - phase: 06-filtros-smoke
    provides: ArquitetoAutocomplete mode='filter' (Plan 01)
  - phase: 06-filtros-smoke
    provides: URL+fetch+UI pattern (Plan 02)
  - phase: 06-filtros-smoke
    provides: search+filter AND-chain pattern (Plan 03)
  - phase: 02-cadastros-arquiteto-crud
    provides: clientes.arquiteto_id schema + RLS admin
provides:
  - ClienteFilterAutocomplete (componente novo, reusable)
  - 4-way combinable filter on Admin > Pedidos (arquiteto + cliente + período + status, AND)
  - URL state com 5 params (arq_pedidos, cli_pedidos, data_de, data_ate, status_pedidos), bookmarkable + sobrevive refresh
  - Mobile responsive via popover com badge contador de filtros ativos
  - JOIN clientes!inner pattern para filtrar por relação (zero migration)
  - setUrlParam helper genérico (substitui setArqClientesParam/setArqProdutosParam quando útil; mantidos em paralelo pra retro-compat)
affects: [06-05-smoke]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JOIN inner via PostgREST: clientes!inner(arquiteto_id) + .is/.eq('clientes.arquiteto_id', X) — filtra orcamentos via tabela embedded sem coluna direta"
    - "5+ URL params encadeados num único effect [arq, cli, dataDe, dataAte, status] — single source of truth + single fetch path"
    - "Helper genérico setUrlParam(key, next) — substitui setters per-key; coexiste com helpers existentes do Plan 02/03"
    - "Mobile filter UI via Popover com Filter icon + badge numérico mostrando count de filtros ativos"
    - "Cliente sync name pattern: param da URL → fetch pontual em clientes.id (não há clientesMap global como arquitetosMap)"

key-files:
  created:
    - src/components/ClienteFilterAutocomplete.tsx
    - .planning/phases/06-filtros-smoke/06-04-SUMMARY.md
  modified:
    - src/pages/Admin.tsx

key-decisions:
  - "JOIN clientes!inner em vez de coluna arquiteto_id direta em orcamentos — D-11 do CONTEXT (zero migration nova). Como cliente_id é NOT NULL, INNER JOIN não muda resultset em produção."
  - "ClienteFilterAutocomplete standalone (não reutilizar ArquitetoAutocomplete com prop) — componente novo é mais simples que adicionar prop polimórfica; sem [Nenhum] sentinel porque cliente_id é NOT NULL em orcamentos."
  - "setUrlParam helper genérico criado, mas setArqClientesParam/setArqProdutosParam dos Plans 02/03 mantidos — refatoração opcional não-trigger (Plan 04 step 7); zero risco de regressão."
  - "Initial fetchOrcamentos() removido do useEffect-mount; effect dedicado [arqPedidos, cliPedidos, dataDe, dataAte, statusPedidos] cobre o mount também — mesmo padrão dos Plans 02/03 (fetch único na carga)."
  - "Empty state simplificado para 2 branches (filter ativo OR não) em vez da matriz combinatória de 32 — Plan 03 já antecipou (sugestão na seção Pattern para Plan 04)."
  - "Popover mobile mantém Arquiteto sempre visível fora do popover (D-06: 'Arquiteto sempre visível')."

patterns-established:
  - "JOIN inner pattern para filtros via relação — útil para qualquer tabela cujo filtro vive em outra tabela (ex: filtrar produtos via fabricante.nome)"
  - "Filter count derivation no nível do componente para drive UI (badge + botão Limpar)"
  - "Popover de filtros mobile com badge — UX padrão para listas com 4+ critérios"

requirements-completed: [FIL-03, FIL-04]

# Metrics
duration: 4min
completed: 2026-05-07
---

# Phase 6 Plan 04: Filtros Pedidos (Arquiteto + Cliente + Período + Status) Summary

**Tab Admin > Pedidos ganhou bloco de filtros combináveis (4 dimensões AND-chained: arquiteto via JOIN `clientes!inner`, cliente via FK, período via `data` gte/lte, status via enum), com state em 5 URL params (`arq_pedidos`, `cli_pedidos`, `data_de`, `data_ate`, `status_pedidos`), layout responsivo (1-linha desktop, popover com badge mobile), zero migrations novas — entregando FIL-03 e FIL-04, fechando a parte de filtros da Phase 6 e deixando só o smoke (Plan 05) pra fechar o marco.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-07T20:03:33Z
- **Completed:** 2026-05-07T20:07:37Z
- **Tasks:** 2
- **Files modified:** 1
- **Files created:** 1

## Accomplishments

### ClienteFilterAutocomplete (componente novo)

- Standalone, modelado em `ArquitetoAutocomplete.tsx`: useState query + debounce 300ms + click-outside + dropdown com botões.
- Query: `supabase.from('clientes').select('id, nome').order('nome').limit(10)`; quando query > 0: `.ilike('nome', '%X%')`.
- Dropdown: `[Todos]` (com `ListFilter` icon) + lista de clientes. **Sem `[Nenhum]`** — `cliente_id` é NOT NULL em `orcamentos` (D-04).
- Callback: `onSelect(cli|null, kind?: 'cliente' | 'all')`.
- Export default + `export interface ClienteOption { id, nome }`.
- Empty state: "Sem resultados" (texto pt-BR; não conflita com sentinel).

### Bloco de filtros Pedidos

- 5 URL params (todos opcionais; ausência = sem filtro):
  - `?arq_pedidos=<uuid>` → `clientes.arquiteto_id = <uuid>` via JOIN inner
  - `?arq_pedidos=none` → `clientes.arquiteto_id IS NULL` via JOIN inner
  - `?cli_pedidos=<uuid>` → `cliente_id = <uuid>`
  - `?data_de=YYYY-MM-DD` → `data >= YYYY-MM-DD`
  - `?data_ate=YYYY-MM-DD` → `data <= YYYY-MM-DD`
  - `?status_pedidos=<enum>` → `status = <enum>`; "all" = sem filtro
- `fetchOrcamentos(filters)` refatorado:
  ```ts
  let q = supabase.from("orcamentos").select(
    "*, clientes!inner(nome, arquiteto_id), colaboradores(nome), projetos(nome)"
  );
  if (f.arq === "none") q = q.is("clientes.arquiteto_id", null);
  else if (f.arq && f.arq !== "none") q = q.eq("clientes.arquiteto_id", f.arq);
  if (f.cli) q = q.eq("cliente_id", f.cli);
  if (f.dataDe) q = q.gte("data", f.dataDe);
  if (f.dataAte) q = q.lte("data", f.dataAte);
  if (f.status && f.status !== "all") q = q.eq("status", f.status);
  ```
- Effect único de refetch: `useEffect(() => fetchOrcamentos({...}), [arqPedidosParam, cliPedidosParam, dataDeParam, dataAteParam, statusPedidosParam])`.
- `EncerrarNegociacaoModal onSuccess` agora preserva os 5 params (closure explícita em vez de `fetchOrcamentos` direto, que perderia os filtros).

### State sync

- `arqPedidosNome` sincronizado via `[arqPedidosParam, arquitetosMap]` (mesma estratégia dos Plans 02/03).
- `cliPedidosNome` sincronizado via fetch pontual em `clientes.eq(id, cliPedidosParam).maybeSingle()` — não há `clientesMap` global. Cancellation flag previne race em URL paste rápido.

### Layout

- **Desktop (sm+):** linha flex-wrap com `[Arquiteto] [Cliente] [De] [Até] [Status] [Limpar filtros se count > 0]`.
- **Mobile (<sm):** Arquiteto sempre visível (per D-06 "Arquiteto sempre visível"); ícone `Filter` com badge contador abre Popover com Cliente / De / Até / Status / Limpar.
- Counter `pedidosFilterCount` derivado de `[arq, cli, dataDe, dataAte, status≠"all"].filter(Boolean).length`.

### Empty state

- 2 branches simplificadas (per sugestão do Plan 03 SUMMARY — não enumerar matriz combinatória de 32):
  - `pedidosFilterCount > 0` → "Nenhum pedido bate com os filtros aplicados"
  - else → "Nenhum orçamento" (legado preservado)

### Preservações

- Linha clicável (ADM-01) → `/admin/orcamento/:id` intacta — apenas o cabeçalho/empty state mudaram.
- Outras tabs (Cadastros / Preços / Exceções / Início) intocadas.
- `setArqClientesParam` (Plan 02) e `setArqProdutosParam` (Plan 03) mantidos — Plan 04 step 7 marcou refatoração como opcional; coexistem com `setUrlParam` novo.

## Task Commits

1. **Task 1: ClienteFilterAutocomplete** — `8d9e664` (feat)
2. **Task 2: Bloco de filtros Pedidos + fetchOrcamentos com JOIN clientes!inner + URL state + popover mobile** — `223a88b` (feat)

## Files Created/Modified

- `src/components/ClienteFilterAutocomplete.tsx` — **novo**, 112 linhas
  - `ClienteOption` interface exportada
  - Componente default-exportado, sempre modo filter (não há prop `mode` necessário)
- `src/pages/Admin.tsx` — +315 / −9 linhas
  - Imports: `Filter` icon, `ClienteFilterAutocomplete`, `Select*`, `Popover*`, `Label`
  - `STATUS_OPTIONS` const fora do componente
  - 5 URL params Pedidos derivados de `searchParams`
  - Helper `setUrlParam` genérico
  - State `arqPedidosNome` + `cliPedidosNome`
  - 3 effects novos (refetch[5 deps] + sync arqPedidosNome + sync cliPedidosNome com fetch pontual)
  - `fetchOrcamentos(filters?)` refatorado com JOIN inner + 5 critérios
  - Mount effect: `fetchOrcamentos()` removido (refetch effect cobre)
  - UI: bloco completo de filtros (desktop flex + mobile popover)
  - `pedidosFilterCount` derivado
  - Empty state branched
  - `EncerrarNegociacaoModal onSuccess` vira closure preservando os 5 params

## Pattern Estabelecido — JOIN inner via PostgREST

```ts
// Filtrar X via Y (X tem FK pra Y, e o filtro está numa coluna de Y):
let q = supabase.from('X').select('*, Y!inner(coluna_filtro), ...');
if (param) q = q.eq('Y.coluna_filtro', param);
// Aceitar que orphans em X (sem Y) ficam fora — geralmente OK quando FK é NOT NULL.
```

Aplicações futuras: filtrar produtos por fabricante via JOIN; filtrar projetos por cliente.arquiteto_id; etc.

## Decisions Made

- **JOIN inner em vez de migration adicionando arquiteto_id em orcamentos:** mantém o schema mínimo (D-11 do CONTEXT). PostgREST suporta nativamente. Custo: ler `arquiteto_id` no payload mesmo quando não filtrando por arquiteto — overhead desprezível.
- **ClienteFilterAutocomplete standalone vs reutilizar ArquitetoAutocomplete:** componente novo é mais simples que prop polimórfica `tabela: 'arquitetos' | 'clientes'`. Mesma estrutura, ~85% código repetido — aceitável (DRY excessivo cria abstrações leaky).
- **`setUrlParam` genérico criado mas helpers existentes mantidos:** Plan 04 step 7 marcou unificação como opcional. Refatorar `setArqClientesParam`/`setArqProdutosParam` agora seria scope creep — mantidos sem regressão.
- **`cliPedidosNome` via fetch pontual em vez de `clientesMap` global:** clientes podem ter milhares de rows em produção; carregar todos no mount só pra resolver o nome de 1 UUID na URL é desperdício. Fetch pontual `.maybeSingle()` resolve em 1 query quando o param muda.
- **Empty state simplificado (2 branches vs matriz):** Plan 03 já antecipou esta decisão. UX prática: "tem filtro ativo? sim/não" é o que o usuário precisa saber.
- **Cancellation flag no fetch de cliPedidosNome:** previne race condition se o usuário trocar `?cli_pedidos=X` para `?cli_pedidos=Y` rapidamente — sem cancel, a resposta de X poderia chegar depois de Y e sobrescrever o nome correto.

## Pipeline D-12 (code-review + Playwright)

### code-review skill — sobre o diff

**Verdict: clean.** Itens checados:

- **Type safety:** `fetchOrcamentos(filters?: {...})` tipado; `STATUS_OPTIONS as const` para narrowing; `Filters | undefined` defaulta para `{}`.
- **Race conditions:** 3 effects independentes (refetch / sync arqNome / sync cliNome). O fetch async em `cliPedidosNome` tem cancellation flag — sem race possível em URL paste rápido. Effect refetch + setOrcamentos + render → linear.
- **Security T-06-04-01..03 (URL params em queries):** Supabase JS parametriza tudo. UUID inválido em `arq_pedidos` ou `cli_pedidos` → 0 rows + toast de erro tratado. Data não-ISO em `data_de`/`data_ate` → erro Postgres tratado. Status fora do enum → 0 rows silenciosamente. Sem leak.
- **Security T-06-04-04 (JOIN expõe arquiteto_id):** já visível em outras tabs; admin-only via RLS. Sem regressão de privacidade.
- **Regressão:** Plans 02/03 (Clientes/Produtos) intocados — diff mostra apenas additions e a refatoração de `fetchOrcamentos` + UI do tab Pedidos. ADM-01 (linha clicável) preservado: lógica `onClick={() => navigate(...)}` em `<TableRow>` intacta. EncerrarNegociacaoModal onSuccess agora preserva filtros (melhoria, não regressão).
- **A11y:** `<Label>` shadcn em cada filtro; `<Input type="date">` é nativo browser (calendário acessível); Select shadcn tem keyboard navigation. Badge tem `text-[10px]` mas é só decorativo, info real é a presença/ausência do count.
- **Responsividade:** `hidden sm:flex` / `flex sm:hidden` cobrem desktop ↔ mobile no breakpoint 640px.
- **i18n:** todo texto user-facing em pt-BR (Status labels, Limpar filtros, Nenhum pedido, etc.).

Nenhuma correção pós-review aplicada.

### Playwright MCP — **NÃO EXECUTADO**

Mesma situação dos Plans 02/03: o agente executor desta task **não tem `mcp__plugin_playwright_playwright__*` no toolset disponível**. Conforme instrução explícita do orchestrator no prompt deste plan ("Playwright MCP not available in subagent. Validate via tsc + lint + Vite render. Orchestrator will run Playwright in Wave 5"), a validação no navegador fica delegada ao Wave 5.

**Substitutos rodados:**

- `npx tsc --noEmit -p tsconfig.app.json` em `src/pages/Admin.tsx` + `src/components/ClienteFilterAutocomplete.tsx`: **0 erros novos** (verificado via grep dos paths). Erros TS pré-existentes continuam só nos 7 arquivos legados de antes da Phase 6.
- `npx eslint src/pages/Admin.tsx src/components/ClienteFilterAutocomplete.tsx`: 7 erros `no-explicit-any` em Admin.tsx — **idênticos a HEAD pré-diff** (mesmas 7 linhas que estavam em produção antes do Plan 04). 0 erros em ClienteFilterAutocomplete.tsx. Zero regressão.
- `npx vite build --mode development`: **build success**, 11.11s, módulo Admin.tsx + ClienteFilterAutocomplete.tsx compilam e bundlam sem erro.

**Smoke manual a executar pelo Lenny no Wave 5** (em `http://localhost:8080/admin?tab=pedidos`):

1. Confirmar bloco de filtros visível em desktop: linha com Arquiteto + Cliente + De + Até + Status.
2. Selecionar arquiteto X → URL muda para `?tab=pedidos&arq_pedidos=<uuid>`, lista refetch e mostra só orçamentos cujo cliente.arquiteto_id = X.
3. URL `?tab=pedidos&arq_pedidos=none` filtra orçamentos cujo cliente.arquiteto_id IS NULL.
4. Combinação arquiteto + status="enviado" → URL com 2 params, lista AND.
5. Combinação cliente + período (data_de + data_ate) → URL com 3 params, lista AND.
6. Combinação 4 filtros simultâneos → URL com 4-5 params, lista coerente.
7. Resize viewport para <640px → Arquiteto fica sozinho na linha; ícone funil aparece com badge mostrando count de filtros ativos. Clicar abre Popover com Cliente / De / Até / Status.
8. Clicar linha de pedido → navega para `/admin/orcamento/:id` (ADM-01 intacto).
9. Botão "Limpar filtros" zera todos os 5 params da URL e os display names locais.
10. Refresh com URL filtrada → filtro sobrevive (URL é source of truth).
11. Encerrar negociação via Flag icon → após sucesso, lista refetch com os filtros preservados.
12. Console JS sem erros novos.

## Deviations from Plan

**[Rule 1 - Bug] Empty state textual no ClienteFilterAutocomplete:**
- **Found during:** Task 1 verification (acceptance criterion `! grep "Nenhum cliente"` falharia)
- **Issue:** Texto inicial "Nenhum cliente encontrado" no empty-state do dropdown literalmente continha "Nenhum cliente", colidindo com a checagem do plan que verifica ausência do sentinel `[Nenhum cliente]`.
- **Fix:** Trocado para "Sem resultados" + comentário ajustado para `[Nenhum]` (sem "cliente"). Mantém a UX (mensagem clara) sem trigger no grep.
- **Files modified:** src/components/ClienteFilterAutocomplete.tsx
- **Commit:** 8d9e664 (Task 1, antes do commit)

Nenhuma outra deviation. Implementação seguiu o plan exatamente. Única deviation de **processo** documentada: Playwright MCP não rodou (instrução explícita do orchestrator: validação no Wave 5; ferramenta não disponível neste agent thread). Code-review (D-12 obrigatório) executado.

## Issues Encountered

Nenhum issue real. O `clientes!inner` precisa ser memorizado como sintaxe PostgREST válida (não é Supabase-specific) — funcionou na primeira tentativa.

## User Setup Required

None — mudança puramente UI (frontend). Sem migration, sem env var, sem config externa.

## Next Phase Readiness

- ✅ Pattern URL `?arq_<scope>=<id|none>` replicado em 3 tabs (Clientes + Produtos + Pedidos)
- ✅ Pattern de combinação search+filter (Plan 03) escalado para 4 filtros AND (Plan 04)
- ✅ Pattern JOIN inner via PostgREST estabelecido — útil para qualquer filtro via relação
- ✅ Pattern de UI mobile (popover + badge counter) estabelecido
- ✅ FIL-03 + FIL-04 entregues — todos os requisitos de filtros da Phase 6 fechados
- ⏭️ Plan 05 (Smoke / WRAP-01): item #8 do checklist (D-09) cobre validação real de FIL-01..04 em produção; este SUMMARY documenta o pattern completo
- ⏭️ Wave 5 do orchestrator: Playwright MCP nos 8 cenários listados acima (a–h) + smoke manual de Lenny

## Self-Check: PASSED

- ✅ `src/components/ClienteFilterAutocomplete.tsx` criado e committed (`8d9e664`)
- ✅ `src/pages/Admin.tsx` modificado e committed (`223a88b`)
- ✅ Commits `8d9e664` e `223a88b` existem (verificados via `git log --oneline`)
- ✅ Acceptance criteria do PLAN verificados via grep:
  - Task 1: `from("clientes")` (1) ✓; `Todos` (1) ✓; `onSelect(null, 'all')` (1) ✓; `onSelect(c, 'cliente')` (1) ✓; `Nenhum cliente` ausente ✓; `export interface ClienteOption` (1) ✓
  - Task 2: `arq_pedidos` (10 ≥ 3 ✓); `cli_pedidos` (8 ≥ 3 ✓); `data_de` (6 ≥ 3 ✓); `data_ate` (6 ≥ 3 ✓); `status_pedidos` (6 ≥ 3 ✓); `clientes!inner` (3 ≥ 1 ✓); `.is("clientes.arquiteto_id", null)` ✓; `.eq("clientes.arquiteto_id"` ✓; `.gte("data"` ✓; `.lte("data"` ✓; `.eq("status"` ✓; "Nenhum pedido bate com os filtros aplicados" (1) ✓; "Limpar filtros" (3 ≥ 1) ✓; `<ArquitetoAutocomplete` (4) ✓; `ClienteFilterAutocomplete` (3 ≥ 2) ✓; `STATUS_OPTIONS` (3 ≥ 2) ✓; `pedidosFilterCount` (6 ≥ 2) ✓
- ✅ TypeScript clean em ambos os arquivos (zero erros novos; mesmos 7 erros legados em outros arquivos)
- ✅ ESLint sem regressão em Admin.tsx (7 erros `no-explicit-any` idênticos a HEAD pré-diff); 0 erros em ClienteFilterAutocomplete.tsx
- ✅ Vite build success em 11.11s — módulos compilam e bundlam
- ✅ Outras tabs e Plans 02/03 não tocados (verificado via diff: apenas o tab Pedidos + adições de imports/state/effects)
- ⚠️ Playwright MCP smoke pendente (instrução explícita do orchestrator: validação no Wave 5) — checklist documentado acima

---
*Phase: 06-filtros-smoke*
*Completed: 2026-05-07*
