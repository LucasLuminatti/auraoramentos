---
phase: 04-drive-rls-reorganiza-o-admin
plan: 02
subsystem: ui
tags: [drive, supabase-storage, signed-urls, rls, react]

requires:
  - phase: 04-drive-rls-reorganiza-o-admin / Plan 01
    provides: user_id em cliente_arquivos/arquivo_pastas, RLS direta, bucket privado, storage policies via tabela
provides:
  - DriveExplorer migrado para signed URLs (createSignedUrl 24h TTL) — cobre bucket privado pós-04-01
  - INSERTs em cliente_arquivos e arquivo_pastas injetam user_id = auth.uid()
  - 3 ocorrências de <a href={arq.arquivo_url}> trocadas por <button onClick={handleDownload}>
  - cliente_arquivos.arquivo_url agora NULLABLE (auto-fix necessário descoberto em smoke)
affects: [04-03 (Admin reorg), drive, signed-urls]

tech-stack:
  added: []
  patterns:
    - "createSignedUrl 24h TTL para download em bucket privado"
    - "user_id injection no client antes de INSERT em tabelas com RLS por dono"

key-files:
  created:
    - supabase/migrations/20260504000002_arquivo_url_nullable.sql
  modified:
    - src/components/DriveExplorer.tsx
    - src/integrations/supabase/types.ts

key-decisions:
  - "Auto-fix: tornar cliente_arquivos.arquivo_url NULLABLE via micro-migration (RESEARCH Pitfall 7 + D-08 implicavam isso, mas Plan 04-01 não relaxou a constraint)"
  - "TTL signed URL = 86400s (24h, D-07)"
  - "noopener,noreferrer no window.open (segurança)"
  - "arquivo_url=null em novos INSERTs (não mais armazenar URL pública)"

patterns-established:
  - "Pattern: download via createSignedUrl no momento do clique, não no listing"
  - "Pattern: getUser() antes de INSERT em tabelas com RLS user_id"

requirements-completed: [ACC-04]

duration: ~45min (incluindo auto-fix migration + Playwright smoke)
completed: 2026-05-04
---

# Phase 04 / Plan 02: DriveExplorer Refactor Summary

**DriveExplorer alinhado ao modelo pós-04-01: signed URLs para bucket privado, user_id em todos INSERTs, e auto-fix de schema (arquivo_url nullable) descoberto durante smoke**

## Performance

- **Duration:** ~45 min (1 task auto + 1 task auto-fix descoberto via Playwright smoke)
- **Completed:** 2026-05-04
- **Tasks:** 2/2 (Task 2 — UI smoke — coberta inline pelo orchestrator via Playwright MCP em vez de checkpoint humano)
- **Files modified:** 3

## Accomplishments
- `handleDownload(arq)` novo usando `createSignedUrl('cliente-arquivos', arq.arquivo_path, 86400)`
- `handleUpload` injeta `user_id: user.id` no INSERT, envia `arquivo_url: null` (legado)
- `handleCriarPasta` injeta `user_id: user.id` no INSERT em `arquivo_pastas`
- 3 anchor tags `<a href={arq.arquivo_url}>` substituídos por `<button onClick={handleDownload}>`
- Auto-fix migration `20260504000002_arquivo_url_nullable.sql` aplicada em prod
- Smoke admin completo via Playwright: upload + signed URL download + criar pasta

## Task Commits

1. **Task 1: handleDownload + user_id injection + JSX swap** — `3080133` (feat, executado em worktree)
2. **Task 2 (auto-fix): drop NOT NULL arquivo_url** — `ff4c120` (fix, descoberto em smoke)

## Files Created/Modified
- `src/components/DriveExplorer.tsx` — handleDownload novo + user_id em 2 INSERTs + 3 buttons no lugar de anchors + Arquivo.arquivo_url tipado como `string | null`
- `supabase/migrations/20260504000002_arquivo_url_nullable.sql` — DROP NOT NULL na coluna arquivo_url (auto-fix Pitfall 7 + D-08)
- `src/integrations/supabase/types.ts` — types regenerados pós-fix (`arquivo_url: string | null`)

## Decisions Made
- **TTL 24h** (86400s) para signed URLs (D-07 do CONTEXT)
- **arquivo_url=null** em novos uploads em vez de salvar URL pública (D-06/D-08: bucket privado pós-04-01 — URL pública seria inválida de qualquer forma)
- **noopener,noreferrer** no `window.open` para evitar tabnabbing (T-04-11 mitigado)
- **getUser() antes de INSERT** mantido como guarda defensiva, embora storage RLS já exija sessão autenticada

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: Critical / Schema constraint mismatch] cliente_arquivos.arquivo_url NOT NULL bloqueava novos uploads**
- **Found during:** Playwright smoke do orchestrator — primeiro upload retornou `400` no POST `/rest/v1/cliente_arquivos`
- **Issue:** Plan 04-01 não relaxou `arquivo_url` para nullable, mas Plan 04-02 envia `null` em novos INSERTs (D-08). RESEARCH.md Pitfall 7 documentou que `arquivo_url` viraria "podre" mas não previu a constraint em si.
- **Fix:** Migration aditiva `20260504000002_arquivo_url_nullable.sql` com `ALTER COLUMN arquivo_url DROP NOT NULL`. Aplicada via `npx supabase db push`. Types regenerados.
- **Files modified:** `supabase/migrations/20260504000002_arquivo_url_nullable.sql` (novo), `src/integrations/supabase/types.ts`
- **Verification:** Re-upload via Playwright → 200 OK. arquivo aparece no Drive com 65 B. Click → signed URL `~/storage/v1/object/sign/...?token=...&exp=1778005304` (TTL 24h).
- **Committed in:** `ff4c120`

---

**Total deviations:** 1 auto-fixed (schema constraint, descoberto em runtime smoke)
**Impact on plan:** Auto-fix essencial — sem ele, todo upload de arquivo via Drive teria falhado em prod. Sem expansão de escopo, apenas alinhamento entre Plan 04-01 (schema) e Plan 04-02 (client code).

## Issues Encountered
- **PowerShell 5.1 + `>` redirect** quebrou a regeração de `types.ts` quando comando partido em duas linhas. Resolvido rodando via PowerShell tool (`Out-File -Encoding utf8` + sed strip BOM/CRLF).
- **400 POST cliente_arquivos** no primeiro upload — descoberto via `browser_network_requests`, raiz era schema, não código (vide auto-fix acima).

## Smoke Check Results (Playwright MCP)

| Cenário | Esperado | Resultado |
|---------|----------|-----------|
| Login admin → /drive | Lista 3 clientes (David, JOAQUIM, Leo Shetman) | ✓ |
| Upload arquivo no cliente David | Toast "Arquivo enviado!", arquivo aparece | ✓ pós-fix migration |
| Click no arquivo | Abre nova aba com `/storage/v1/object/sign/...?token=...` (TTL 24h) | ✓ exp=1778005304 |
| Criar pasta "Smoke 04-02" | Toast "Pasta criada!", pasta aparece | ✓ |
| Console errors durante fluxo | 0 errors funcionais | ✓ (1 warning DOM nesting button-in-button — pre-existente em pasta row, não introduzido por 04-02) |
| Smoke RLS cross-user (colab) | Colab vê só os seus arquivos | ⚠ Não testado via UI — sem conta colab de teste. Validação estrutural: policy `user_id = auth.uid() OR has_role(...,'admin')` aplicada via 04-01 migration, mesmo padrão das product-images do Phase 3 já em prod. UAT manual fica para criação de conta colab de teste. |

## User Setup Required
None — migration aplicada, types regenerados, comportamento validado via Playwright admin path.

## Next Phase Readiness
- Plan 04-03 (Admin reorg) é independente do Drive — pode partir imediatamente.
- UAT pendente (não-blocker): validar isolamento RLS UI cross-user quando houver conta colab de teste em prod.
- Test artifacts (1 arquivo + 1 pasta) ficaram em `cliente_arquivos`/`arquivo_pastas` no cliente David (atribuídos ao admin Lenny). Limpar via UI ou SQL quando for útil.

---
*Phase: 04-drive-rls-reorganiza-o-admin*
*Completed: 2026-05-04*
