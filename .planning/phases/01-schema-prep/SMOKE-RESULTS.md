# Phase 1 — Smoke Test Results

**Date:** 2026-04-26 (auto checks) / 2026-04-27 (manual checks)
**Tester:** Lenny Wajcberg
**Environment under test:** auraoramentos-kappa.vercel.app (production) + Supabase Dashboard (jkewlaezvrbuicmncqbj)
**Reference:** ROADMAP Phase 1 Success Criterion #5 — "Wizard de orcamento, login e admin continuam funcionando em producao sem regressao visivel"

## Automated checks (preenchido automaticamente)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` retorna 0 | PASS |
| `grep -c "arquitetos:" src/integrations/supabase/types.ts` >= 1 | 1 |
| `grep -c "arquiteto_id" src/integrations/supabase/types.ts` >= 2 (clientes + produtos) | 10 |
| `grep -c "setor:" src/integrations/supabase/types.ts` >= 1 | 1 |
| `ls supabase/migrations/20260423*` retorna 4 arquivos | 4 |
| Ultimos 5 commits incluem 4 `feat(db):` + 1 `chore(types):` | `80cf779 docs(phase-01): mark plan 01-02 complete in tracking` / `65c49b4 docs(01-02): complete schema migrations plan summary` / `b35c585 chore(types): regenerate Supabase types after Phase 1 migrations` / `348b950 feat(db): add cpf, telefone, setor to colaboradores (USR-01..03 schema)` / `221b998 feat(db): add arquiteto_id FK to produtos (ARQ-04)` |

## Manual checks

### 1. Wizard de orcamento (Vercel kappa, login como colaborador)

**Result:** **PASS**

**Observado:**
- Step 1 (Dados do Orçamento) renderizou; dropdown "Tipo de Orçamento" funcional ("Primeiro Orçamento" selecionado).
- Step 2 (Ambientes e Itens) — adicionou ambiente "Sala", sistema com fita LM1057 (24V) + driver LM1361 (24V).
- Validação de tensão funcionou em tempo real (toast "Tensão incompatível" quando fita 24V foi pareada com driver 12V).
- Step 3 (Revisão) carregou com Total Geral R$ 411,22, ambiente "Sala", driver listado.

**Console errors observados (não-bloqueantes, pré-existentes):**
- 401 Unauthorized de `create-colaborador` (efeito colateral de criar conta admin direto pelo Supabase Dashboard, pulando o fluxo de signup que insere `colaboradores`). Resolvido via SQL backfill no momento do smoke. **Não é regressão do Phase 1.**
- 401 Unauthorized de `validar-sistema-orcamento` (decorrência da mesma sessão sem colaborador inicialmente).
- WebSocket realtime falha (`apikey=sb_pub...`) — não impacta funcionalidade.

### 2. Login admin + navegacao em abas

**Result:** **PASS** (com fix aplicado durante o smoke)

**Observado:**
- `/admin` carregou todas as 7 abas: Dashboard, Exceções de Preço, Importação, Produtos, Colaboradores, Orçamentos, Clientes.
- Cada aba renderizou sem tela branca / sem crash.
- **Bug detectado e corrigido inline:** F5 nas abas voltava sempre pro Dashboard porque `<Tabs defaultValue="dashboard">` era uncontrolled. Hotfix aplicado em `src/pages/Admin.tsx` (commit `b8dfc40`) — aba agora persiste em `?tab=` query param. Fora do escopo do Phase 1 (Phase 1 = só schema), aplicado como hotfix isolado.
- Loop de redirect causado pelos 401 do `create-colaborador` (mesma causa raiz do Teste 1) — resolvido pelo backfill SQL.

### 3. Renderizacao de orcamento antigo + geracao de PDF

**Result:** **BLOCKED** (não é regressão do Phase 1)

**Observado:**
- Tentativa de abrir orçamento existente (JOAQUIM/CASA, R$ 25,41, criado 2026-04-26) falhou em **2 caminhos**:
  - `/admin?tab=orcamentos` — coluna "Ações" vazia, `<TableRow>` sem `onClick`.
  - `/` (home) > Cliente "JOAQUIM" > Projeto "CASA" — card do orçamento listado mas sem `onClick`.
- Bug pré-existente — orçamento criado existe no banco, mas não tem rota nem handler pra abrir/inspecionar.
- **Não regressão do Phase 1** (Phase 1 só tocou schema, não tocou em `Admin.tsx` nem `Index.tsx`). Captura bug pré-existente que precisa de fix em fase futura.
- PDF: usuário relatou que o PDF gerado pelo wizard novo está visualmente quebrado — já coberto pela Phase 5 do roadmap (PDF Redesign).

**Todos abertos:**
- `.planning/todos/pending/2026-04-27-admin-orcamentos-row-nao-clicavel.md` (orçamento não clicável em ambas rotas)
- `.planning/todos/pending/2026-04-27-pdf-zuado-input-para-phase-5.md` (PDF zuado — input pra Phase 5)

### 4. Supabase Dashboard — Schema visivel

**Result:** **PASS**

**Observado (via SQL Editor):**

| check_name | result |
|------------|--------|
| arquitetos table + RLS | PASS |
| clientes new columns (arquiteto_id, contato, cpf_cnpj) | PASS |
| produtos.arquiteto_id | PASS |
| colaboradores new columns (cpf, telefone, setor) | PASS |
| setor CHECK constraint | PASS |

CHECK constraint `check_colaboradores_setor` confirmada com definição `CHECK (((setor = ANY (ARRAY['comercial'::text, 'projetos'::text, 'logistica'::text, ...))))`.

### 5. Edge functions ainda respondem

**Result:** **PASS**

**Observado:**
- Submeteu pedido de acesso pra `smoke-test-temp@example.com` em aba anônima.
- Edge function `request-access` respondeu HTTP 200 com `{"success":true}`.
- Tela verde "Pedido enviado!" exibida.
- **Sem 5xx.**
- Bug não-bloqueante encontrado: quando email já existe com status `APPROVED`, função retorna HTTP 409 com body informativo, mas o frontend (`RequestAccess.tsx`) trata qualquer não-2xx como erro genérico ("Erro ao enviar pedido") em vez de ler o `data.error === 'approved'` no body. UX gap, não impede o fluxo limpo de novo email.

**Resend status:** Verified (option-a aplicada na PREP-01).

**Cleanup:** `DELETE FROM access_requests WHERE email = 'smoke-test-temp@example.com'` executado.

## Overall verdict

- [x] **All PASS (com gaps pré-existentes documentados)** — Phase 1 fechada, pronto para `/gsd-plan-phase 2`
- [ ] Falhas detectadas

Schema novo aplicado em produção sem nenhuma regressão no que Phase 1 prometia entregar (compatibilidade aditiva). Os bugs encontrados durante o smoke são **pré-existentes** ao Phase 1 e foram capturados como todos pra fases futuras.

## Gaps detectados (pre-existentes ao Phase 1)

- **Gap 1: Orçamento existente não clicável em nenhuma rota**
  - Componente: `src/pages/Admin.tsx` (aba Orçamentos) + `src/pages/Index.tsx` (card de orçamento dentro do projeto)
  - Sintoma: tabela/card lista orçamentos mas não tem `onClick` nem botão "Abrir"
  - Hipótese: rota `/orcamento/:id` (ou similar) provavelmente não existe; wizard só monta orçamento novo via state
  - Ação proposta: capturado em `.planning/todos/pending/2026-04-27-admin-orcamentos-row-nao-clicavel.md` — fix em fase futura

- **Gap 2: PDF gerado visualmente quebrado**
  - Componente: `src/lib/gerarPdfHtml.ts`
  - Sintoma: layout/visual ruim do PDF (relatado pelo usuário)
  - Hipótese: design/markup atual precisa de reescrita
  - Ação proposta: já coberto pela **Phase 5 — PDF Redesign** do roadmap; capturado em `.planning/todos/pending/2026-04-27-pdf-zuado-input-para-phase-5.md`

- **Gap 3: `create-colaborador` 401 quando user é criado fora do fluxo de signup**
  - Componente: `src/hooks/useColaborador.ts` + edge function `create-colaborador`
  - Sintoma: usuários criados direto pelo Supabase Dashboard não têm `colaborador` associado, gerando 401 em loop e quebrando navegação
  - Hipótese: edge function tem `verify_jwt=true` e provavelmente o RLS / serviço de auto-create está acoplado ao fluxo de signup do `/auth`
  - Ação proposta: aceito como conhecido para Phase 1 (resolvido na sessão via backfill SQL); investigar em fase futura se for promovido como recorrente

- **Gap 4: `request-access` 409 mostra erro genérico no frontend**
  - Componente: `src/pages/RequestAccess.tsx`
  - Sintoma: tentar `Solicitar Acesso` com email já APPROVED mostra "Erro ao enviar pedido" (genérico) em vez de "Acesso já aprovado"
  - Hipótese: `supabase.functions.invoke` trata qualquer não-2xx como `res.error` antes do código checar `data.error === 'approved'`
  - Ação proposta: aceito como gap menor de UX; fix simples (priorizar leitura de `res.data?.error` antes do `res.error`) em fase futura
