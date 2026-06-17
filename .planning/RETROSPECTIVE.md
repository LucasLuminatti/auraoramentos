# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação

**Shipped:** 2026-06-12
**Phases:** 5 (14-18) | **Plans:** 16 | **Cycle:** 3 dias (2026-06-10 → 2026-06-12)

### What Was Built
- **Catálogo corrigido** — 401 perfis + 18 fitas invisíveis nos seletores (tipo_produto null/errado) corrigidos via migration aditiva em PROD; dica MAGNETO 48V validada (CAT-01/02)
- **Validação de tensão** — voltagem do driver inferida da fita, pré-filtro + aviso de divergência não-bloqueante, grouping por (código+voltagem), advisory TINY 24V, driver sugerido como default (TENS-01/02, SIST-04, UX-02)
- **Cálculo/metragem** — gate contra fita 0m silenciosa, sufixo de metragem automático na descrição, passadas editáveis por família + migration de sync (CALC-01/02/03)
- **Resumo coerente** — chips de LOCAL por fita (tela + PDF v2 com foto), fita sem duplicação, drivers por ambiente, advisory de itens incompletos (RES-01/02/03/05)
- **UX transversal** — redirect ao buscar categoria errada, microcopy inline, Duplicar sistema + Duplicar ambiente (novos UUIDs), checklist pré-PDF com gate no botão Gerar PDF (UX-01/03/04/05, RES-04)

### What Worked
- **Disciplina de build-order** — CAT-01 (SQL puro) como Phase 14 antes de tudo desbloqueou os seletores que as Phases 15-16 dependiam; a dependência explícita no roadmap evitou retrabalho
- **Decisões "display-only" travadas no início** (RES-01 anotação visual sem tocar cálculo; UX-05 painel inline sem reestruturar steps) mantiveram um marco de UAT em baixo risco — schema e cálculo intocados
- **Backward-compat por guard em todo campo novo** (`?? []`, `?? 3`, checagem `!== undefined`) — orçamentos antigos sem imagemUrl/localBreakdown/passadasPadrao renderizam sem crash; verificado em Flow C
- **E2E contra PROD** (e2e/catalogo.spec.ts) confirmou o estado real do dado, não só claims do SUMMARY — pegou que CAT-02 já estava correto no banco (evitou fix desnecessário)
- **Advisory-not-blocking como padrão de validação** — toasts/badges/AlertDialog em vez de bloqueio rígido reduziram fricção sem perder a sinalização

### What Was Inefficient
- **5 fases modificaram os mesmos 5 arquivos core** (`orcamento.ts`, `AmbienteCard.tsx`, `Step2Ambientes.tsx`, `Step3Revisao.tsx`, `useProdutoSearch.ts`) — risco real de uma fase sobrescrever outra; exigiu um integration check dedicado no fechamento para confirmar coexistência (felizmente limpa)
- **Frontmatter `requirements-completed` inconsistente** — Phase 15 (4 reqs) e Phase 16 (CALC-01/02) não preencheram o campo nos SUMMARYs, criando ambiguidade no cross-reference de 3 fontes do audit (resolvido por evidência de código, mas custou verificação extra)
- **Traceability do REQUIREMENTS.md ficou stale** — 9 reqs continuaram "Pending" e RES-04 com fase errada (17 vs 18) até o audit corrigir
- **WR-01 ficou aberto** — bug de usabilidade (passadas [1] em 160 produtos) com fix de 1 linha foi encontrado na verification da Phase 16 mas deixado como decisão humana em vez de fechado na hora
- **Pilha de `human_needed`** — 11 itens de UAT visual acumularam em 3 fases sem confirmação, empurrando o status do audit de `passed` para `tech_debt`

### Patterns Established
- **Advisory-not-blocking** para validação de wizard (toast + badge persistente, AlertDialog com "continuar mesmo assim")
- **Chips que expandem a célula Descrição** em vez de adicionar coluna — preserva layout mobile ao enriquecer o resumo
- **Clone de árvore via `crypto.randomUUID()`** em todos os níveis; cálculo agrupa por código (não por id) → clones somam corretamente sem colisão de key
- **Gate composto aditivo** (`disabled={hasUnresolved || savingOrcamento || temErroBloqueante}`) — cada fase adiciona sua condição sem remover as anteriores
- **Migration aditiva de recategorização** sem tocar snapshots jsonb (autocontidos)

### Key Lessons
1. **Quando N fases tocam os mesmos arquivos core, agende um integration check explícito no fechamento** — a verification por-fase não pega regressão cross-phase; foi o que mais agregou no audit
2. **Preencher `requirements-completed` no frontmatter de cada SUMMARY** é barato e remove ambiguidade no audit de 3 fontes — deixar vazio força reverificação manual
3. **Fix de 1 linha encontrado na verification deve ser fechado antes do audit**, não deferido como "decisão humana" — WR-01 virou débito que poderia ter sido zero esforço
4. **Atualizar a traceability do REQUIREMENTS.md no fim de cada fase** evita que o audit gaste passos corrigindo documentação stale

### Cost Observations
- Model profile: `balanced` (agentes GSD em sonnet, orquestração em opus)
- Cycle: 3 dias corridos, 89 commits no range — pace ágil consistente com a diretriz "uma fase de cada vez"
- Notable: nyquist_validation desligado neste projeto; verificação apoiou-se em unit tests (128 verdes) + E2E PROD + análise estática

---

## Milestone: v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)

**Shipped:** 2026-06-17
**Phases:** 4 (19-22) | **Plans:** 11 | **Requirements:** 13/13 | **Ciclo:** ~6 dias (2026-06-12 → 2026-06-17), 62 commits

### What Was Built
Montagem product-first de sistemas compostos no wizard (MAGNETO 48V / TINY 24V / SYSTEM MOLD detectados pelo produto-âncora, sem seleção manual de tipo), driver auto-dimensionado com painel "aplicar", voltage lock 48V, checklist de obrigatórios com atalho, advisory não-bloqueante de composto incompleto, duplicação de composto entre ambientes, fix de catálogo (conectores/kits) e PDF v3 aditivo com bloco estruturado inline.

### What Worked
- Decisão de arquitetura conservadora (D-01: compostos em `luminarias[].composicao?`, não em `sistemas[]`) preservou os 5 calc sites de Fita Padrão intocados — zero regressão no fluxo estável.
- Camada aditiva no PDF (v3 como template novo, router condicional) protegeu snapshots e o PDF v2 aprovado.
- Pipeline de verificação (code review → Playwright contra o código real) pegou bugs reais antes de shippar: WR-01 (thumbnails de composicao não inlinados) e a brecha de RLS de preço.

### What Was Inefficient
- O MCP Supabase ficou instável (504 intermitente) — várias queries/migrations precisaram de retry ou caminho alternativo (aplicar via client autenticado no navegador).
- Verificação de PDF dependeu de renderizar o HTML via dynamic import no navegador (html2pdf não dá pra inspecionar o raster) — funcionou bem, mas é um padrão a documentar.

### Patterns Established
- **Verificar PDF gerando o HTML real via `import()` do módulo no Playwright** e renderizando numa aba — inspeção visual + asserts sem depender do raster.
- **Trava de admin em edge fn**: `getUser(token)` → checar `user_roles` role=admin → 403; RLS da tabela só com policy de admin. Replicável pras demais fns.

### Key Lessons
- "Tranca só na UI" não é segurança — a brecha de UPDATE em `product_variants` mostrou que policy permissiva antiga sobrevive silenciosa. Auditar RLS por tabela quando a ação é sensível.
- Requirements do UAT (documento dos funcionários) seguem sendo a melhor fonte de escopo — revalidar contra o dado real (catálogo) pega caudas que o "feito" do roadmap esconde (49 perfis sem tag).

### Cost Observations
- Model mix: orquestração opus + executores/verificadores sonnet (profile `balanced`)
- Notable: execução sequencial na main (worktrees desligados no Windows por regressão conhecida)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Cycle | Phases | Key Change |
|-----------|-------|--------|------------|
| v1.0 | 15 dias | 6 | MVP de melhorias; base de schema aditivo + PDF v1/v2 router |
| v1.1 | 5 dias | 7 | Multi-tenancy RLS + primeira automação assíncrona (cron + Resend) |
| v1.2 | 3 dias | 5 | UAT-driven; decisões "display-only" travadas no início + advisory-not-blocking; ciclo mais curto |

### Cumulative Quality

| Milestone | Tests | Migrations (aditivas) | Edge fns live |
|-----------|-------|------------------------|---------------|
| v1.0 | smoke 8/8 PROD | 9 | 4 |
| v1.1 | smoke 4/4 integration | 11 | 5 |
| v1.2 | 128 unit + 3 E2E PROD | 2 | 5 |

### Top Lessons (Verified Across Milestones)
1. **Schema sempre aditivo é o que mantém os 3 marcos sem regressão** — 22 migrations, zero destrutivas, snapshots antigos sempre renderizam (validado v1.0/v1.1/v1.2)
2. **Build-order explícito com dependências no roadmap** evita retrabalho quando fases têm pré-requisitos de dados (CAT-01 → seletores em v1.2; RLS antes de features em v1.1)
3. **Verificar contra PROD/dado real, não só contra claims de SUMMARY** — pegou fix desnecessário (CAT-02 em v1.2) e bug crítico inline (BUG-13-01 em v1.1)
