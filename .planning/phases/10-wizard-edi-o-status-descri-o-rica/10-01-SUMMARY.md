---
phase: 10-wizard-edi-o-status-descri-o-rica
plan: 01
status: complete
date: 2026-05-14
requirements: [WIZ-04]
---

# 10-01 SUMMARY — RLS UPDATE migration in orcamentos

## Status

**SUCCESS** — Migration `20260514000002_orcamentos_status_rls.sql` aplicada em prod via MCP `apply_migration` em 2026-05-14T17:28Z. WIZ-04 ganha defesa server-side.

## What built

- Substituiu policy permissiva `"Authenticated users can update orcamentos" USING (true)` por 2 policies restritivas em prod
- Defesa em camadas para o invariante one-way de `aprovado` (D-16) — mesmo se UI vazar, banco bloqueia

## 2 policies criadas

### `Colab can update own orcamentos non-aprovado`
- `USING`: `colaborador_id = (SELECT id FROM colaboradores WHERE user_id = auth.uid()) AND status <> 'aprovado'`
- `WITH CHECK`: enum dos 4 status válidos
- Comportamento: colab edita só os próprios, e nada com `aprovado`

### `Admin can update orcamentos non-aprovado`
- `USING`: `has_role(auth.uid(), 'admin'::app_role) AND status <> 'aprovado'`
- `WITH CHECK`: enum dos 4 status válidos
- Comportamento: admin edita qualquer, mas também não reverte `aprovado`

## Policy legada dropada

- `Authenticated users can update orcamentos` (USING true) — substituída atomicamente

## Diff PRE → POST

| | PRE | POST |
|--|-----|------|
| Policies em orcamentos | 4 (todas permissivas) | 5 (read/insert/delete intactas + 2 UPDATE restritivas) |
| Status legado removido | sim | — |
| count(rascunho) | 4 | 4 |
| count(aprovado) | 0 | 0 |
| build local | n/a | exit 0 |

## Smoke status

- ✅ Policies novas verificadas via `pg_policy` query
- ✅ Counts idênticos PRE/POST (zero dado corrompido)
- ✅ Build exit 0 (TS ainda não syncado — Plan 10-02 cobre)
- ⏭️ Block aprovado: **n/a** — zero rows aprovadas em prod hoje; será exercido naturalmente quando 10-04 expuser o dropdown e Lenny mover um rascunho para aprovado no smoke

## Out of scope (intencional)

- SELECT/INSERT/DELETE policies de `orcamentos` continuam permissivas (D-32 — fora do escopo Phase 10)
- TypeScript types sync: Plan 10-02

## WIZ-04 status

**Server-side defense: DELIVERED.** UI dropdown + AlertDialog one-way são responsabilidade de 10-04.

## Key files

- `supabase/migrations/20260514000002_orcamentos_status_rls.sql` (live em prod)
- `.planning/phases/10-wizard-edi-o-status-descri-o-rica/10-01-PUSH-LOG.md` (PRE + Apply + POST + Smoke)
