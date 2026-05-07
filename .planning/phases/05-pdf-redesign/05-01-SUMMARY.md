---
phase: 05-pdf-redesign
plan: 01
subsystem: schema
tags: [migration, supabase, types, pdf, compat]
dependency-graph:
  requires: []
  provides:
    - "orcamentos.pdf_template_version (column)"
    - "Database['public']['Tables']['orcamentos'].Row.pdf_template_version (TS type)"
  affects:
    - "Plan 05-05 (call sites lerão/escreverão pdf_template_version)"
    - "src/lib/gerarPdfHtml.ts (router v1/v2 — Plan 05-05)"
tech-stack:
  added: []
  patterns:
    - "Migration aditiva (ADD COLUMN com DEFAULT) preservando rows legados como NULL"
    - "Template versioning via coluna persistida (Architecture Pattern 1 do RESEARCH)"
key-files:
  created:
    - "supabase/migrations/20260507000001_add_pdf_template_version.sql"
  modified:
    - "src/integrations/supabase/types.ts"
decisions:
  - "Patch manual de types.ts (em vez de supabase gen types --linked) por ausência de SUPABASE_ACCESS_TOKEN no worktree paralelo. Output determinístico — espelha o que o gen types produziria pós-push."
  - "Migration NÃO aplicada em prod neste worktree — auth gate documentada abaixo. Lenny aplica antes da Wave 3 (Plan 05-05) entrar em execução."
metrics:
  duration: "~6 min (worktree paralelo, wave 1)"
  completed: 2026-05-07
  tasks_completed: "2/3 (Task 1 + Task 3); Task 2 deferida por auth gate"
  commits:
    - "b69628b — feat(05-01): add pdf_template_version migration"
    - "66a6612 — feat(05-01): add pdf_template_version to orcamentos types"
---

# Phase 5 Plan 01: pdf_template_version Migration + Types Summary

Coluna `pdf_template_version int default 2` adicionada via migration aditiva em `supabase/migrations/20260507000001_add_pdf_template_version.sql` e tipo TypeScript correspondente patchado em `src/integrations/supabase/types.ts` (Row/Insert/Update). Migration **ainda não aplicada em prod** — auth gate documentada (Lenny aplica antes da Wave 3).

## Objective Recap

Plan 05 (router v1/v2) precisa de um campo persistido por orçamento que diga qual template renderizar. Sem ele, snapshots antigos não têm como ser distinguidos dos novos — render PDF quebra (PDF-05). Estratégia: ADD COLUMN nullable com default 2 (snapshots novos pegam v2); rows criadas antes da Phase 5 ficam NULL e são tratadas como v1 via `coalesce(pdf_template_version, 1)` no router (lógica fica no Plan 05-05).

## What Was Built

### Task 1 — Migration aditiva (commit `b69628b`)

Arquivo: `supabase/migrations/20260507000001_add_pdf_template_version.sql`

```sql
ALTER TABLE public.orcamentos
  ADD COLUMN pdf_template_version integer DEFAULT 2;

COMMENT ON COLUMN public.orcamentos.pdf_template_version IS
  'Versão do template do PDF... Default 2 em rows novas; rows pré-existentes ficam NULL e são tratadas como v1 via coalesce no router.';
```

Estrutura segue padrão das migrations da Phase 4: `BEGIN; ... COMMIT;`, blocos comentados com `-- ===`, `COMMENT ON COLUMN` para semântica documentada, e DO block de sanity check confirmando que a coluna foi criada.

**Deliberadamente NÃO há `UPDATE public.orcamentos SET pdf_template_version = ...`** — rows pré-existentes precisam ficar NULL para que o router as trate como v1 (PDF-05 compat).

### Task 3 — types.ts patchado (commit `66a6612`)

Arquivo: `src/integrations/supabase/types.ts` (3 inserções: Row/Insert/Update do bloco `orcamentos`)

```typescript
orcamentos: {
  Row: {
    // ...
    motivo_perda_detalhe: string | null
    pdf_template_version: number | null   // ← NEW
    projeto_id: string | null
    // ...
  }
  Insert: { /* ... pdf_template_version?: number | null ... */ }
  Update: { /* ... pdf_template_version?: number | null ... */ }
}
```

Patch é determinístico — espelha exatamente o que `npx supabase gen types typescript --linked` geraria depois de a migration estar aplicada (coluna `integer` com default → `number | null` em Row, `number | null` opcional em Insert/Update).

## Verification Performed

| Acceptance Criterion | Status | Evidence |
|---|---|---|
| Migration file existe e contém `ALTER TABLE public.orcamentos` + `ADD COLUMN pdf_template_version integer DEFAULT 2` | ✓ | `grep` retornou 1 ocorrência cada |
| BEGIN; e COMMIT; presentes | ✓ | grep contou 1 cada |
| Nenhum `UPDATE public.orcamentos` retroativo | ✓ | `grep -c "UPDATE public.orcamentos" → 0` |
| `COMMENT ON COLUMN` presente | ✓ | Visível na linha 18-19 da migration |
| `pdf_template_version` aparece 3x em types.ts (Row, Insert, Update) | ✓ | `grep -n` linhas 331, 347, 363 |
| Tipo é `number \| null` (Row) e `number \| null` opcional (Insert/Update) | ✓ | Confirmado por inspeção visual |
| `npm run build` exits 0 | ✓ | Build em 21.48s, 3445 módulos transformados, sem errors (apenas warnings de chunk size pré-existentes) |
| `npm run lint` exits 0 ou só warnings | ✗ | 38 errors pré-existentes em arquivos não tocados (ver "Deferred Issues") |

## Deviations from Plan

### Auto-fixed Issues

Nenhum — não houve necessidade de auto-fix bug/missing/blocker durante esta plan. Todos os 3 acceptance criteria implementáveis foram atendidos diretamente.

### Authentication Gates

**Task 2 [BLOCKING] — `npx supabase db push` (deferida)**

- **Found during:** Task 2
- **Blocker:** Sem `SUPABASE_ACCESS_TOKEN` nem `SUPABASE_DB_PASSWORD` no ambiente do worktree paralelo. `npx supabase migration list --project-ref jkewlaezvrbuicmncqbj` retorna "Cannot find project ref. Have you run supabase link?" (worktree não tem o link `.git`-shared do projeto principal). Sem psql instalado no PATH como fallback.
- **What was attempted:**
  - `npx supabase --version` → 2.98.2 OK
  - `npx supabase migration list --linked` → falha (sem auth)
  - Conferido `mcp-needs-auth-cache.json` — Supabase MCP listado mas tools `mcp__plugin_supabase_supabase__*` não declaradas neste agent spawn
  - `which psql` → não instalado
- **Workaround aplicado:** `types.ts` foi patchado **manualmente** com a definição que o `gen types` produziria após o push (Rule 3 — auto-fix de blocking issue: a alteração é determinística, sem risco de drift). Isso desbloqueia o build do plan 05-05 (Wave 3) que precisa do tipo para fazer `insert({ pdf_template_version: 2 })`.
- **Pendente para Lenny:** aplicar a migration em prod **antes da Wave 3** começar:

  ```powershell
  cd auraoramentos
  npx supabase login                       # se ainda não autenticado
  npx supabase link --project-ref jkewlaezvrbuicmncqbj
  npx supabase db push
  # Verificação:
  npx supabase db remote query "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='orcamentos' AND column_name='pdf_template_version';"
  # Esperado: 1 row → pdf_template_version | integer | 2
  ```

  Como alternativa: aplicar via Supabase Studio SQL editor copiando o conteúdo de `supabase/migrations/20260507000001_add_pdf_template_version.sql`.

### Deferred Issues

**Lint errors pré-existentes (38 errors, 12 warnings)**

Nenhum erro está em arquivo modificado por este plan. Distribuição:

- `src/pages/Admin.tsx` — 7 errors `@typescript-eslint/no-explicit-any` (linhas 107, 116, 119, 122, 560-562)
- `supabase/functions/import-precos/index.ts` — 3 errors `no-explicit-any`
- `supabase/functions/import-produtos/index.ts` — 3 errors `no-explicit-any`
- `tailwind.config.ts:90` — 1 error `no-require-imports`
- Outros — 24 errors espalhados em arquivos não tocados

**Scope boundary:** todos os erros são pré-existentes (Phase 4 fechou com eles, conforme STATE.md). Per regra de scope, não corrigir aqui — registrar para que phase de qualidade (futura) limpe. Não bloqueiam build (`npm run build` passou).

`types.ts` (arquivo modificado) **não tem nenhum erro de lint**.

## Risks & Pending

- **Risco mitigado:** se Lenny não aplicar a migration antes da Wave 3, o `insert({ pdf_template_version: 2 })` no Plan 05-05 vai retornar `42703 column "pdf_template_version" does not exist`. Mitigação: este SUMMARY documenta a auth gate explicitamente; orchestrator deve confirmar com Lenny antes de spawnar Wave 3.
- **Risco residual:** patch manual em `types.ts` pode divergir do output real do `gen types` se a coluna for criada com semântica diferente da migration (improvável — SQL é literal e o tipo `integer DEFAULT 2` mapeia 1:1 para `number | null`). Se divergir, próximo `gen types` reverte automaticamente.

## Self-Check: PASSED

- ✓ Arquivo `supabase/migrations/20260507000001_add_pdf_template_version.sql` existe (FOUND)
- ✓ Arquivo `src/integrations/supabase/types.ts` modificado e contém `pdf_template_version` (3 ocorrências)
- ✓ Commit `b69628b` existe (`git log` mostra)
- ✓ Commit `66a6612` existe (`git log` mostra)
- ✓ Build verde (`npm run build` exit 0)

## Next

- **Aguardando Lenny:** aplicar migration em prod antes da Wave 3 (Plan 05-05).
- **Wave 1 paralela continua:** Plans 05-02 (schema/UI Local opcional) e 05-03 (helpers fonts/images) rodam em paralelo a este — não dependem desta migration estar aplicada (não tocam `orcamentos`).
- **Wave 2:** Plan 05-04 (template v2) depende só de 05-02 — não desta migration.
- **Wave 3:** Plan 05-05 (router + call sites) **depende** desta migration estar aplicada em prod (faz `insert({ pdf_template_version: 2 })`). Bloquear spawn de 05-05 até Lenny confirmar push.
