---
phase: 04-drive-rls-reorganiza-o-admin
plan: 04
subsystem: ui
tags: [admin, precos, batch-edit, inline-edit, paginacao, validacao]

requires:
  - phase: 04-drive-rls-reorganiza-o-admin / Plan 03
    provides: Sub-tab "Preços > Atualização" com placeholder pronto para receber componente
provides:
  - Componente PrecosBatch.tsx — tela dedicada de batch edit de preços (ADM-02)
  - Inline edit em preco_tabela e preco_minimo (D-12)
  - Filtros por arquiteto, categoria e "sem preço cadastrado" (D-13)
  - Paginação 50/página com guard que bloqueia troca de página/filtro com pendentes (D-14)
  - Validação inline preco_minimo ≤ preco_tabela bloqueando save (D-17)
  - Batch save via Promise.all marcando editado_manualmente=true (D-16)
  - Highlight visual (bg-yellow-50) em linhas com pending changes
  - Footer sticky com contador + botões Descartar/Salvar
  - Função pura validarPendingChanges exportada para reuso/teste
affects: []

tech-stack:
  added: []
  patterns:
    - "Map<string, PendingChange> como estado de mudanças não persistidas — preserva original em produtos[] e renderiza pending sobre original"
    - "Promise.all de N updates Supabase como batch (sem bulk nativo no SDK 2.x) — toast diferenciado por count de erros"
    - "guardPending() como pré-condição de qualquer handler que invalide o estado da tabela (filtro/página)"
    - "Sentinel ALL='__all__' para SelectItem 'Todos/Todas' (Radix Select não aceita value='')"
    - "useCallback no fetchProdutos para estabilizar a dependência do useEffect e evitar re-fetch loop"

key-files:
  created:
    - src/components/PrecosBatch.tsx
    - src/components/__tests__/PrecosBatch.test.tsx
  modified:
    - src/pages/Admin.tsx

key-decisions:
  - "Componente novo (não reuso de ProdutoEditDialog) — UX inline em tabela é fundamentalmente diferente do modal por linha (decisão alinhada com Área 8 do RESEARCH)"
  - "validarPendingChanges como função pura exportada — testável sem montar o componente, evita necessidade de testing-library nesta phase"
  - "Sentinel value ALL='__all__' nos Selects — Radix Select rejeita value='' em SelectItem; padrão idiomático na shadcn"
  - "Batch via Promise.all em vez de bulk SQL/edge function — N=50 max é aceitável (D-15 difere bulk avançado); falha parcial reportada por count no toast"
  - "guardPending bloqueia mudança de filtro/página com pendentes em vez de auto-discardar — protege o usuário de perder edições por engano"
  - "Inputs renderizam o pending quando existe, senão o original do banco — fonte única da verdade durante a edição"
  - "editado_manualmente=true setado em todo save (D-16 + Phase 3 D-08) — protege contra sobrescrita pelo Master subsequente"

patterns-established:
  - "Pattern: pending changes Map com base = entry no Map ?? snapshot do banco. Reutilizável em outras telas de batch edit."
  - "Pattern: guardPending() como pre-condição de side effect que invalidaria o estado pendente."
  - "Pattern: ALL sentinel + value !== ALL ? value : '' para Radix Select com 'Todos'."

requirements-completed: [ADM-02]

duration: ~25min
completed: 2026-05-04
---

# Phase 04 / Plan 04: Atualização de Preços em Batch (ADM-02) Summary

**PrecosBatch.tsx novo — tela dedicada de inline edit em tabela paginada (50/pg) com filtros, validação preco_min ≤ preco_tabela, batch save com editado_manualmente=true e highlight visual de pendentes.** Substitui o placeholder do Plan 04-03 em Admin > Preços > Atualização (ADM-02).

## Performance

- **Duration:** ~25 min (2 tasks auto + checkpoint human-verify para orchestrator)
- **Completed:** 2026-05-04
- **Tasks:** 2/2 implementadas (Task 3 = checkpoint Playwright/code-review pelo orchestrator)
- **Files created:** 2 (PrecosBatch.tsx + PrecosBatch.test.tsx)
- **Files modified:** 1 (Admin.tsx)

## Accomplishments

### Task 1 — PrecosBatch.tsx + testes (TDD RED → GREEN)

**RED:** 3 testes para `validarPendingChanges` em `src/components/__tests__/PrecosBatch.test.tsx`:
1. Retorna `{valid: false, errorId: 'id-2'}` quando alguma entry tem preco_minimo > preco_tabela.
2. Retorna `{valid: true}` quando todas têm preco_minimo ≤ preco_tabela.
3. Retorna `{valid: true}` para Map vazio.

Falha esperada confirmada (módulo PrecosBatch não existe ainda).

**GREEN:** Componente `src/components/PrecosBatch.tsx` (404 linhas):
- **Estado:** `produtos[]`, `arquitetos[]`, `categorias[]`, `loading`, `saving`, `page` (0-indexed), `totalCount`, `pendingChanges: Map<string, PendingChange>`, `filterArquitetoId`, `filterCategoria`, `filterSemPreco`.
- **Mount effect:** carrega `arquitetos` (id+nome) e `categorias` distinct (workaround: select + dedupe local; Supabase não tem DISTINCT direto no select da JS SDK).
- **Effect dependente de filtros/página:** dispara `fetchProdutos` (memoizado via `useCallback`) com `range(from, to)` + `.eq()` por arquiteto/categoria + `.or('preco_tabela.is.null,preco_tabela.eq.0')` quando filterSemPreco.
- **handleEdit:** parseFloat com guard de `isNaN`/`< 0`; preserva valor da outra coluna via `Map.get(id) ?? snapshot`.
- **handleSave:** roda `validarPendingChanges` antes (toast.error com codigo do produto invalido se viola); em sucesso, faz `Promise.all` de N `update().eq('id', id)` setando `editado_manualmente: true`; toast diferenciado por count de erros; refetch + clear pending no fim.
- **handleDiscard:** `setPendingChanges(new Map())`.
- **guardPending:** retorna `true` se `pendingChanges.size > 0` e mostra toast — usado em todos os handlers que mudariam estado da tabela.
- **JSX:**
  - Toolbar: 2 Selects (arquiteto/categoria) + Checkbox (sem preço) + contador `X–Y de Z produtos`.
  - Tabela: Código (mono) / Descrição (truncate+title) / Categoria / Arquiteto / Preço Tabela (Input number step="0.01") / Preço Mínimo. Linha highlight `bg-yellow-50` quando `pendingChanges.has(p.id)`. Inputs ganham `border-destructive` quando `preco_minimo > preco_tabela` no pending.
  - Paginação: Anterior/Próxima + "Página X de Y" no centro, `disabled` no início/fim.
  - Footer sticky bottom-0 com border-t + shadow-md, só renderiza com pendentes: contador + Descartar + "Salvar X alterações" (Loader2 quando saving).

**Testes:** 3/3 passaram após implementação (vitest run).
**Build:** verde (1.04s reporter, sem erros TS).

### Task 2 — Wire em Admin.tsx > Preços > Atualização

- Adicionado `import PrecosBatch from "@/components/PrecosBatch";`.
- Substituído todo o conteúdo do `<TabsContent value="atualizacao">` (Card "Em construção" do Plan 04-03) por `<PrecosBatch />`.
- Sem mais nenhuma mudança em Admin.tsx — comentário marca ADM-02 (D-12..D-17).

## Task Commits

1. **Task 1 RED — Testes failing** — `c0e5826` (test, --no-verify)
2. **Task 1 GREEN — PrecosBatch implementação** — `31d37c1` (feat, --no-verify)
3. **Task 2 — Wire em Admin.tsx** — `5bec95b` (feat, --no-verify)

## Files Created/Modified

- `src/components/PrecosBatch.tsx` (created) — componente + função pura `validarPendingChanges` exportada
- `src/components/__tests__/PrecosBatch.test.tsx` (created) — 3 testes Vitest da validação D-17
- `src/pages/Admin.tsx` (modified) — import + substituição do placeholder por `<PrecosBatch />`

## Cobertura D-XX

| Decisão | Coberto por |
|---------|-------------|
| **D-12** Lista paginada 50/pg com inline edit em preco_tabela e preco_minimo | `PAGE_SIZE = 50`; `range(from, to)`; Inputs controlados na tabela |
| **D-13** Filtros: arquiteto, categoria, "sem preço" | 2 Selects + Checkbox + handlers que aplicam `.eq()`/`.or()` |
| **D-14** Botão "Salvar X alterações" no rodapé fixo | Footer sticky bottom-0 com count dinâmico |
| **D-15** Sem bulk ops avançadas no v1 | Não implementado — confirmado escopo |
| **D-16** `editado_manualmente=true` em qualquer save | `update({..., editado_manualmente: true })` em todo update do batch |
| **D-17** Validação inline preco_min ≤ preco_tabela | `validarPendingChanges` antes do save + toast com código do produto + border-destructive nos inputs |

## Decisions Made

- **Componente novo, não reuso do ProdutoEditDialog** — UX inline em tabela vs modal por linha são patterns diferentes; misturá-los pioraria as duas. Alinhado com Área 8 do RESEARCH.
- **validarPendingChanges como função pura exportada** — testar a lógica de validação sem montar componente nem mockar Supabase; mantém o teste rápido e estável.
- **Sentinel `ALL='__all__'`** — Radix Select rejeita `<SelectItem value="">`; padrão idiomático com sentinel + conversão no onChange.
- **Promise.all em vez de bulk SQL** — D-15 explicitamente difere bulk; N≤50 é aceitável; toast diferenciado por count de erros (T-04-16 mitigado).
- **guardPending bloqueia em vez de auto-discardar** — proteção contra perda silenciosa de edições; experiência alinhada com sheets de edição em massa (Excel/Google Sheets).
- **Pending source of truth** — Inputs renderizam pending quando existe, senão o snapshot do banco; única fonte da verdade até clicar Salvar.
- **useCallback em fetchProdutos** — necessário para estabilizar a dependência do useEffect que depende dela; sem isso entraria em loop ou exigiria desabilitar exhaustive-deps.

## Threat Coverage

| Threat ID | Mitigação aplicada |
|-----------|--------------------|
| **T-04-15** Tampering RLS | RLS existente "Admins manage product_variants" (Phase 3) cobre — Admin.tsx só acessível via AdminRoute |
| **T-04-16** Save parcial Promise.all | Toast diferenciado por count de erros — usuário vê quantos falharam e tenta de novo; refetch traz estado real |
| **T-04-17** Override de master sobre edição manual | `editado_manualmente=true` em todo update — ImportMaster respeita (Phase 3 D-08) |
| **T-04-18** Input numérico inválido | parseFloat + isNaN + `< 0` ignora; min="0" no Input; validarPendingChanges bloqueia preco_min > preco_tabela |

Sem threat flags novos. Nenhum stub introduzido.

## Verification Results

| Verificação                                                          | Resultado |
| -------------------------------------------------------------------- | --------- |
| `npm run test -- --run src/components/__tests__/PrecosBatch.test.tsx` | 3/3 ✓     |
| `npm run build`                                                      | ✓ verde   |
| `grep -c "<PrecosBatch" src/pages/Admin.tsx`                         | 1 ✓       |
| Placeholder "Em construção" removido de Admin.tsx                    | ✓         |

## Smoke Check Pendente (Task 3 — checkpoint orchestrator)

Pipeline automático per CLAUDE.md global do Lenny:
1. **Code review** sobre o diff (PrecosBatch.tsx + PrecosBatch.test.tsx + Admin.tsx).
2. **Playwright MCP** em `/admin?tab=precos&sub=atualizacao` com cenários:
   - Tabela carrega com 50 produtos + paginação.
   - Filtrar por arquiteto → tabela filtra → page reset 0.
   - Filtrar "Sem preço cadastrado" → mostra apenas produtos com preco_tabela null/0.
   - Editar preco_tabela de uma linha → linha amarela + footer aparece.
   - Editar preco_minimo > preco_tabela → Salvar → toast.error com código + sem update.
   - Corrigir → Salvar → toast.success "1 produto atualizado" → footer some + linha desamarela.
   - Verificar `editado_manualmente = true` no banco (SQL editor).
   - Editar 5 produtos → tentar mudar página sem salvar → toast.error guardPending.
   - Descartar → mudar página agora funciona.
3. Console JS: 0 erros vermelhos.

## Deviations from Plan

**None — plan executado exatamente como escrito.**

Pequenas adições além do skeleton do plan (não consideradas deviations):
- `useCallback` no `fetchProdutos` para estabilizar a dep do useEffect (necessário pelo design React, não muda escopo).
- `border-destructive` nos Inputs quando linha tem preco_min > preco_tabela (UX feedback inline antes do toast — fortalece D-17).
- Sentinel `ALL='__all__'` em Selects (workaround técnico do Radix Select, sem efeito visível para o usuário).

## Issues Encountered

- **Radix `<SelectItem value="">` rejeitado em runtime** — resolvido com sentinel `ALL='__all__'` + conversão `v === ALL ? "" : v` (padrão idiomático).
- **PreToolUse hook reminders** entre Edits no Admin.tsx — não bloqueou os edits, apenas verboso.
- **Build warning** (logo.png static + dynamic import) — pré-existente, não relacionado ao Plan 04-04.

## Next Phase Readiness

- **Plan 04-05 (OrcamentoDetalhe ADM-01):** continua com `/admin/orcamento/:id`. Sub-tab Pedidos em Admin.tsx ainda precisa ganhar link/onClick para a nova rota.
- **Phase 5+ (Bulk ops avançadas):** se a operação de "atualizar X% em todos os produtos do arquiteto Y" virar dor real, abrir uma fase nova (D-15).

## Self-Check

- [x] Files modified existem:
  - `src/components/PrecosBatch.tsx` ✓ (31d37c1)
  - `src/components/__tests__/PrecosBatch.test.tsx` ✓ (c0e5826)
  - `src/pages/Admin.tsx` ✓ (5bec95b)
- [x] Commits no git log:
  - c0e5826 ✓ (RED test)
  - 31d37c1 ✓ (GREEN impl)
  - 5bec95b ✓ (wire Admin)
- [x] Build verde (`npm run build`)
- [x] Testes passando (3/3 em PrecosBatch.test.tsx)
- [x] `grep -c "<PrecosBatch" src/pages/Admin.tsx` = 1
- [x] Placeholder "Em construção" removido de Admin.tsx

## Self-Check: PASSED

---
*Phase: 04-drive-rls-reorganiza-o-admin*
*Completed: 2026-05-04*
