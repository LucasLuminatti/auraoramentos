---
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - supabase/functions/import-precos/index.ts
  - src/components/ImportPrecos.tsx
  - src/pages/Admin.tsx
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: resolved
resolution:
  WR-01: fixed — edge fn aborts 500 if lock/existence query fails (never overwrites unconfirmed locks)
  WR-02: fixed — orphaned Card* import removed from Admin.tsx
  IN-01: accepted — imprecise error message for view-hidden codigos, no risk
  verified: edge fn v5 deployed + E2E test (locked LM029 preserved, price unchanged; update path OK; 0 console errors)
---

# Code Review — import-precos wiring

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 3

## Summary

The lock-skip logic is structurally sound: locked codes are read from `product_variants` before the parallel update loop, so there is no race between the lock check and the UPDATE. The `preservados` count is aggregated correctly across batches in the client. Two warnings and one info item follow.

---

## Warnings

### WR-01: Lock query error silently treated as "no locks" — could overwrite prices

**File:** `supabase/functions/import-precos/index.ts:41-47`

The `{ data: lockRows }` destructure discards the `error` field. If the `product_variants` query fails (permissions error, network blip, schema issue), `lockRows` is `null`, `lockedCodigos` becomes an empty Set, and **every row in the batch is treated as unlocked and will be updated** — including rows that were marked `editado_manualmente=true`.

This is a data-integrity risk: a transient DB error silently bypasses the protection the feature is designed to provide.

**Fix:**

```ts
const { data: lockRows, error: lockError } = await supabase
  .from('product_variants')
  .select('codigo')
  .in('codigo', allCodigos)
  .eq('editado_manualmente', true);

if (lockError) {
  return new Response(
    JSON.stringify({ error: `Falha ao ler locks de edição manual: ${lockError.message}` }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Fail fast so the caller sees an error and no prices are written.

---

### WR-02: Unused import — `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`

**File:** `src/pages/Admin.tsx:29`

The `import { Card, CardContent, CardHeader, CardTitle, CardDescription }` at line 29 was only used by the placeholder block that was just removed. No JSX references to any of these components remain in the file.

Although the project has `@typescript-eslint/no-unused-vars` turned off, this is an unused import (a different lint rule) and adds noise. ESLint's `no-unused-vars` / TypeScript's unused-import detection may still flag it at build time or in CI depending on config drift.

**Fix:** Remove line 29.

```ts
// delete this line:
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
```

---

## Info

### IN-01: `existingCodigos` check reads `produtos` view; lock check reads `product_variants` — divergence is benign but worth noting

**File:** `supabase/functions/import-precos/index.ts:31-47`

If a `codigo` exists in `product_variants` (i.e., is locked) but is filtered out by the `produtos` view (e.g., `ativo=false` or view WHERE clause), the existence check at line 58 (`!existingCodigos.has(codigo)`) will push it to `failed` before the lock check at line 63 is ever reached. The lock is never tested, but the outcome is still safe: the price is not written, and the row ends up in `failed` with "Código não cadastrado" rather than `preservados`.

This is only a UX accuracy issue — the item reports as "not found" when the real reason is "exists but is inactive." No data is corrupted.

No action required unless the view filtering hidden/inactive rows becomes a real scenario; in that case, a more accurate error message would be helpful.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
