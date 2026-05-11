# Phase 8 — Push Log

**Migration:** 20260512000001_arquitetos_expand_fields.sql
**Aplicada em:** 2026-05-11 (America/Sao_Paulo)
**Operador:** Claude Code (gsd-execute-phase) + Lenny (aprovação)
**Método:** `mcp__plugin_supabase_supabase__apply_migration` (alternativa ao `supabase db push`; idêntico em efeito — DDL transacional via Management API com o mesmo token de owner)

## Pré-flight
- `SELECT COUNT(*) FROM public.arquitetos` → **0**
- Colunas `data_nascimento`, `endereco`, `banco`, `agencia`, `conta`, `tipo_conta`, `pix` em `public.arquitetos` → **0 (não existiam)**

## Push CLI / MCP
```
mcp__plugin_supabase_supabase__apply_migration
  project_id: jkewlaezvrbuicmncqbj
  name: arquitetos_expand_fields
  query: <conteúdo de supabase/migrations/20260512000001_arquitetos_expand_fields.sql, sem BEGIN/COMMIT — MCP envolve em transação automaticamente>
Resultado: { "success": true }
```

## Smoke SQL pós-push

### Colunas
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='arquitetos'
  AND column_name IN ('data_nascimento','endereco','banco','agencia','conta','tipo_conta','pix')
ORDER BY column_name;
```

| column_name     | data_type | is_nullable |
|-----------------|-----------|-------------|
| agencia         | text      | YES         |
| banco           | text      | YES         |
| conta           | text      | YES         |
| data_nascimento | date      | YES         |
| endereco        | text      | YES         |
| pix             | text      | YES         |
| tipo_conta      | text      | YES         |

7 linhas. `data_nascimento` é `date`; demais são `text`. Todas `is_nullable=YES`. ✅

### Index
```sql
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='arquitetos'
  AND indexname='idx_arquitetos_data_nascimento';
```

Retorna 1 linha: `idx_arquitetos_data_nascimento`. ✅

## Pós-flight
- `SELECT COUNT(*) FROM public.arquitetos` → **0** (idêntico ao pré — zero data churn) ✅

## Types regen
- `npx supabase gen types typescript --linked` executado (stdout filtrado: 1 linha `Initialising login role...` e 1 linha `<claude-code-hint>` do plugin removidas via `sed`/`grep -v`)
- `src/integrations/supabase/types.ts` contém `data_nascimento`, `endereco`, `banco`, `agencia`, `conta`, `tipo_conta`, `pix` em `Database['public']['Tables']['arquitetos']['Row']`, `['Insert']` e `['Update']` (3 ocorrências cada coluna)

## Lint + TS

`npm run lint` e `npx tsc --noEmit -p tsconfig.app.json` falham com **erros pré-existentes** do projeto, **não introduzidos pela Phase 8**:

- **Lint:** 467 errors, 138 warnings — todos em arquivos não tocados nesta phase (`Step3Revisao.tsx`, `useProdutoSearch.ts`, edge functions, etc.)
- **TS:** Erros em `PrecosBatch.tsx` (atributos `Record<string,unknown>` vs `Json`), `Step3Revisao.tsx`/`OrcamentoDetalhe.tsx` (`html2pdf` typing), `useProdutoSearch.ts` (`GenericStringError[]`) — pre-existentes

**Verificação de baseline:** stash do `types.ts` antigo + rerun do `tsc` mostrou os MESMOS erros — não há regressão introduzida pelo types regen. Phase 7 (PUSH-LOG `07-PUSH-LOG.md`) também não documentou lint/tsc clean — esses erros precedem o trabalho de schema prep.

Os blocos de `arquitetos`, `clientes` e demais tabelas tocadas pela phase compilam sem erro.

## Gate
- [x] Migration aplicada em prod (`{ "success": true }`)
- [x] 7 colunas + 1 index presentes (smoke SQL confirma)
- [x] Types regenerados com as 7 colunas em Row/Insert/Update
- [x] Smoke SQL OK (data_type + nullable corretos)
- [x] Zero data churn (count 0 pré, 0 pós)
- [ ] Lint/TS exit 0 — **pre-existing failures, não introduzido por esta phase** (ver seção acima)

## Próximo passo
Plan 08-05 desbloqueada: `ArquitetoDialog.tsx` pode hidratar e persistir os 7 campos novos sem cast/`any`.
