# Phase 1 — Smoke Test Results

**Date:** 2026-04-26
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

## Manual checks (preencher na Task 2)

### 1. Wizard de orcamento (Vercel kappa, login como colaborador)

**Steps:**
1. Abrir https://auraoramentos-kappa.vercel.app em aba anonima
2. Login com conta de colaborador (nao admin)
3. Step 1: Selecionar colaborador (dropdown deve listar) e tipo de revisao
4. Step 2: Selecionar cliente existente (dropdown deve listar clientes — agora com colunas novas null)
5. Step 2: Adicionar 1 ambiente, adicionar 1 sistema de iluminacao a partir do catalogo
6. Step 3: Tela de revisao deve carregar, mostrando totais

**Expected:** zero crash; nenhum console error como "Cannot read property X of undefined" ou "TypeError"; lista de clientes/produtos renderiza.

**Result:** [ ] PASS  [ ] FAIL — <descrever falha>

**Console errors observados (se houver):** <colar>

### 2. Login admin + navegacao em abas

**Steps:**
1. Logout do colaborador, login com conta admin
2. Acessar /admin
3. Aba Produtos: lista deve renderizar com produtos existentes (arquiteto_id null em todos)
4. Aba Clientes: lista deve renderizar (contato/cpf_cnpj/arquiteto_id null em todos)
5. Aba Colaboradores: lista deve renderizar (cpf/telefone/setor null em todos)
6. Aba Orcamentos/Pedidos: lista deve renderizar (orcamentos antigos preservados)
7. Aba Excecoes: lista deve renderizar

**Expected:** todas as abas carregam sem crash; nenhum console error.

**Result:** [ ] PASS  [ ] FAIL — <descrever>

**Console errors observados:** <colar>

### 3. Renderizacao de orcamento antigo + geracao de PDF

**Steps:**
1. Como admin (ou colaborador dono), abrir um orcamento ja existente em prod (snapshot persistido antes destas migrations)
2. Conferir Step 3 / visualizacao de detalhe — totais, ambientes, itens
3. Acionar geracao de PDF
4. Abrir o PDF gerado e verificar que cliente, ambientes, sistemas e totais aparecem

**Expected:** orcamento antigo renderiza; PDF abre normalmente; nenhum campo do snapshot reclama de coluna ausente.

**Result:** [ ] PASS  [ ] FAIL — <descrever>

### 4. Supabase Dashboard — Schema visivel

**Steps:**
1. Abrir Supabase Dashboard (projeto jkewlaezvrbuicmncqbj) -> Table Editor
2. Confirmar que tabela `arquitetos` aparece e esta vazia (0 rows)
3. Em `arquitetos`: clicar e ver as 4 colunas (`id`, `nome`, `contato`, `created_at`)
4. Em `clientes`: confirmar que aparecem as colunas `arquiteto_id` (uuid, nullable, FK), `contato` (text, nullable), `cpf_cnpj` (text, nullable)
5. Em `produtos`: confirmar coluna `arquiteto_id` (uuid, nullable, FK)
6. Em `colaboradores`: confirmar colunas `cpf`, `telefone`, `setor` (todas text, todas nullable)
7. Em `colaboradores`: confirmar a CHECK constraint `check_colaboradores_setor` em Database -> Constraints (ou via SQL Editor: `\d colaboradores`)

**Expected:** todos os items confirmados visualmente.

**Result:** [ ] PASS  [ ] FAIL — <colar screenshot ou descrever>

### 5. Edge functions ainda respondem

**Steps:**
1. Em uma aba anonima (sem sessao), acessar a tela de pedido de acesso (request-access flow) em https://auraoramentos-kappa.vercel.app/...
2. Submeter pedido de acesso com email teste
3. Verificar resposta (sem 5xx)

**Expected:** form aceita o submit; sem 500. (Email pode ou nao chegar dependendo da decisao de PREP-01 sobre Resend — registrar separado.)

**Result:** [ ] PASS  [ ] FAIL — <descrever>

**Resend status (se aplicavel):** <Verified | Pending | N/A — depende do PREP-01 option-a vs option-b>

## Overall verdict

- [ ] **All PASS** — Phase 1 fechada, pronto para `/gsd-plan-phase 2`
- [ ] **Falhas detectadas** — registrar abaixo, abrir gap closure plan ou hotfix migration

## Gaps detectados (se houver)

<lista>
- Gap N: <descricao>
  - Componente: <arquivo / tela>
  - Sintoma: <erro / comportamento>
  - Hipotese: <causa>
  - Acao proposta: <hotfix / migration compensatoria / aceitar como conhecido>
</lista>
