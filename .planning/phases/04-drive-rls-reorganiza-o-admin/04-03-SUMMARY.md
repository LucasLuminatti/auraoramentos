---
phase: 04-drive-rls-reorganiza-o-admin
plan: 03
subsystem: ui
tags: [admin, tabs, react-router, search-params, dashboard, exceptions]

requires:
  - phase: 04-drive-rls-reorganiza-o-admin / Plan 02
    provides: Drive sub-tab continua funcional (handover Drive não tocado por este plan)
provides:
  - Admin reorganizado em 5 sub-tabs no nível superior (Início / Cadastros / Pedidos / Preços / Exceções)
  - Sub-tabs aninhadas em Cadastros (Produtos / Arquitetos / Clientes / Colaboradores)
  - Sub-tabs aninhadas em Preços (Atualização placeholder Plan 04 / Importação)
  - URL state ?tab=X&sub=Y persistido + reload-friendly
  - LEGACY_TAB_MAP que migra URLs antigas (?tab=produtos → ?tab=cadastros&sub=produtos)
  - AdminDashboard simplificado sem PieChart "Distribuição por Status" (D-25)
  - Bloco de ajuda inline em AdminExceptions (D-22/D-23) explicando fluxo solicitação/aprovação/pós-aprovação/filtro
  - Slot reservado para Plan 04 (Preços > Atualização) via Card "Em construção"
affects: [04-04 (preencherá precos>atualizacao), 04-05 (preencherá pedidos com link/admin/orcamento/:id)]

tech-stack:
  added: []
  patterns:
    - "URL-state via useSearchParams com normalize-on-mount via useEffect (replace, sem loop)"
    - "Tabs aninhadas Radix: <Tabs> pai define escopo de TabsContent — value duplicado em pai+filho permitido"
    - "Default sub-tab por top-tab map (DEFAULT_SUB_BY_TAB) injetado em handleTabChange"

key-files:
  created: []
  modified:
    - src/pages/Admin.tsx
    - src/components/AdminDashboard.tsx
    - src/components/AdminExceptions.tsx

key-decisions:
  - "URL strategy ?tab=X&sub=Y (não nested route /admin/cadastros/produtos) por já haver useSearchParams instalado e ser query-param idiomático para Tabs Radix (D-11 + Claude's discretion)"
  - "Backward-compat de URLs antigas via LEGACY_TAB_MAP em vez de deixar cair no default — preserva bookmarks e links em emails/outros canais"
  - "Help block em Exceções como Card border-blue-200 bg-blue-50/30 (não modal, não tooltip) para reforçar visibilidade conforme D-23"
  - "Atualização de Preços renderiza placeholder Card visível em vez de tab oculta — usuário vê o esqueleto do roadmap e Plan 04 só substitui o placeholder"

patterns-established:
  - "Pattern: TopTab + SUB_TABS_BY_TAB + DEFAULT_SUB_BY_TAB + LEGACY_TAB_MAP — reusa-se quando crescer número de áreas no admin"
  - "Pattern: importSubTab interno mantido dentro de TabsContent aninhado (Preços > Importação) — evita reescrita do widget de cards horizontais"

requirements-completed: [ADM-03, ADM-04, ADM-05]

duration: ~30min
completed: 2026-05-04
---

# Phase 04 / Plan 03: Admin Reorganization Summary

**Admin.tsx reorganizado em 5 sub-tabs (Início / Cadastros / Pedidos / Preços / Exceções) com sub-tabs aninhadas + URL state + dashboard limpo + ajuda inline em Exceções — entregando ADM-03, ADM-04, ADM-05 em um único plan**

## Performance

- **Duration:** ~30 min (3 tasks auto + checkpoint human-verify para orchestrator)
- **Completed:** 2026-05-04
- **Tasks:** 3/3 implementadas (Task 4 = checkpoint Playwright/code-review pelo orchestrator)
- **Files modified:** 3

## Accomplishments

### Task 1 — AdminDashboard simplificado (D-25)
- Removido `statusData` useMemo (Distribuição por Status)
- Removido Card `<PieChart>` "Distribuição por Status"
- Removidos imports não usados: `PieChart`, `Pie`, `PIE_COLORS`
- Convertido grid wrapper de `md:grid-cols-2` para `space-y-4` (single column — Receita Mensal ocupa largura inteira)
- Mantidos: 6 KPI cards, Receita Mensal, Motivos de Perda, Top 5 Clientes, seletor de período (D-24)

### Task 2 — Help block em AdminExceptions (ADM-03 / D-22, D-23)
- Card no topo com border-blue-200 + bg-blue-50/30 + HelpCircle icon
- 4 parágrafos: Solicitação / Aprovação / Após aprovação / Filtre acima
- Ícones inline (CheckCircle/XCircle/MessageSquare) para correlacionar com botões da tabela abaixo
- Imports: Card primitives + HelpCircle
- Comportamento de fetchExceptions/handleAction/openChat/Subscription: intocado

### Task 3 — Admin.tsx reorg (ADM-04 / D-10, D-11)
- 5 top tabs: Início / Cadastros / Pedidos / Preços / Exceções
- Cadastros tem 4 sub-tabs (Produtos / Arquitetos / Clientes / Colaboradores)
- Preços tem 2 sub-tabs (Atualização placeholder Plan 04 + Importação)
- URL state ?tab=X&sub=Y via useSearchParams (replace mode)
- LEGACY_TAB_MAP normaliza URLs antigas no useEffect (sem loop, replace)
- DEFAULT_SUB_BY_TAB injeta sub default ao trocar top-tab
- TabsContent inicio embute AdminDashboard (D-26)
- Atualização de Preços = Card placeholder com mensagem "Em construção — entregue pelo Plan 04 desta phase"
- importSubTab interno (master/produtos/imagens/precos) preservado dentro de Preços > Importação

## Task Commits

1. **Task 1 — Simplify AdminDashboard** — `907602f` (feat, --no-verify)
2. **Task 2 — Help block AdminExceptions** — `5527900` (feat, --no-verify)
3. **Task 3 — Admin.tsx reorg + URL state** — `62a396f` (feat, --no-verify)

## Files Modified

- `src/pages/Admin.tsx` — TOP_TABS / SUB_TABS_BY_TAB / DEFAULT_SUB_BY_TAB / LEGACY_TAB_MAP + useEffect normalize + handleTabChange/handleSubChange + JSX restruturado (5 top + sub-tabs aninhadas)
- `src/components/AdminDashboard.tsx` — Removidos statusData/PieChart Card/PIE_COLORS/imports recharts não usados; grid → space-y-4
- `src/components/AdminExceptions.tsx` — Card de ajuda azul no topo + imports Card/HelpCircle

## Decisions Made

- **URL strategy:** `?tab=X&sub=Y` (query params) em vez de nested route `/admin/cadastros/produtos` — D-11 + Claude's discretion (já havia useSearchParams instalado, idiomático para Radix Tabs)
- **Backward-compat de URLs antigas:** LEGACY_TAB_MAP normaliza no useEffect — preserva bookmarks de admins. Alternativa (deixar cair no default) descartada pq Lenny pode ter links salvos
- **Atualização de Preços = placeholder visível**: Card "Em construção" renderiza dentro do TabsContent — usuário vê o esqueleto do roadmap, Plan 04 só substitui o conteúdo do TabsContent
- **importSubTab interno preservado**: NÃO migrei os 4 cards horizontais (Master/Produtos/Imagens/Preços) para Tabs aninhadas Radix — manter visual atual + state local existente (decisão pragmática do plan)
- **Help block style:** Card border-blue-200 bg-blue-50/30 (não modal/tooltip) — D-23 explicitou "inline, pra que admin novo veja sem precisar clicar"

## Mapeamento Legacy → Novo (LEGACY_TAB_MAP)

| URL antiga                | URL nova                                |
| ------------------------- | --------------------------------------- |
| `?tab=dashboard`          | `?tab=inicio`                           |
| `?tab=produtos`           | `?tab=cadastros&sub=produtos`           |
| `?tab=arquitetos`         | `?tab=cadastros&sub=arquitetos`         |
| `?tab=clientes`           | `?tab=cadastros&sub=clientes`           |
| `?tab=colaboradores`      | `?tab=cadastros&sub=colaboradores`      |
| `?tab=orcamentos`         | `?tab=pedidos`                          |
| `?tab=importacao`         | `?tab=precos&sub=importacao`            |
| `?tab=excecoes`           | `?tab=excecoes` (igual)                 |
| (sem ?tab) ou tab inválida | `?tab=inicio` (default)                 |

## Estrutura Final de Tabs

```
Tabs (top, ?tab=)
├── inicio         → AdminDashboard
├── cadastros      → Tabs (sub, ?sub=)
│   ├── produtos     → tabela produtos
│   ├── arquitetos   → tabela arquitetos
│   ├── clientes     → tabela clientes
│   └── colaboradores → tabela colaboradores
├── pedidos        → tabela orçamentos (Plan 05 vai add link /admin/orcamento/:id)
├── precos         → Tabs (sub, ?sub=)
│   ├── atualizacao  → Card placeholder "Em construção" (Plan 04)
│   └── importacao   → cards horizontais Master/Produtos/Imagens/Preços (importSubTab interno)
└── excecoes       → AdminExceptions (com help block no topo)
```

## Deviations from Plan

**None — plan executado exatamente como escrito.**

Pequenas correções de tipo na implementação do useEffect de normalização (`(TOP_TABS as readonly string[]).includes(rawTab)` para evitar erro TS2345), mas não são deviations — é o pattern necessário para narrowing em const arrays readonly.

## Issues Encountered

- **PreToolUse hook reminders** entre Edits — hook do Claude Code pediu re-Read entre edits sequenciais no mesmo arquivo. Não bloqueou edits, apenas verboso. Workaround: Read entre cada Edit major.
- **Lint errors pré-existentes** (`@typescript-eslint/no-explicit-any` em useState<any[]>) — verificados como pré-existentes no baseline (mesmas linhas) via `git stash`. Não introduzidos por 04-03. Out of scope.
- **Build warning** (logo.png static + dynamic import) — pré-existente, não relacionado.

## Verification Results

| Verificação                                                  | Resultado |
| ------------------------------------------------------------ | --------- |
| `grep -c "Distribuição por Status" AdminDashboard.tsx`       | 0 ✓       |
| `grep -c "PieChart" AdminDashboard.tsx`                      | 0 ✓       |
| `grep -c "statusData" AdminDashboard.tsx`                    | 0 ✓       |
| `grep -c "PIE_COLORS" AdminDashboard.tsx`                    | 0 ✓       |
| `grep -c "Como funciona o fluxo de exceção" AdminExceptions` | 1 ✓       |
| `npm run build`                                              | ✓ verde   |
| Lint sem novos erros em files modificados                    | ✓ (errors são pré-existentes) |

## Smoke Check Pendente (Task 4 — checkpoint orchestrator)

Pipeline automático per CLAUDE.md global do Lenny:
1. Code review sobre o diff (Admin.tsx + AdminDashboard.tsx + AdminExceptions.tsx)
2. Playwright MCP em /admin com cenários:
   - Login admin → /admin abre em "Início" (KPIs sem PieChart)
   - Cadastros → URL `?tab=cadastros&sub=produtos`
   - Trocar sub-tabs (arquitetos/clientes/colaboradores) → URL atualiza
   - Reload em URL específica → carrega na sub-tab certa
   - Pedidos → URL `?tab=pedidos`
   - Preços → URL `?tab=precos&sub=atualizacao` → ver Card "Em construção"
   - Preços > Importação → ver os 4 cards horizontais
   - Exceções → ver Card azul de ajuda no topo + tabela
   - URL legada `?tab=produtos` → redireciona para `?tab=cadastros&sub=produtos`
3. Console JS: 0 erros vermelhos

## Next Phase Readiness

- **Plan 04-04 (PrecosBatch ADM-02):** Slot pronto em `Preços > Atualização` — substituir Card placeholder por `<PrecosBatch />`
- **Plan 04-05 (OrcamentoDetalhe ADM-01):** Slot pronto em `Pedidos` — TableRow precisa ganhar link/onClick para `/admin/orcamento/:id`

## Self-Check: PASSED

- [x] Files modified existem:
  - `src/pages/Admin.tsx` ✓ (62a396f)
  - `src/components/AdminDashboard.tsx` ✓ (907602f)
  - `src/components/AdminExceptions.tsx` ✓ (5527900)
- [x] Commits no git log:
  - 907602f ✓
  - 5527900 ✓
  - 62a396f ✓
- [x] Build verde
- [x] Verifications grep esperadas: 0/0/0/0/1 ✓

---
*Phase: 04-drive-rls-reorganiza-o-admin*
*Completed: 2026-05-04*
