# Codebase Concerns

**Analysis Date:** 2026-04-23

---

## Tech Debt

**Pervasive `any` typing in import/admin components:**
- Issue: 39 ESLint errors, 11 warnings as of analysis. The bulk of errors are `@typescript-eslint/no-explicit-any` spread across the import pipeline and admin layer.
- Files: `src/components/ImportMapper.tsx` (9 occurrences), `src/components/AdminDashboard.tsx` (6), `src/components/Step3Revisao.tsx` (2), `src/components/ImportImagens.tsx`, `src/components/ImportPrecos.tsx`, `src/components/ImportProdutos.tsx`, `supabase/functions/import-precos/index.ts`, `supabase/functions/import-produtos/index.ts`
- Impact: Type errors in import flows will be silently swallowed; runtime crashes if XLSX row shapes differ from expectations.
- Fix approach: Define typed interfaces for XLSX row shapes in import components; replace `any` casts in `AdminDashboard` with the local `Orcamento` interface already defined in that file.

**`SistemaPerfil` deprecated alias left in place:**
- Issue: `src/types/orcamento.ts:88` exports `SistemaPerfil` with a `@deprecated` JSDoc but the alias is never removed.
- Files: `src/types/orcamento.ts`
- Impact: Low — alias is safe but will accumulate confusion as new devs import it.
- Fix approach: Search usages with `grep -r SistemaPerfil src/`, remove alias once confirmed unused.

**`AdminDashboard` uses `(o as any).fechado_at` / `(o as any).motivo_perda`:**
- Issue: The local `Orcamento` interface at lines 13–24 already declares `fechado_at` and `motivo_perda` as optional fields, but they are accessed via `as any` casts at lines 99–172.
- Files: `src/components/AdminDashboard.tsx`
- Impact: Masks type errors; if column is renamed in DB the cast will silently return `undefined`.
- Fix approach: Remove `as any` casts and use the typed interface directly.

**stale function references in `useEffect` dependency arrays:**
- Issue: ESLint warnings for missing deps in 4 components. `fetchExceptions`, `fetchArquivos`, `fetchCurrentLevel`, and `onStatusChange` are defined inside the component but omitted from effect dep arrays.
- Files: `src/components/AdminExceptions.tsx:56`, `src/components/ClienteArquivos.tsx:71`, `src/components/DriveExplorer.tsx:123`, `src/components/ExceptionChat.tsx:99`
- Impact: Stale closure risk — if parent passes new `onStatusChange` callback, the subscription effect will not re-register; similarly filter changes for `fetchExceptions` may miss re-fetch.
- Fix approach: Wrap callbacks with `useCallback` or move definitions inside the effect.

**`step3-exceptions` realtime channel uses a static non-unique name:**
- Issue: `src/components/Step3Revisao.tsx:126` subscribes to `.channel("step3-exceptions")` — a hardcoded name. If two browser tabs open the same budget step, both share one channel and receive duplicated updates.
- Files: `src/components/Step3Revisao.tsx`
- Impact: Duplicate toast notifications and possible double state updates in multi-tab usage.
- Fix approach: Append a unique session suffix, e.g., `.channel(`step3-exceptions-${user?.id}-${Date.now()}`)`.

**`tailwind.config.ts` uses `require()` instead of ESM import:**
- Issue: Line 90 uses a CommonJS `require()` call, flagged by ESLint rule `@typescript-eslint/no-require-imports`.
- Files: `tailwind.config.ts`
- Impact: Only a linting error today; could break if strict ESM enforcement is added.
- Fix approach: Replace `require("tailwindcss-animate")` with an ESM `import` at the top of the file.

---

## Known Bugs

**Violation key collision on price exceptions:**
- Symptoms: Two different products with the same product code but different minimum prices (e.g., if a product is updated) could share the same exception key `${codigo}-${precoUnitario}`, causing one to be marked approved when the other was resolved.
- Files: `src/components/Step3Revisao.tsx:101`, `src/components/Step3Revisao.tsx:166`
- Trigger: Unlikely in practice but possible if product `preco_minimo` changes between sessions.
- Workaround: None — the workaround is that prices rarely change mid-session.

**`sendMessage` in `ExceptionChat` does not clear input on error:**
- Symptoms: If `supabase.from("exception_messages").insert` fails, `setNewMessage("")` is still called on line 121 — the message text is lost even when the send fails.
- Files: `src/components/ExceptionChat.tsx:121`
- Trigger: Any network error or RLS violation on exception message insert.
- Workaround: User must retype message after error.

**PDF generation injects raw HTML into DOM without sanitization:**
- Symptoms: `container.innerHTML = html` at `src/components/Step3Revisao.tsx:266` injects the full PDF HTML string directly. The HTML is generated server-side from `gerarOrcamentoHtml` using user-supplied values (`clienteNome`, `projetoNome`).
- Files: `src/components/Step3Revisao.tsx:266`, `src/lib/gerarPdfHtml.ts`
- Trigger: Client/project names containing `<script>` or HTML entities would execute in the DOM during PDF rendering.
- Workaround: In practice, names are entered by authenticated collaborators only, which limits exposure. Still a stored-XSS vector if a malicious collaborator enters crafted names.

---

## Security Considerations

**`.env` committed to git history:**
- Risk: The original Supabase anon key and project URL for the old project (`qirsfbypqfeobcnkgspk`) were committed in the initial commit (`6be859b`) and are visible in git history.
- Files: `.env` (present, not read — existence confirmed), git history commit `6be859b`
- Current mitigation: The referenced project ID appears to be an old/test project that has since been replaced. Current `.env` points to `jkewlaezvrbuicmncqbj`.
- Recommendations: Run `git filter-repo` or BFG Repo Cleaner to purge `.env` from all history if the old project is still active. Rotate the old project's anon key regardless.

**`allowed_users` table has public read RLS policy:**
- Risk: Any unauthenticated request can enumerate all approved email addresses in the `allowed_users` table. This is by design (auth page checks before signup), but it exposes the full list of approved users.
- Files: `supabase/migrations/20260219141350_2a936d7b-1070-4304-8194-3e675098e949.sql:31`
- Current mitigation: None — the policy is intentional. Only authenticated Supabase clients with the anon key can query, but that key is public.
- Recommendations: Either add rate-limiting on the Supabase project, or change the check to a server-side edge function that verifies membership without exposing the full table.

**HMAC token secret rotation not implemented:**
- Risk: `APPROVAL_TOKEN_SECRET` used to sign approval tokens in `request-access` and verified in `review-access` has no rotation mechanism. If the secret leaks, any past or future approval URL can be forged.
- Files: `supabase/functions/request-access/index.ts:107`, `supabase/functions/review-access/index.ts:72`
- Current mitigation: 24-hour token expiry limits the window.
- Recommendations: Implement a token version field or periodic secret rotation procedure. Document the env var as critical.

**`review-access` edge function has no CORS restriction:**
- Risk: The function is invoked via GET links in emails (not a browser fetch), so CORS is not technically needed. However, the function also has no origin check and is fully public (`verify_jwt = false`). Anyone who obtains a valid token URL can approve/reject from any context.
- Files: `supabase/functions/review-access/index.ts`, `supabase/config.toml`
- Current mitigation: HMAC signature + expiry provide the primary guard.
- Recommendations: Acceptable for the current use case; document that the HMAC secret is the sole access control layer.

**`request-access` and `review-access` CORS headers allow `*`:**
- Risk: `Access-Control-Allow-Origin: *` on the request-access function means any website can POST to trigger an access request email to the admin.
- Files: `supabase/functions/request-access/index.ts:5`
- Current mitigation: Email spam is limited only by admin review; admin is not automatically granting access.
- Recommendations: Restrict CORS origin to `https://orcamentosaura.com.br` / Vercel domain.

**`create-colaborador` edge function has no rate limiting:**
- Risk: Edge function is called with no authentication (`verify_jwt` not explicitly set to false, but invoked from frontend after `signUp`). A malicious actor could call it directly with arbitrary `user_id` values.
- Files: `supabase/functions/create-colaborador/index.ts`
- Current mitigation: Supabase service role key is required internally; the function itself uses `SUPABASE_SERVICE_ROLE_KEY` to insert records.
- Recommendations: Add JWT verification or check that the calling user_id matches an authenticated session.

---

## Performance Bottlenecks

**`calcularRolosPorGrupo` and `calcularDriversPorProjeto` called redundantly:**
- Problem: Both functions iterate all `ambientes` and all `sistemas`. They are called in `useMemo` in `Step3Revisao`, but also inside `gerarOrcamentoHtml` (called during PDF generation), meaning two full passes on every render plus two more during PDF generation.
- Files: `src/components/Step3Revisao.tsx:72-73`, `src/lib/gerarPdfHtml.ts`
- Cause: No shared computation cache between preview display and PDF generation.
- Improvement path: Pass pre-computed `gruposFita` and `resumoDrivers` into `gerarOrcamentoHtml` as params instead of recomputing inside.

**`html2pdf.js` is dynamically imported only at PDF generation time:**
- Problem: Dynamic `import("html2pdf.js")` at `Step3Revisao.tsx:270` delays PDF generation by the time it takes to download and parse the library. On slow connections this is noticeable.
- Files: `src/components/Step3Revisao.tsx:270`
- Cause: Intentional lazy load to reduce initial bundle, but has a cold-start penalty on first use.
- Improvement path: Preload the chunk with `<link rel="modulepreload">` or trigger the import when Step 3 first mounts.

**`AdminExceptions` refetches all exceptions on every realtime UPDATE event:**
- Problem: The realtime handler at `src/components/AdminExceptions.tsx:50` calls `fetchExceptions()` (a full SELECT *) on any change to `price_exceptions`. For an admin with many open exceptions, every chat message status update triggers a full reload.
- Files: `src/components/AdminExceptions.tsx:48-55`
- Cause: Simplicity over efficiency — no incremental update logic.
- Improvement path: Use `payload.new` from the realtime event to update the local state array in place.

---

## Fragile Areas

**`Step3Revisao.tsx` — monolithic 573-line component:**
- Files: `src/components/Step3Revisao.tsx`
- Why fragile: Combines violation detection, exception CRUD, PDF generation, budget persistence, and realtime subscriptions in one component. Side effects are interleaved with rendering logic.
- Safe modification: Any change to violation logic, exception flow, or PDF generation should be tested against the full save+PDF path. There is no test coverage for this component.
- Test coverage: Zero — only `src/test/example.test.ts` exists with a placeholder test.

**`AmbienteCard.tsx` — 531 lines, deeply nested event handlers:**
- Files: `src/components/AmbienteCard.tsx`
- Why fragile: Inline `onKeyDown` and `onClick` handlers reference `tempName` state and `onChange` callbacks at multiple nesting levels. Extracting sub-components would break the shared `tempName` state.
- Safe modification: Changes to the name editing flow risk breaking the Enter key save.
- Test coverage: None.

**`DriveExplorer.tsx` — 559 lines mixing file upload, delete, folder CRUD:**
- Files: `src/components/DriveExplorer.tsx`
- Why fragile: The `fetchCurrentLevel` function is defined after the `useEffect` that calls it, and is excluded from the dependency array (ESLint warning). This creates a race condition if `projetoId` prop changes.
- Safe modification: Avoid touching the `useEffect` / `fetchCurrentLevel` ordering without also updating dependencies.
- Test coverage: None.

**Budget snapshot in `orcamentos.ambientes` is a JSONB blob:**
- Files: `src/components/Step3Revisao.tsx:198`, `supabase/migrations/20260416000001_orcamentos_ambientes_tipo.sql`
- Why fragile: The entire `Ambiente[]` tree is serialized as JSONB. If `src/types/orcamento.ts` types change (e.g., new required field), old saved budgets will fail to deserialize cleanly in future code.
- Safe modification: Always treat deserialized JSONB ambientes as `unknown` and validate before use; do not add required non-nullable fields to existing interfaces without migration logic.
- Test coverage: None.

---

## Email & Infrastructure

**Supabase default email templates still in use for auth flows:**
- Risk: Confirmation emails and password reset emails sent by Supabase auth (not by Resend edge functions) use the default Supabase templates with no AURA branding.
- Files: Not in codebase — configured in Supabase dashboard under Authentication > Email Templates.
- Impact: User experience inconsistency; confirmation emails look like generic Supabase mail, not AURA branded.
- Fix approach: Customize templates in Supabase dashboard, or migrate confirmation flow to a custom edge function with Resend.

**Domain `orcamentosaura.com.br` reputation warmup:**
- Risk: Domain is newly verified via Resend. Emails (especially admin approval emails) may land in spam for some recipients, causing missed approvals.
- Files: `supabase/functions/request-access/index.ts:129`, `supabase/functions/review-access/index.ts:139`
- Current mitigation: None — emails use `noreply@orcamentosaura.com.br` from day one.
- Recommendations: Send low volume initially, monitor Resend delivery logs, add SPF/DKIM/DMARC verification in DNS if not already done.

**Edge function `verify_jwt = false` only in `config.toml` for local dev:**
- Risk: `supabase/config.toml` sets `verify_jwt = false` for `request-access` and `review-access`, which is correct. However, when deploying via the Supabase dashboard, the dashboard UI has a separate toggle. If a dashboard deploy overrides these settings, the functions will reject the email-link GET requests that have no JWT.
- Files: `supabase/config.toml:3-7`
- Current mitigation: Functions are currently deployed with `--project-ref` CLI flag per memory note.
- Recommendations: Document that these two functions must always be deployed via CLI (`supabase functions deploy --project-ref jkewlaezvrbuicmncqbj --no-verify-jwt`), never via the dashboard toggle.

---

## Dependencies at Risk

**`xlsx` package (SheetJS) — no fix available for ReDoS:**
- Risk: `npm audit` reports a RegExp Denial of Service vulnerability in `xlsx@0.18.5` with no available fix.
- Impact: Maliciously crafted Excel files uploaded via `ImportMapper` could cause the browser tab to hang.
- Migration plan: Evaluate replacing with `exceljs` or `@e965/xlsx` (community fork). Short-term mitigation: add file size limits and type validation before parsing.

**`react-router-dom` — XSS via open redirects (high severity):**
- Risk: `react-router-dom@6.30.x` has a high-severity XSS via open redirect (`GHSA-2w69-qvjg-hvjx`). Fix available via `npm audit fix`.
- Impact: Potential XSS if application uses user-supplied redirect URLs in navigation.
- Migration plan: Run `npm audit fix` — this upgrades `@remix-run/router` and `react-router-dom` to patched versions.

**`vite` — dev server CORS issue (moderate):**
- Risk: `vite@5.4.x` has a moderate vulnerability allowing any website to send requests to the dev server. Only affects development, not production.
- Impact: Low in practice (dev-only, LAN-local).
- Migration plan: Run `npm audit fix` to upgrade Vite.

**19 total vulnerabilities (10 high, 6 moderate, 3 low):**
- A full `npm audit fix` resolves most except `xlsx` (no fix) and the `jsdom` transitive chain (requires `--force`).
- Run `npm audit fix` immediately for the react-router XSS fix.

---

## Test Coverage Gaps

**`src/types/orcamento.ts` calculation functions — zero tests:**
- What's not tested: `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularRolosPorGrupo`, `calcularDriversPorProjeto`, `calcularTotalGeral`, `analisarMagneto48V`, `motivoQtdDrivers`, `limiteExtensaoMetros`.
- Files: `src/types/orcamento.ts` (438 lines of domain logic)
- Risk: Calculation bugs go undetected. These functions directly affect quoted prices and driver quantities — errors here produce wrong bills of materials.
- Priority: High — these are pure functions with no side effects, making them trivial to unit test.

**No tests for any component or page:**
- What's not tested: All of `src/components/`, `src/pages/`, `src/hooks/`.
- Files: Only `src/test/example.test.ts` exists with a single placeholder `expect(true).toBe(true)`.
- Risk: Regressions in violation detection, exception flow, PDF generation, and auth go undetected.
- Priority: Medium — start with `src/types/orcamento.ts` pure functions, then add integration tests for the exception approval flow.

**Edge functions have no tests:**
- What's not tested: `request-access`, `review-access`, `create-colaborador`, `import-precos`, `import-produtos`.
- Files: `supabase/functions/*/index.ts`
- Risk: HMAC verification logic, token expiry checks, and email sending are untested. A refactor could silently break the approval flow.
- Priority: Medium — at minimum test the HMAC sign/verify round-trip and token expiry check in isolation.

---

*Concerns audit: 2026-04-23*
