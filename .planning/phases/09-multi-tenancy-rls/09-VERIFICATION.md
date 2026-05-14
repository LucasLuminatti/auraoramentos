---
phase: 09-multi-tenancy-rls
verified: 2026-05-14T17:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Logar no app em prod (https://orcamentosaura.com.br) como um colaborador não-admin e acessar um autocomplete de arquiteto ou lista de clientes"
    expected: "Colab vê apenas seus próprios cadastros; nenhum registro de outro colaborador aparece nas listas/autocompletes do wizard e do Drive"
    why_human: "Smoke 09-06 foi executado via chamadas REST diretas com JWTs reais, não via browser. Comportamento PostgREST/RLS é o mesmo, mas a confirmação UI (renderização visual em ArquitetoAutocomplete, ClienteList, DriveSidebar, DriveExplorer) ainda não foi exercida via browser."
---

# Phase 9: Multi-tenancy RLS — Relatório de Verificação

**Phase Goal:** Cada colaborador vê apenas os arquitetos e clientes que ele cadastrou, admin vê tudo — replicando exatamente o padrão validado em produção no Drive v1.0 (D-02 errata, `user_id` direto contra `auth.uid()`)
**Verificado:** 2026-05-14T17:00:00Z
**Status:** human_needed
**Re-verificação:** Não — verificação inicial

---

## Goal Achievement

### Truths Observáveis

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | Colab autenticado vê e edita apenas `clientes` onde `user_id = auth.uid()`; clientes de outros colabs não aparecem | VERIFICADO | Policy `"Colabs read own clientes, admins read all"` em prod (POST-PUSH snapshot 4 policies). Smoke COLAB-A-VE-SO-SEUS-CLI + COLAB-B-VE-SO-SEUS-CLI: PASS. COLAB-A-NAO-EDITA-B (UPDATE) retornou `[]`. |
| 2 | Colab autenticado vê e edita apenas `arquitetos` onde `user_id = auth.uid()`; arquitetos de outros colabs não aparecem nos autocompletes nem na lista | VERIFICADO | Policy `"Colabs read own arquitetos, admins read all"` em prod. Smoke COLAB-A-VE-SO-SEUS-ARQ + COLAB-B-VE-SO-SEUS-ARQ: PASS. Isolamento bilateral confirmado. |
| 3 | Admin (`has_role(admin)`) continua vendo todos os clientes e arquitetos de todos os colaboradores em todas as listas | VERIFICADO | Policies SELECT de ambas as tabelas têm `OR public.has_role(auth.uid(), 'admin'::app_role)`. Smoke ADMIN-VE-TODOS: admin Lenny (user_id `5bc17cc7-...`) viu `[Smoke A — Arq, Smoke B — Arq]` e `[Smoke A — Cli, Smoke B — Cli]`. PASS. |
| 4 | Criação de cliente/arquiteto preenche `user_id` automaticamente com `auth.uid()` do usuário logado (sem campo manual no form) | VERIFICADO | `ALTER TABLE public.arquitetos ALTER COLUMN user_id SET DEFAULT auth.uid()` e idem `clientes` na migration. DEFAULT verification em 09-PUSH-LOG.md: `column_default = auth.uid()` em ambas. Commit `71d28d7` (Phase 8) mantém user_id explícito no payload como defesa em camadas. |
| 5 | Smoke com 2 contas reais (colab A + colab B) confirma isolamento bilateral; admin vê união dos dois | VERIFICADO (REST API) | 7/7 PASS em 09-SMOKE-RESULTS.md. Método: chamadas REST diretas com JWTs reais obtidos via `GoTrue /auth/v1/token`. Path PostgREST é idêntico ao `supabase-js` no browser. **Nota de desvio:** plano original previa Playwright UI; executado via REST + SQL admin simulation (ver seção Human Verification). |

**Score:** 5/5 truths verificadas

---

### Artefatos Obrigatórios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql` | Migration RLS com BEGIN/COMMIT atômico, 8 CREATE POLICY, 6 DROP POLICY IF EXISTS, 2 ALTER COLUMN SET DEFAULT, 8 COMMENT ON POLICY | VERIFICADO | Arquivo existe. Contagens conferidas: 8 × CREATE POLICY, 6 × DROP POLICY IF EXISTS, 8 × COMMENT ON POLICY, 2 × ALTER TABLE...SET DEFAULT auth.uid(), 2 × ALTER TABLE...ENABLE ROW LEVEL SECURITY (statements), BEGIN + COMMIT presentes. |
| `.planning/phases/09-multi-tenancy-rls/09-PREFLIGHT.md` | Tabela auditoria 11 callsites, seção `## Callsite Audit`, 0 Risk callsites | VERIFICADO | Arquivo existe com 11 linhas de auditoria, todos classificados OK natural ou OK admin-only, 0 Risk. |
| `.planning/phases/09-multi-tenancy-rls/09-PUSH-LOG.md` | PRE-PUSH snapshot + POST-PUSH snapshot + Apply Log + DEFAULT verification | VERIFICADO | Arquivo completo. PRE: 2+4 policies legadas. POST: 4+4 policies novas. Apply: SUCCESS. DEFAULT: `auth.uid()` em ambas. Build: exit 0. Lint: exit 1 (754 erros pré-existentes, Phase 9 não tocou em `.ts/.tsx`). |
| `.planning/phases/09-multi-tenancy-rls/09-SMOKE-SETUP.md` | 2 smoke users, 4 smoke cadastros com user_id correto | VERIFICADO | Arquivo existe com UUIDs reais distintos (user A: `59ae4002-...`, user B: `d2f20ee9-...`). 4 cadastros com user_id associado ao dono correto. Acceptance queries: 2/2 arquitetos, 2/2 clientes, 2/2 auth.users, 2/2 colaboradores, 0 admin roles. |
| `.planning/phases/09-multi-tenancy-rls/09-SMOKE-RESULTS.md` | 7 casos PASS, `**Overall:** 7/7 PASS` | VERIFICADO | Arquivo existe com os 7 casos documentados e `**Overall:** 7/7 PASS`. Cada caso tem `**Observed:**` populado com payload literal (não placeholder). |
| `.planning/phases/09-multi-tenancy-rls/09-CLEANUP-LOG.md` | Cleanup pós-smoke, zero residual | VERIFICADO (estrutura diverge) | Arquivo existe. Confirma: 2 arquitetos + 2 clientes + 2 colaboradores + 2 allowed_users + 2 auth.identities + 2 auth.users deletados. Zero residual confirmado via SQL. RLS-01 e RLS-02 marcados DELIVERED. **Nota:** headings `## COUNT before`, `## COUNT after`, `## DELETE results` do template do plano não estão presentes — arquivo usa `## Deleted`, `## Verification`, `## Phase 9 closure status`. Divergência de estrutura documental apenas, não afeta goal. |

---

### Key Links Verificados

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `supabase/migrations/...rls.sql` | Prod RLS state (jkewlaezvrbuicmncqbj) | `apply_migration` MCP | VERIFICADO | POST-PUSH snapshot confirma 4 policies em arquitetos + 4 em clientes, exatamente os nomes esperados. Apply: SUCCESS, sem erros. |
| `arquitetos` RLS policies | `public.has_role(auth.uid(), 'admin')` | USING clause | VERIFICADO | 3 das 4 policies (SELECT/UPDATE/DELETE) têm `OR public.has_role(auth.uid(), 'admin'::app_role)`. INSERT mantém `user_id = auth.uid()` only (D-06). |
| `clientes` RLS policies | `public.has_role(auth.uid(), 'admin')` | USING clause | VERIFICADO | Idêntico ao padrão arquitetos. Replicação Drive D-02 confirmada. |
| `ArquitetoDialog.tsx` / `ClienteDialog.tsx` | user_id no INSERT | `userData.user.id` + DEFAULT | VERIFICADO | Commit `71d28d7` (Phase 8) injeta `user_id` no payload. DEFAULT `auth.uid()` na coluna serve como redundância segura (cinto-e-suspensórios). WITH CHECK `user_id = auth.uid()` bloqueia payload arbitrário. |

---

### Data-Flow Trace (Level 4)

Não aplicável para esta fase — a fase não cria nem modifica componentes React que renderizam dados dinâmicos. Toda a entrega é DDL (migration SQL) + documentação. Os componentes existentes (`ArquitetoAutocomplete`, `ClienteList`, etc.) não foram modificados; o filtro ocorre no banco via RLS antes dos dados chegarem ao cliente.

---

### Behavioral Spot-Checks

| Comportamento | Verificação | Resultado | Status |
|---------------|-------------|-----------|--------|
| Migration aplicada em prod com 8 policies novas | POST-PUSH snapshot em 09-PUSH-LOG.md | 4 policies arquitetos + 4 clientes, nomes esperados confirmados | PASS |
| DEFAULT auth.uid() em ambas as colunas | `information_schema.columns` query em 09-PUSH-LOG.md | `column_default = auth.uid()` em arquitetos e clientes | PASS |
| Policies legadas removidas | Diff PRE→POST em 09-PUSH-LOG.md | 6 legadas dropadas, nenhuma aparece no POST-PUSH | PASS |
| Isolamento bilateral via JWT real | 09-SMOKE-RESULTS.md | 7/7 PASS via REST API com tokens GoTrue reais | PASS |
| Zero residual após cleanup | 09-CLEANUP-LOG.md verificação SQL | 0 rows `Smoke %` em arquitetos e clientes | PASS |

---

### Cobertura de Requisitos

| Requisito | Plano fonte | Descrição | Status | Evidência |
|-----------|-------------|-----------|--------|-----------|
| RLS-01 | 09-01 a 09-07 | Colaborador vê apenas os clientes que ele cadastrou; admin vê todos | ATENDIDO | 4 policies em `clientes` em prod. Smoke COLAB-A/B-VE-SO-SEUS-CLI: PASS. CLEANUP-LOG: `RLS-01: DELIVERED`. |
| RLS-02 | 09-01 a 09-07 | Colaborador vê apenas os arquitetos que ele cadastrou; admin vê todos | ATENDIDO | 4 policies em `arquitetos` em prod. Smoke COLAB-A/B-VE-SO-SEUS-ARQ: PASS. CLEANUP-LOG: `RLS-02: DELIVERED`. |

**Requisitos orphaned mapeados para Phase 9 em REQUIREMENTS.md:** nenhum além de RLS-01 e RLS-02. RLS-03 está mapeado para Phase 7 (schema `user_id`) e já foi entregue.

---

### Anti-Patterns Encontrados

| Arquivo | Padrão | Severidade | Impacto |
|---------|--------|------------|---------|
| `09-PUSH-LOG.md` linha 114 | `npm run lint: exit 1` | Info | 754 erros lint pré-existentes (Phase 7-8 baseline). Phase 9 não introduziu nenhum (só tocou `.sql`). Não bloqueia goal. |
| `09-CLEANUP-LOG.md` | Headings divergem do template do plano (faltam `## COUNT before`, `## COUNT after`, `## DELETE results`) | Info | Divergência documental apenas. Conteúdo equivalente presente em `## Deleted` e `## Verification`. Não afeta goal. |
| `09-SMOKE-RESULTS.md` | Smoke via REST API em vez de Playwright UI (desvio do plano 09-06) | Aviso | Exercita o mesmo caminho PostgREST/RLS, mas comportamento visual dos componentes React (`ArquitetoAutocomplete`, `ClienteList`, `DriveSidebar`, `DriveExplorer`) não foi confirmado em browser. |

---

### Human Verification Required

#### 1. Confirmação UI no browser (colab vê só os seus)

**Teste:** Logar em https://orcamentosaura.com.br como colaborador não-admin. Criar um novo orçamento (wizard), avançar até Step 2 (Ambientes), abrir um dialog de cliente/arquiteto. Verificar o autocomplete de arquiteto e o seletor de cliente.

**Esperado:** Apenas os arquitetos e clientes cadastrados pelo próprio colaborador aparecem. Nenhum registro de outro colaborador é visível.

**Por que humano:** O smoke 09-06 foi executado via chamadas REST diretas com JWTs reais do GoTrue. O PostgREST aplica RLS identicamente, mas a renderização dos componentes React (`ArquitetoAutocomplete.tsx`, `ClienteList.tsx`, `DriveSidebar.tsx`, `DriveExplorer.tsx`) no browser real ainda não foi confirmada visualmente após a migration. Este é o teste de "campo" que fecha completamente o success criterion #5 do roadmap.

**Alternativa mínima:** Um colaborador real (ex: Lucas ou outro colab não-admin) confirma no app em produção que não consegue ver clientes/arquitetos de outros colabs.

---

### Resumo dos Gaps

Nenhum gap funcional identificado. A fase entregou:

- Migration atômica aplicada em prod com 8 policies novas replicando Drive D-02
- DEFAULT `auth.uid()` setado em ambas as colunas (defesa em camadas com hotfix Phase 8)
- Todas as 6 policies legadas dropadas
- 7/7 smoke cases PASS com JWTs reais via REST API
- Cleanup completo (zero residual)
- Auditoria de 11 callsites sem nenhum Risk

O único item pendente é confirmação visual no browser (desvio de método no smoke), que é uma verificação humana — não um gap de implementação.

---

_Verificado: 2026-05-14T17:00:00Z_
_Verificador: Claude (gsd-verifier)_
