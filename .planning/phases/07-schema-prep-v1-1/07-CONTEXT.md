# Phase 7: Schema & Prep v1.1 - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrations aditivas em produção que desbloqueiam o resto do v1.1, **sem mexer em UI** e **sem regressão**:

1. `arquitetos.user_id UUID NOT NULL` + `clientes.user_id UUID NOT NULL` (FK `auth.users(id)` ON DELETE RESTRICT, backfill = admin mais antigo) — desbloqueia Phase 9 (RLS multi-tenancy)
2. `clientes.data_nascimento DATE NULL` + índice BTREE — desbloqueia Phase 12 (cron de aniversário)
3. `orcamentos.status` — rename de `'fechado'` → `'aprovado'`, adicionar `'pendente'`, fixar CHECK com 4 valores (`rascunho|aprovado|perdido|pendente`), manter DEFAULT `'rascunho'` — desbloqueia Phase 10 (WIZ-04 status)
4. `product_variants` descrição rica — verificação via SQL que `atributos` JSONB cobre temperatura_k/IRC/nicho nos masters; gaps viram FOLLOW-UP, não bloqueiam — desbloqueia Phase 10 (WIZ-05)

Encerramento da Phase: smoke leve em prod (SQL counts + 1 query crítica do wizard + 1 abertura via Playwright) confirma critério #5 (zero regressão).

**Out of scope da Phase 7 (mas presente no marco):** UI, edição de wizard, RLS policies em si (vai pra Phase 9), edge function de aniversário (Phase 12), Step3 ajuste de preço (Phase 10). Phase 7 só prepara o terreno SQL.

</domain>

<decisions>
## Implementation Decisions

### user_id em arquitetos e clientes (RLS-03)
- **D-01:** Coluna `user_id UUID` com FK `auth.users(id) ON DELETE RESTRICT`. Divergência consciente do padrão Drive D-05 (que usou SET NULL): cliente/arquiteto carregam histórico de orçamentos — bloquear delete do auth.user até admin reassignar manualmente é o comportamento correto aqui
- **D-02:** Backfill = admin mais antigo, idêntico ao padrão Drive D-04: `SELECT ur.user_id FROM user_roles ur INNER JOIN colaboradores c ON c.user_id = ur.user_id WHERE ur.role = 'admin' ORDER BY c.created_at ASC LIMIT 1`. Pre-flight assert (`RAISE EXCEPTION` se admin_count = 0) replicado de Drive (Pitfall 6)
- **D-03:** `NOT NULL` aplicado **depois** do backfill (Bloco ALTER COLUMN SET NOT NULL no fim da migration). Padrão idêntico ao Drive v1.0
- **D-04:** Index BTREE em `arquitetos.user_id` e `clientes.user_id` (`CREATE INDEX idx_arquitetos_user_id ...`, `CREATE INDEX idx_clientes_user_id ...`) — Phase 9 vai filtrar por `user_id = auth.uid()` em todas as queries do CRUD/autocomplete
- **D-05:** COMMENT em cada coluna citando "Phase 7 RLS-03 / padrão Drive D-02 errata"
- **D-06:** Phase 7 **NÃO** cria as RLS policies de `arquitetos`/`clientes` — isso é trabalho da Phase 9. Phase 7 só adiciona a coluna + backfill + NOT NULL + index. As policies atuais (`USING (true)` para SELECT) permanecem inalteradas

### data_nascimento em clientes (AUTO-03)
- **D-07:** `clientes.data_nascimento DATE NULL` — aditivo, sem default, sem backfill (campo opcional preenchido pelo admin no FORM-02 da Phase 8)
- **D-08:** Index BTREE simples em `clientes(data_nascimento)` agora (sem index funcional MONTH/DAY — premature optimization para volume atual). Phase 12 pode trocar por index funcional se profiling indicar
- **D-09:** COMMENT na coluna citando "Phase 7 AUTO-03 / cron de aniversário Phase 12"

### orcamentos.status (AUTO-03 corolário — destrava WIZ-04)
- **D-10:** UPDATE in-place `SET status = 'aprovado' WHERE status = 'fechado'` (mudança destrutiva consciente no dado, mas o schema continua aditivo — coluna não muda forma)
- **D-11:** ADD CHECK constraint `status IN ('rascunho','aprovado','perdido','pendente')` após o UPDATE. Hoje não tem CHECK (TEXT livre) — adicionar agora trava regressão futura
- **D-12:** Manter DEFAULT `'rascunho'` (zero mudança no comportamento de criação do wizard)
- **D-13:** Tipo TypeScript em `src/types/orcamento.ts:109` (`'rascunho' | 'fechado' | 'perdido'`) **fica desatualizado de propósito** durante a Phase 7. Sync TS + regenerar `src/integrations/supabase/types.ts` é Phase 10 (WIZ-04). Step3Revisao.tsx:224 grava 'rascunho' — continua válido após CHECK
- **D-14:** Pre-flight assert ao final: `SELECT count(*) FROM orcamentos WHERE status NOT IN ('rascunho','aprovado','perdido','pendente')` deve retornar 0 antes de aplicar a CHECK (defensa contra valores inesperados em prod)

### Descrição rica em product_variants (verificação de cobertura — WIZ-05)
- **D-15:** Manter campos no `atributos` JSONB. Phase 10 (WIZ-05) lê `atributos->>'temperatura_k'`, `atributos->>'irc'`, `atributos->>'nicho'`, `atributos->>'cor_iluminacao'` + coluna typed `potencia_watts`. Zero migration de schema aqui
- **D-16:** Auditoria via SQL (sem abrir XLSX): `SELECT count(*), origem FROM product_variants WHERE origem = 'master' AND (atributos->>'temperatura_k' IS NULL OR atributos->>'irc' IS NULL OR atributos->>'nicho' IS NULL) GROUP BY origem` — resultado vai pro SUMMARY.md
- **D-17:** Gap policy: gaps não bloqueiam o fechamento da Phase 7. São registrados como FOLLOW-UP (todo + nota em SUMMARY) para correção via re-ImportMaster ou edição manual no admin (Phase 8 FORM-03 cobre coringa). Phase 10 (WIZ-05 success criteria #5) já trata variant sem dado renderizando só o nome cru
- **D-18:** SKUs `origem='coringa'` (AU001..AU016) e `origem='legado'` **não** entram na auditoria — eles não vêm da master, é esperado que `atributos` esteja vazio neles. Phase 8 (FORM-03) é quem dá descrição/imagem editável aos coringas

### Organização das migrations
- **D-19:** 3 arquivos separados de migration por domínio (padrão v1.0):
  - `20260511000001_arquitetos_clientes_user_id.sql` (RLS-03; D-01..D-06)
  - `20260511000002_clientes_data_nascimento.sql` (AUTO-03 corolário 1; D-07..D-09)
  - `20260511000003_orcamentos_status_enum.sql` (destrava WIZ-04; D-10..D-14)
- **D-20:** Cada migration roda dentro de `BEGIN/COMMIT` (atomicidade por domínio). Push via `supabase db push` (ambiente Lenny já autenticado em prod)
- **D-21:** Ordem de push: user_id primeiro, depois data_nascimento, depois status. Sem dependência cruzada, mas user_id é a mais delicada (pre-flight assert, backfill) — se algo der ruim, falha primeiro

### Smoke de regressão (critério #5)
- **D-22:** Pós-push em prod, rodar:
  1. SQL: `SELECT count(*) FROM clientes`, `SELECT count(*) FROM arquitetos`, `SELECT count(*) FROM orcamentos`, `SELECT count(*) FROM product_variants` — comparar com snapshot pré-push (registrar em PUSH-LOG.md)
  2. SQL: `SELECT o.id, c.nome, a.nome FROM orcamentos o JOIN clientes c ON c.id = o.cliente_id LEFT JOIN arquitetos a ON a.id = c.arquiteto_id LIMIT 5` (query típica do wizard/Pedidos — confirma JOIN ainda funciona)
  3. SQL: `SELECT count(*) FROM orcamentos WHERE status IN ('rascunho','aprovado','perdido','pendente')` deve bater com count(*) total (CHECK constraint válida)
  4. Playwright: abrir `https://orcamentosaura.com.br`, login, abrir `/` (wizard), confirmar Step 1 renderiza colaborador + cliente sem erro JS no console
- **D-23:** Smoke resultados em `07-SMOKE-RESULTS.md` (padrão v1.0). Bug encontrado → registrar e decidir bloquear/seguir antes de fechar a phase

### Claude's Discretion
- Naming exato dos índices (pode seguir convenção `idx_<tabela>_<coluna>`)
- Texto exato dos COMMENT (desde que cite fase + decisão)
- Estrutura interna dos blocos SQL (pre-flight / ADD / backfill / NOT NULL / indexes / comments) — Claude segue o template do `20260504000001_drive_rls_user_id.sql`
- Format do SUMMARY.md e PUSH-LOG.md

### Folded Todos
[Nenhum todo dobrado. Os 2 todos que o cross_reference_todos encontrou (PDF estético) pertencem à Phase 11, não à 7.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrão validado v1.0 (Drive RLS — D-02 errata) — TEMPLATE PARA user_id
- `supabase/migrations/20260504000001_drive_rls_user_id.sql` — padrão completo de ADD COLUMN user_id + pre-flight assert + backfill admin mais antigo + NOT NULL + RLS policies. Phase 7 replica o pre-flight + backfill + NOT NULL (mas **não** as RLS policies; isso é Phase 9)
- `supabase/migrations/20260504000002_arquivo_url_nullable.sql` — erratum subsequente que mostra como Drive ajustou ON DELETE de NOT NULL conflitando com signed URL legado

### Schema atual relevante (read-before-touch)
- `supabase/migrations/20260213150619_c40f8f90-794b-4d08-90b8-635ef7968cc9.sql` — definição de `clientes`, `colaboradores`, `orcamentos` (orcamentos.status já existe como TEXT NOT NULL DEFAULT 'rascunho')
- `supabase/migrations/20260423000001_create_arquitetos.sql` — `arquitetos` table (RLS atual: SELECT aberto, escrita admin-only)
- `supabase/migrations/20260423000002_clientes_arquiteto_contato_cpf.sql` — `clientes.arquiteto_id`, `contato`, `cpf_cnpj` (campos opcionais validados em v1.0)
- `supabase/migrations/20260501000001_products_and_variants.sql` — `product_variants` schema com `atributos JSONB` (D-02) onde temperatura_k/irc/nicho já vivem para variants master
- `src/lib/productAttributes.ts` §`mapMasterRow` — confirma quais campos da master vão para `atributos` JSONB (temperatura_k, irc, nicho, cor_iluminacao, lumens, eficiencia, ...)

### Código que toca status do orçamento (sync check)
- `src/types/orcamento.ts:109` — `export type StatusOrcamento = 'rascunho' | 'fechado' | 'perdido'` (fica desatualizado de propósito; Phase 10 sincroniza)
- `src/components/Step3Revisao.tsx:224` — único INSERT com `status: "rascunho"` (não afetado pela CHECK)
- `src/integrations/supabase/types.ts` — types autogerados; regen é Phase 10

### Projeto + marco
- `.planning/PROJECT.md` — Key Decisions tabela: "Drive RLS via user_id (não colaborador_id)" (v1.0 D-02 errata)
- `.planning/REQUIREMENTS.md` §RLS-03, §AUTO-03 — IDs cobertos pela Phase 7
- `.planning/ROADMAP.md` §Phase 7 — goal, depends_on, success_criteria, requirements

### Drive contexto operacional
- Push de schema: `supabase db push` (CLI já autenticado no projeto `jkewlaezvrbuicmncqbj`, region sa-east-1) — ver `src/integrations/supabase/client.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Drive RLS migration template** (`20260504000001_drive_rls_user_id.sql`): copy-paste do pattern de pre-flight + backfill + NOT NULL + indexes. Phase 7 muda só nome das tabelas e drop dos blocos de policies (que ficam pra Phase 9)
- **product_variants.atributos JSONB**: dados de descrição rica já vivem aqui para 2.088 variants master importadas em v1.0 — Phase 7 só audita

### Established Patterns
- **Schema aditivo, nunca destrutivo**: 9 migrations em v1.0 mantidas todas aditivas — Phase 7 mantém o pacto (UPDATE de dado em status é a única exceção registrada, schema permanece o mesmo formato)
- **Pre-flight assert via DO $$ BEGIN ... RAISE EXCEPTION ... END $$**: Drive D-02 estabeleceu o padrão; replicar antes do backfill admin-mais-antigo
- **COMMENT obrigatório**: toda coluna nova ganha COMMENT citando fase + decisão (rastreabilidade no DB)
- **Push manual via `supabase db push`** em prod: validado 9 vezes em v1.0 (zero regressão)

### Integration Points
- **Phase 9 consumirá `user_id`** em RLS policies (`USING (user_id = auth.uid() OR has_role(...,'admin'))`)
- **Phase 10 consumirá `orcamentos.status`** + tipo TS atualizado para WIZ-04 (status badges em Pedidos)
- **Phase 10 consumirá `product_variants.atributos`** via JSON ops em WIZ-05 (descrição rica)
- **Phase 12 consumirá `clientes.data_nascimento`** em edge function de aniversário + cron pg_cron

</code_context>

<specifics>
## Specific Ideas

- **Ordem de push das migrations:** user_id (mais sensível, pre-flight pode falhar primeiro) → data_nascimento (trivial) → status (UPDATE in-place precisa rodar antes da CHECK)
- **PUSH-LOG.md template** (padrão v1.0): cada migration ganha entrada com timestamp + duração + `SELECT count(*)` antes/depois + URL Supabase dashboard pra confirmar
- **Smoke Playwright headless** (em vez de testar 2 contas reais): só abre `https://orcamentosaura.com.br`, login com Lenny, abre `/` e verifica console limpo — o teste de 2 contas reais fica para Phase 13

</specifics>

<deferred>
## Deferred Ideas

- **Audit log de mudanças de status** (orcamentos_status_history) — Lenny mencionou em passagem; vira phase futura se virar requirement de compliance
- **Tradução UI dos status** (aprovado vs ganho, perdido vs cancelado) — decisão de UX, Phase 10 (WIZ-04) trata
- **Index funcional MONTH/DAY em data_nascimento** — opção descartada como premature optimization; revisar em Phase 12 se profiling indicar
- **Promover atributos JSONB a typed columns** (temperatura_k INT, irc INT, nicho TEXT) — opção descartada; revisar se Phase 10 sofrer com tipagem do JSONB

### Reviewed Todos (not folded)
- `2026-04-27-pdf-zuado-input-para-phase-5.md` — pertence à Phase 11 (PDF ajustes), não 7
- `2026-05-06-pdf-orcamento-estetica-ruim.md` — pertence à Phase 11

</deferred>

---

*Phase: 07-schema-prep-v1-1*
*Context gathered: 2026-05-11*
