---
phase: 08-cadastros-opcionalizar-imagens-manuais
plan: 04
status: complete
requirements: [FORM-02]
key-files:
  created:
    - .planning/phases/08-cadastros-opcionalizar-imagens-manuais/08-PUSH-LOG.md
  modified:
    - src/integrations/supabase/types.ts
---

# Plan 08-04 — SUMMARY

## O que foi feito

Migration `20260512000001_arquitetos_expand_fields.sql` aplicada em **produção** via `mcp__plugin_supabase_supabase__apply_migration` (alternativa ao `supabase db push` — mesmo efeito, mesmo token de owner). 7 colunas opcionais adicionadas em `public.arquitetos` (`data_nascimento`, `endereco`, `banco`, `agencia`, `conta`, `tipo_conta`, `pix`) + index BTREE `idx_arquitetos_data_nascimento`.

Types TypeScript regenerados via `npx supabase gen types typescript --linked` (com filtro `sed`/`grep -v` pra remover 2 linhas espúrias do CLI/plugin) — os 7 campos novos agora aparecem em `Database['public']['Tables']['arquitetos']['Row' | 'Insert' | 'Update']`.

Evidência completa em `08-PUSH-LOG.md`: counts pré/pós (0=0, zero data churn), smoke SQL com tabela das 7 colunas + index, e justificativa de baseline pra erros de lint/tsc pré-existentes (não introduzidos por esta phase — confirmado via stash + rerun).

## Gate

- [x] Migration aplicada (`{ "success": true }`)
- [x] 7 colunas com `data_type` correto (1 date + 6 text, todas nullable)
- [x] Index `idx_arquitetos_data_nascimento` presente
- [x] Types regenerados (3 ocorrências cada coluna em Row/Insert/Update)
- [x] Zero data churn (count idêntico pré/pós)
- [x] PUSH-LOG.md documentado no padrão Phase 7

## Desvios

- **Push via MCP em vez de `supabase db push` CLI:** decisão do operador (Lenny aprovou opção "via MCP apply_migration"). Efeito 100% equivalente — Management API aplica DDL na mesma DB com o mesmo owner token. `supabase migration list` no projeto local pode ficar fora de sync com `supabase_migrations.schema_migrations` da remota; isso só importa se alguém rodar `supabase db push` futuro — nesse momento haverá um warning de migration "remote-only" (igual ao que aconteceria se Lenny aplicasse via Dashboard SQL Editor). Não afeta produção.
- **Filtro de output do `gen types`:** o `npx supabase gen types` no Windows imprime 1 linha de stderr (`Initialising login role...`) e 1 linha de hint do plugin Claude (`<claude-code-hint v="1" ... />`) no stdout, que quebram o parser TS. Stripadas via `sed '1{/^Initialising/d}' | grep -v '<claude-code-hint'`. Documentado no PUSH-LOG.

## Próximo passo

Plan 08-05 desbloqueada — `ArquitetoDialog.tsx` agora pode expandir para 7 campos sem `any`/cast.
