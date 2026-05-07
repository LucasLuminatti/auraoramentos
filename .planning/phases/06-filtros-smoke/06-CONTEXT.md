# Phase 6: Filtros & Smoke - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Listas administrativas (Cadastros > Clientes, Cadastros > Produtos, Pedidos) ganham filtro por arquiteto. Filtros combináveis aplicados onde fizerem sentido. Marco fecha com smoke test manual em produção cobrindo todos os fluxos afetados pelos marcos 1–5.

**Entrega:**
- FIL-01: Lista de clientes filtrável por arquiteto
- FIL-02: Lista de produtos filtrável por arquiteto
- FIL-03: Lista de orçamentos/pedidos filtrável por arquiteto
- FIL-04: Combinações de filtros onde fizer sentido (definidas abaixo)
- WRAP-01: Smoke test manual em prod, sem regressão visível

**Não entrega:**
- Filtros em outros locais (Drive, Exceções, Início/Dashboard, Preços) — escopo se limita às listas acima
- Search/text-search livre (não está na phase)
- Filtros em listas do colaborador (`/`, fora do `/admin`)
- Save/preset de filtros (estilo "favoritos") — out of scope
- Fix de regressões grandes encontradas no smoke é parte da Phase 6, mas regressões pequenas/cosméticas viram backlog
</domain>

<decisions>
## Implementation Decisions

### UI do Filtro
- **D-01:** Componente reutilizado: `src/components/ArquitetoAutocomplete.tsx` (mesmo Command/Combobox shadcn já usado no form de cliente).
  - **Por quê:** Já tá lá, é o pattern validado, zero curva de aprendizado.
  - Opções no topo da lista do autocomplete: `[Todos]` (desativa filtro, valor sentinel `null`) seguido de `[Nenhum arquiteto]` (filtra rows com `arquiteto_id IS NULL`), depois lista alfabética de arquitetos.
  - **Nota pra planner:** o componente atual já tem `[Nenhum arquiteto]` na opção do form de cliente (D-17 da Phase 2). Adicionar prop `mode: 'select' | 'filter'` — em modo `filter`, prepende `[Todos]` no topo. Não criar componente novo.

- **D-02:** Posição: header da tabela, na mesma linha do botão de ação primário.
  - Cadastros > Clientes: `[ ArquitetoAutocomplete ]   [+ Novo Cliente]`
  - Cadastros > Produtos: `[ ArquitetoAutocomplete ]   [+ Novo Produto]` (se o botão existir)
  - Pedidos: `[ ArquitetoAutocomplete ] [ outros filtros — ver D-05 ]`
  - **Por quê:** agrupado com ações da tabela, visível sem scroll, não cria linha vazia quando só tem 1 filtro.

### Persistência
- **D-03:** Estado dos filtros vai pra URL search params, seguindo o pattern já estabelecido pelo `?tab=...`.
  - Compartilhável (admin envia link já filtrado pra outro admin).
  - Bookmark-friendly.
  - Sobrevive refresh sem código de sync extra.

- **D-04:** Cada tab tem seu próprio scope de filtro — params nomeados por contexto, não globais.
  - Cadastros > Clientes: `?tab=cadastros&sub=clientes&arq_clientes=<id>`
  - Cadastros > Produtos: `?tab=cadastros&sub=produtos&arq_produtos=<id>`
  - Pedidos: `?tab=pedidos&arq_pedidos=<id>` (+ outros params do D-05)
  - **Por quê:** evita "filtro fantasma" quando usuário troca de tab. O custo cognitivo de "ah, já tava filtrado" supera a economia de teclado de filtro global.
  - Sentinel para "Todos": ausência do param (não `arq_clientes=all` ou `=null`). URL limpa quando filtro tá desligado.
  - Sentinel para "Nenhum arquiteto": `arq_clientes=none`. Query traduz em `arquiteto_id IS NULL`.

### Combinações de Filtros (FIL-04 — Claude's Discretion)
- **D-05:** Combinações aplicáveis por tabela:
  - **Cadastros > Clientes:** apenas `arquiteto`. Não tem outras dimensões úteis nesse marco (período seria por `created_at`, mas não aparece como dimensão crítica de negócio).
  - **Cadastros > Produtos:** apenas `arquiteto`. Mesmo raciocínio.
  - **Pedidos:** `arquiteto` + `cliente` + `período (data_de / data_até)` + `status`. Combinados via `AND`.
    - **Por quê Pedidos ganha mais:** lista de pedidos é a tabela com mais pressão de uso real (admin investiga pipeline por arquiteto, vendedor, mês ou status). Vale o investimento.

- **D-06:** Filtros adicionais em Pedidos só aparecem quando há espaço. Layout proposto: 1 linha com `[Arquiteto] [Cliente] [Período: De/Até] [Status]`. Se ficar apertado em mobile, agrupar dentro de um popover "Filtros" com ícone de funil + badge contando filtros ativos.
  - **Nota pra planner:** se a tabela de Pedidos hoje já tiver alguma feature de filtro (ex: search por cliente), unificar com isso ao invés de duplicar.

- **D-07:** Combinação aplicada via query Supabase encadeando `.eq()` / `.gte()` / `.lte()` / `.in()`. Sem RPC custom — fica no padrão do app (D-25 da Phase 2).
  - Filtro vazio = sem `.eq()` correspondente. Filtros são opcionais e independentes.

### Smoke Test (WRAP-01 — Claude's Discretion)
- **D-08:** Checklist em arquivo dedicado `06-WRAP-UAT.md` (UAT-style, mesmo template das phases anteriores). Cada item tem `expected` + `result: [pending/passed/failed]` + observações.
  - Lenny executa em produção (`auraoramentos-kappa.vercel.app`), marca cada item.
  - Onde Playwright MCP conseguir rodar autônomo (criar cliente com arquiteto, criar orçamento, gerar PDF v2, importar CSV), eu faço; o resultado entra no UAT como item já marcado por mim.
  - Itens que **precisam ser manuais**: signup novo (provider de email externo, RLS de `allowed_users`), Drive isolado por colaborador (precisa logar com 2 contas distintas pra confirmar RLS).

- **D-09:** Cobertura mínima do smoke (cada item gera 1 entrada no UAT):
  1. **Signup novo:** abrir aba anônima → solicitar acesso (`request-access`) → admin aprova → novo user faz signup com CPF/telefone/setor → login OK
  2. **Cliente novo com arquiteto:** form de criar cliente → preencher Contato + CPF/CNPJ + Arquiteto via autocomplete → salva sem erro, aparece na lista com arquiteto vinculado
  3. **Orçamento completo:** wizard 3 passos com 1+ ambiente, sistema com Local, luminárias com imagem → Step3 → Gerar PDF → PDF v2 baixa OK
  4. **PDF re-emit:** abrir orçamento criado em (3) → Re-emitir PDF → sai v2 idêntico
  5. **Snapshot legacy:** abrir orçamento criado antes de hoje → Re-emitir PDF → sai v1 (Outfit + info-grid + total escuro)
  6. **Importar CSV:** Admin > Cadastros > Produtos → ImportMaster → upload CSV de teste → validações OK, produtos aparecem
  7. **Drive isolado:** logar com colaborador A → ver Drive → sair → logar com colaborador B → confirmar que arquivos do A não aparecem
  8. **Filtros (FIL-01..04):** filtrar Clientes por arquiteto X → só aparecem clientes do X; filtrar Pedidos por arquiteto + período → resultado coerente

- **D-10:** Critério de fechamento: 0 itens com `result: failed` que sejam regressão real (bug visível ao usuário). Regressões cosméticas viram TODO no `gsd-add-todo`.

### Cross-cutting
- **D-11:** Sem novas migrations. Schema já tem `clientes.arquiteto_id`, `produtos.arquiteto_id` desde Phase 1. Filtro de Pedidos por arquiteto é feito via JOIN com `clientes` (pedido → cliente → arquiteto), não coluna direta em `orcamentos`.
  - **Nota pra planner:** verificar se a query atual de Pedidos já faz `select(... clientes(...))` — se sim, já dá pra filtrar por `clientes.arquiteto_id` no Postgres via `clientes!inner(...)` syntax.

- **D-12:** Toda mudança de UI obrigatoriamente passa pelo pipeline de pre-test do CLAUDE.md global: `requesting-code-review` → Playwright MCP no fluxo afetado → reportar.

### Claude's Discretion
- Texto exato dos placeholders dos filtros, formatação visual de chips/inputs.
- Comportamento de loading enquanto a query refiltra (skeleton ou spinner — escolher o que já existe no app).
- Ordem dos filtros adicionais em Pedidos (D-06): organizar por importância visual.
- Layout exato do checklist em `06-WRAP-UAT.md` (formato igual aos UATs anteriores).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked patterns from prior phases (não re-decidir)
- `.planning/phases/02-cadastros-arquiteto-crud/02-CONTEXT.md` §Arquiteto Autocomplete (D-16/D-17) — comportamento atual do componente
- `.planning/phases/02-cadastros-arquiteto-crud/02-CONTEXT.md` §Cross-cutting (D-25/D-26) — padrão Supabase + sonner

### Schema atual relevante
- `supabase/migrations/20260423000001_create_arquitetos.sql` — tabela `arquitetos`
- `supabase/migrations/20260423000002_clientes_arquiteto_contato_cpf.sql` — `clientes.arquiteto_id`
- `supabase/migrations/20260423000003_produtos_arquiteto.sql` — `produtos.arquiteto_id` (verificar nome exato no plano)

### Componentes a reusar
- `src/components/ArquitetoAutocomplete.tsx` — adicionar prop `mode: 'select' | 'filter'`
- `src/pages/Admin.tsx` (linhas 306–502) — onde os filtros entram

### Requirements
- `.planning/REQUIREMENTS.md` §Filtros (FIL-01..04) e §Preparação e Finalização (WRAP-01)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ArquitetoAutocomplete.tsx`** — Command/Combobox shadcn com search. Precisa de prop `mode: 'select' | 'filter'` pra prepender `[Todos]` quando em modo filter. Não criar duplicata.
- **Supabase JS client** (`src/integrations/supabase/client.ts`) — query pattern direto, sem TanStack Query.
- **`Tabs` shadcn em Admin.tsx** — pattern de URL search param já implementado (`?tab=...`); estender para `?arq_<scope>=...`.
- **Toast `sonner`** — padrão pra erro/sucesso de operações.

### Established Patterns
- **State management:** `useState` + queries diretas. Nada de Redux/Zustand/TanStack Query.
- **URL como source of truth pra navegação:** `?tab=cadastros&sub=clientes` — estender com filtros.
- **Erro handling:** destructuring `{ data, error }` + `if (error) toast.error(...)` + return cedo.

### Integration Points
- `src/pages/Admin.tsx` — onde os filtros entram (3 listas).
- `src/integrations/supabase/types.ts` — types de `clientes`, `produtos`, `orcamentos` já têm `arquiteto_id` (clientes/produtos diretamente; orcamentos via JOIN).
- `src/components/ImportMaster.tsx` (Phase 3) — alvo do smoke test #6.
- `src/pages/Drive.tsx` (Phase 4) — alvo do smoke test #7.
</code_context>

<specifics>
## Specific Ideas

- **Filtro como query Supabase, não filtro client-side:** rebuscar do banco sempre que filtro muda (refetch). Não trazer todas as rows e filtrar em JS.
- **Empty state filtrado:** quando filtro retorna 0 rows, mostrar mensagem específica ("Nenhum cliente vinculado a este arquiteto") em vez do empty state genérico ("Nenhum cliente cadastrado") — diferenciação importante pra UX.
- **Smoke test #5 (snapshot legacy)** vai precisar de pelo menos 1 orçamento criado antes de 2026-05-07 ainda existir em prod ao executar o smoke. Verificar antes de começar — se Lenny excluiu/limpou, criar via PATCH manual com `pdf_template_version=NULL`.
</specifics>

<deferred>
## Deferred Ideas

- **Save/preset de filtros** — "Salvar este conjunto de filtros como meu padrão". Útil mas escopo de v2 (orçamentos por equipe).
- **Search por texto livre nas tabelas** (busca por nome do cliente, código do produto) — não está nos requirements de Phase 6, deferido.
- **Filtro de Pedidos por colaborador** — útil pro admin que quer ver "todos os orçamentos do João" mas não é o eixo de Phase 6 (que é arquiteto). Anotar como TODO se virar dor.
- **Filtro em Exceções e Drive** — escopo focado em Cadastros + Pedidos. Drive já tem RLS isolando por colaborador (Phase 4).
- **Save UAT runs como artifact pra histórico** — anotar pra v2 (compliance do marco 2).
</deferred>

---

*Phase: 06-filtros-smoke*
*Context gathered: 2026-05-07*
