# Phase 9: Multi-tenancy RLS - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Ativar isolamento por colaborador em `arquitetos` e `clientes` via RLS, replicando o padrão validado em produção desde Phase 4 (Drive D-02 errata). `user_id NOT NULL` + FK + index já estão em prod (Phase 7 D-01..D-05) e a Phase 8 hotfix `71d28d7` já injeta `user_id` no dialog. Phase 9 só fecha o loop:

1. **DDL**: `ALTER COLUMN user_id SET DEFAULT auth.uid()` em ambas as tabelas (cinto-e-suspensórios contra a regressão Phase 7)
2. **RLS policies**: DROP das policies abertas (`USING (true)`) + CREATE das 4 policies por tabela seguindo padrão Drive (SELECT/UPDATE/DELETE com `OR has_role(admin)`, INSERT com `user_id = auth.uid()` only)
3. **Auditoria das queries do client**: 10 callsites identificados — RLS filtra naturalmente, mas auditar pra garantir que nenhum quebra silenciosamente
4. **Smoke bilateral em prod**: 2 colabs de teste reais (signup via UI) cada um cria 1 arquiteto + 1 cliente; Playwright loga em A e confirma não-visão de B; admin vê união; cleanup ao fim

**Out of scope:**
- Storage policies (Drive já tem; arquitetos/clientes não têm arquivos próprios)
- Mudanças em wizard, PDF, dashboard
- RLS em outras tabelas (orcamentos, produtos, exception_messages — já cobertas em phases anteriores ou fora do escopo v1.1)
- INSERT cross-user para admin (rejeitado — D-08)

</domain>

<decisions>
## Implementation Decisions

### Pattern de policy (replicar Drive D-02)
- **D-01:** Replicar **literalmente** o pattern Drive (`supabase/migrations/20260504000001_drive_rls_user_id.sql` Blocos 5 e 6) — 4 policies por tabela (SELECT/INSERT/UPDATE/DELETE), `OR has_role(admin)` em SELECT/UPDATE/DELETE, `user_id = auth.uid()` only em INSERT WITH CHECK. Zero divergência.
- **D-02:** Policies legadas a derrubar (verificado via `pg_policies` em 2026-05-14):
  - `arquitetos`: `"Anyone can read arquitetos"` (SELECT true), `"Admins can manage arquitetos"` (ALL admin) — ambas dropadas
  - `clientes`: `"Anyone can read clientes"`, `"Authenticated users can insert/update/delete clientes"` (todas USING/WITH CHECK true) — todas 4 dropadas
- **D-03:** RLS já está ENABLED em ambas (verificar com `pg_class.relrowsecurity` antes; idempotência via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` no DO bloco se necessário)

### DEFAULT auth.uid() no user_id (defesa contra regressão Phase 7)
- **D-04:** `ALTER TABLE public.arquitetos ALTER COLUMN user_id SET DEFAULT auth.uid()` + idem `public.clientes`. Schema desacopla da UI: qualquer caller que esquecer `user_id` no INSERT pega o uid de quem está logado em vez de explodir 400. Hotfix do dialog (`71d28d7`) vira redundância segura — **não remover** (idempotência + clareza local).
- **D-05:** WITH CHECK do RLS (`user_id = auth.uid()`) continua válido com DEFAULT — defesa em camadas. Se o app fizer override com `user_id` arbitrário e o user não for esse, WITH CHECK falha.

### Permissão de admin no INSERT
- **D-06:** Admin **não pode** criar arquiteto/cliente em nome de outro colab via INSERT. Replica Drive: WITH CHECK só permite `user_id = auth.uid()`. Admin que precisar transferir usa UPDATE (que tem `OR has_role(admin)` liberado). Sem caso de uso atual que justifique policy mais frouxa.

### Migration organization
- **D-07:** **Uma única migration** `supabase/migrations/20260514000001_arquitetos_clientes_rls.sql` cobrindo (em BEGIN/COMMIT atômico):
  1. `ALTER COLUMN user_id SET DEFAULT auth.uid()` em ambas
  2. DROP das 6 policies legadas (2 em arquitetos + 4 em clientes)
  3. ENABLE ROW LEVEL SECURITY (idempotente)
  4. CREATE das 8 policies novas (4 por tabela)
  5. COMMENT em cada policy citando "Phase 9 RLS-01/RLS-02 / padrão Drive D-02"
- **D-08:** Push via `mcp__plugin_supabase_supabase__apply_migration` (mesmo padrão Phase 8 D-06, mesmo token owner). PUSH-LOG documenta `pg_policies` antes/depois.

### Auditoria das queries do client (pre-flight read-only)
- **D-09:** Antes de planejar, plan deve auditar os 10 callsites e marcar cada um como:
  - **OK natural** — RLS filtra, comportamento desejado (ex: ArquitetoAutocomplete colab vê só os dele)
  - **OK admin-only** — query está em tela admin, RLS filtra mas admin vê tudo via `has_role(admin)` (ex: PrecosBatch, Admin.tsx fetches)
  - **Risk** — caso onde RLS pode esconder dado que o user precisa ver (ex: ProdutoEditDialog lista arquitetos pra associar produto — admin cria produto e precisa ver TODOS os arquitetos; OK se essa tela é admin-only)
- **D-10:** Os 10 callsites a auditar:
  - `src/components/ArquitetoAutocomplete.tsx:54`
  - `src/components/ClienteList.tsx:58`
  - `src/components/ClienteDialog.tsx:45` (autocomplete arquiteto no form cliente)
  - `src/components/ClienteFilterAutocomplete.tsx:48`
  - `src/components/DriveSidebar.tsx:39`
  - `src/components/DriveExplorer.tsx:110`
  - `src/pages/Admin.tsx:286, 347, 364` (3 fetches)
  - `src/pages/Admin.tsx:379, 404` (DELETE)
  - `src/components/PrecosBatch.tsx:69`
  - `src/components/ProdutoEditDialog.tsx:56`
  - INSERT/UPDATE em `ClienteDialog.tsx:85,88` e `ArquitetoDialog.tsx:84,87` (já com user_id pós-hotfix)
- **D-11:** Não esperar mudança no código do client. RLS filtra. Se auditoria revelar quebra, plan adiciona task explícita (não inflar phase escopo proativamente).

### Smoke bilateral em prod (RLS-01 + RLS-02 success criteria #5)
- **D-12:** Criar **2 colabs de teste reais em prod** via signup completo:
  - `smoke-colab-a@luminattiled.com.br` e `smoke-colab-b@luminattiled.com.br` (ou subdomínio gmail+tag se Resend rejeitar)
  - Adicionar ambos em `allowed_users` antes do signup
  - Cada um faz signup completo (CPF/telefone/setor obrigatórios) e auto-cria colaborador
- **D-13:** Cada colab cria via UI: 1 arquiteto + 1 cliente (com nome distinto `Smoke A — Arq`, `Smoke B — Cli`, etc)
- **D-14:** Playwright valida:
  - Login como A → tab Cadastros > Arquitetos → vê só `Smoke A — Arq` (não `Smoke B — Arq`)
  - Login como A → tab Cadastros > Clientes → vê só `Smoke A — Cli`
  - Login como B → simétrico
  - Login como admin (Lenny) → vê **ambos** os arquitetos e clientes de smoke + os reais
- **D-15:** Cleanup ao fim do smoke:
  ```sql
  DELETE FROM public.arquitetos WHERE nome LIKE 'Smoke %';
  DELETE FROM public.clientes WHERE nome LIKE 'Smoke %';
  -- auth.users dos 2 colabs ficam (não dá pra deletar via SQL público sem service role) — registrar em pending cleanup
  ```
  Manualmente desativar os 2 colabs via admin tab ou deixar como pending cleanup pra housekeeping
- **D-16:** Smoke documentado em `09-SMOKE-RESULTS.md` (padrão Phase 7/8). Bug bilateral encontrado → block & fix; bug admin-view → block & fix; só fecha phase com smoke 100% PASS.

### Claude's Discretion
- Naming exato das policies (pode replicar exatamente o wording Drive: `"Colabs read own arquitetos, admins read all"`, etc)
- Estrutura interna do PUSH-LOG (padrão Phase 7/8)
- Ordem das policies dentro da migration (geralmente SELECT → INSERT → UPDATE → DELETE)
- Decisão de manter ou não os 2 colabs de smoke como users desativados após cleanup (housekeeping)

### Folded Todos
[Nenhum. `gsd-tools todo match-phase 9` não retornou matches relevantes.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrão Drive (TEMPLATE 1:1 PARA Phase 9)
- `supabase/migrations/20260504000001_drive_rls_user_id.sql` — Blocos 5 e 6 são o template literal das policies; Bloco 4 (NOT NULL) **não** se aplica (Phase 7 já fez)
- `.planning/phases/04-drive-rls-reorganiza-o-admin/04-CONTEXT.md` — decisões D-02 (errata user_id direto) e D-03 (RLS direta com auth.uid()) que Phase 9 replica

### Phase 7 carry-over (user_id já em prod)
- `.planning/phases/07-schema-prep-v1-1/07-CONTEXT.md` §D-01..D-06 — user_id NOT NULL + FK RESTRICT + index BTREE + COMMENT já aplicado
- `supabase/migrations/20260511000001_arquitetos_clientes_user_id.sql` — migration Phase 7 RLS-03 (read-only context, não modificar)

### Phase 8 carry-over (hotfix dialog)
- `.planning/phases/08-cadastros-opcionalizar-imagens-manuais/SMOKE-RESULTS.md` §"Bug encontrado e fixado" — contexto da regressão Phase 7
- Commit `71d28d7` — `fix(08-05): set user_id on cliente/arquiteto insert` — manter; vira redundância segura após DEFAULT
- `src/components/ClienteDialog.tsx:79-87` e `src/components/ArquitetoDialog.tsx:78-86` — padrão `supabase.auth.getUser()` + injeção

### Callsites do client (auditoria D-09/D-10)
- `src/components/ArquitetoAutocomplete.tsx:54` — SELECT arquitetos (autocomplete)
- `src/components/ClienteList.tsx:58` — SELECT clientes (lista)
- `src/components/ClienteFilterAutocomplete.tsx:48` — SELECT clientes (filtro)
- `src/components/ClienteDialog.tsx:45` — SELECT arquitetos no edit cliente
- `src/components/DriveSidebar.tsx:39` — SELECT clientes (sidebar Drive)
- `src/components/DriveExplorer.tsx:110` — SELECT clientes (Drive)
- `src/components/PrecosBatch.tsx:69` — SELECT arquitetos (admin tab Preços)
- `src/components/ProdutoEditDialog.tsx:56` — SELECT arquitetos (associar produto)
- `src/pages/Admin.tsx:286, 347, 364, 379, 404` — admin tab Cadastros

### Função has_role e helpers
- `src/hooks/useUserRole.ts` — hook que lê `user_roles` (já validado em Drive)
- DB function `public.has_role(uid uuid, role app_role)` (Definer SECURITY) — já existe e é usada em policies Drive

### Projeto + marco
- `.planning/PROJECT.md` — Key Decisions tabela: "Drive RLS via user_id (não colaborador_id)" (v1.0 D-02 errata)
- `.planning/REQUIREMENTS.md` §RLS-01, §RLS-02 — IDs cobertos pela Phase 9
- `.planning/ROADMAP.md` §"Phase 9: Multi-tenancy RLS" — goal + success criteria + depends_on (Phase 7)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Drive RLS migration** (`20260504000001_drive_rls_user_id.sql`): copy-paste 1:1 de Blocos 5 e 6, trocar nome das tabelas. Adicionar bloco 0 com `ALTER COLUMN ... SET DEFAULT auth.uid()` antes dos drops.
- **`has_role()` SECURITY DEFINER function**: já existe em prod (`public.has_role(uid, role)`), usada em Drive — Phase 9 só consome.
- **`useUserRole` hook**: leitura no client; nenhuma policy depende disso (decisão é só DB-side).

### Established Patterns
- **Migration única por phase quando policies cabem em BEGIN/COMMIT atômico** (Drive Phase 4 fez assim).
- **Push via MCP `apply_migration`**: validado em Phase 7 e 8, prefere a CLI `supabase db push` por idempotência e log estruturado.
- **Smoke bilateral via Playwright + 2 contas reais**: padrão herdado de v1.0 closure (Phase 6 fez signup real pra validar Drive RLS).
- **`USING (col = auth.uid() OR has_role(admin))`** em SELECT/UPDATE/DELETE; **`WITH CHECK (col = auth.uid())`** strict no INSERT — padrão Drive 100% replicado.

### Integration Points
- **DialogClient/Arquiteto**: pós-RLS, INSERT continua funcionando (DEFAULT + WITH CHECK alinhados). Edit continua não tocando user_id.
- **DriveExplorer/Sidebar**: hoje fetch `SELECT id, nome FROM clientes`. Pós-RLS, colab Drive (que já tem RLS por user_id em arquivo_pastas/cliente_arquivos) vai ver só os clientes dele — **consistente**, sem mudança no código.
- **Admin tab**: admin já tem `has_role(admin) = true` → RLS libera tudo, comportamento idêntico ao atual.
- **PrecosBatch**: tela admin, vê tudo via `has_role(admin)`.
- **ProdutoEditDialog**: tela admin (lista admin-only); RLS libera arquitetos pra admin.

### Risco identificado
- **ColabExplorer não-admin chamando rotas de produto**: produto não tem RLS por user_id (intencional — produto é global). Se algum dia produto ganhar dono, revisar. Phase 9 **não toca produto**.
- **ColaboradorDialog filtrando arquitetos**: não existe esse cenário hoje; arquiteto só aparece em formulários cliente e produto, ambos admin-only.

</code_context>

<specifics>
## Specific Ideas

- **Smoke colabs reais via signup completo**: Lenny já validou o fluxo de signup com CPF/telefone/setor após o fix do `request-access` (commit 16c0b14). Smoke usa o mesmo fluxo, não precisa contornar.
- **Cleanup de auth.users não disponível via SQL público**: deletar usuário do Supabase Auth precisa service role (REST API). Smoke vai documentar 2 emails de teste pendentes e adicionar em [[project_aura_pending_cleanup]]. Não-bloqueante.
- **Hotfix do dialog (commit 71d28d7) NÃO é revertido**: vira defesa em camadas. Lenny aprovou opção 1 ("DEFAULT na coluna") explicitamente, não opção 3 ("tirar hotfix + DEFAULT").

</specifics>

<deferred>
## Deferred Ideas

- **Edge cases nas queries do client (4ª área pulada)**: Lenny optou por não discutir explicitamente — D-09/D-10 captura como tarefa de auditoria do plan, não como decisão pré-locked.
- **Admin INSERT cross-user (D-08 rejeitado)**: revisitar se onboarding em massa virar caso de uso real.
- **Cleanup automático dos 2 auth.users de smoke**: requer service role. Fica como housekeeping em pending cleanup.
- **RLS em outras tabelas v1.1**: `orcamentos.status`, `produtos`, etc — não escopo Phase 9.

### Reviewed Todos (not folded)
[Nenhum todo relevante encontrado por `gsd-tools todo match-phase 9`.]

</deferred>

---

*Phase: 09-multi-tenancy-rls*
*Context gathered: 2026-05-14*
</content>
</invoke>