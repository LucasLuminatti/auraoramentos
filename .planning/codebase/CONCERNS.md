# Codebase Concerns

**Analysis Date:** 2026-04-16

## Tech Debt

### TypeScript Type Safety Issues
- **Issue:** Widespread use of `any` type throughout codebase, blocking linting and reducing type safety
- **Files:** 
  - `src/pages/Admin.tsx:29,35,38,41,302,303,304` - Estado de listas tipado como `any[]`
  - `src/components/AdminDashboard.tsx:99,101,105,119,170,172` - Supabase query results cast with `as any`
  - `src/components/ExceptionChat.tsx:89,128` - Payload types from realtime subscriptions
  - `src/components/ImportMapper.tsx:21,26,34,35,52,61,86,108,126` - XLSX parsing with untyped arrays
  - `src/components/ImportPrecos.tsx:11,23` - CSV data parsing
  - `src/components/ImportImagens.tsx:144` - Supabase update cast
  - `src/components/Step3Revisao.tsx:115,128` - Exception query results and realtime events
  - `src/components/ImportProdutos.tsx:31,33` - Import handlers
  - `supabase/functions/import-produtos/index.ts:38,40,54` - Edge function parameters
  - `supabase/functions/import-precos/index.ts:36,39,51` - Edge function parameters
- **Impact:** 
  - 39 linting errors currently failing CI/CD
  - Refactoring harder because changes don't propagate type information
  - Runtime errors possible in data import flows if shapes change
- **Fix approach:**
  1. Define proper types for Supabase query returns (e.g., `type Orcamento = Database['public']['Tables']['orcamentos']['Row']`)
  2. Type XLSX/CSV parsing results with interfaces
  3. Use proper Realtime event types from `@supabase/supabase-js`
  4. Update edge functions to validate and type-check request bodies

### Empty Object Type in UI Components
- **Issue:** `interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {}` (empty interface) violates lint rule
- **Files:** `src/components/ui/command.tsx:24`, `src/components/ui/textarea.tsx:5`
- **Impact:** Linting fails, unclear why these interfaces exist
- **Fix approach:** Remove empty interfaces or add actual properties if inheritance is needed

### Hardcoded Configuration Values
- **Issue:** Voltage extension limits hardcoded in business logic instead of configuration
- **Files:** `src/types/orcamento.ts:182-184` - `limiteExtensaoMetros()` function
  ```typescript
  if (voltagem === 12) return 5;   // 12V limited to 5m
  if (voltagem === 24) return 10;  // 24V limited to 10m
  return null;                      // 48V has no fixed limit
  ```
- **Impact:** 
  - Changing limits requires code changes and redeployment
  - No way to experiment with different specs per client
  - Difficult to handle special cases (e.g., ultra-long runs with thicker cables)
- **Fix approach:** Move to `supabase.functions.invoke('get-config')` or environment table, cache client-side

### Type Casting for JSON Serialization
- **Issue:** Unsafe type casting when serializing Ambiente[] to jsonb column
- **Files:** `src/components/Step3Revisao.tsx:198` - `const ambientesJson = ambientes as unknown as Json;`
- **Impact:** 
  - No compile-time validation that `Ambiente[]` actually matches `Json` type
  - If schema changes, casting will silently fail
  - Supabase generated types don't catch mismatch
- **Fix approach:** Use explicit serialization function with compile-time schema validation

---

## Lint Errors (Blocking CI/CD)

**39 errors, 11 warnings** currently prevent clean build.

**Critical errors** (prevent function):
- `@typescript-eslint/no-explicit-any`: 25+ instances across multiple files
- `@typescript-eslint/no-empty-object-type`: 2 instances (ui/command.tsx, ui/textarea.tsx)
- `@typescript-eslint/no-require-imports`: 1 instance (tailwind.config.ts:90 using `require()`)

**Warnings** (code smell):
- `react-hooks/exhaustive-deps`: 5 instances in `AdminExceptions.tsx`, `ClienteArquivos.tsx`, `DriveExplorer.tsx`, `ExceptionChat.tsx`
- `react-refresh/only-export-components`: 6 instances in UI component files (exporting constants alongside components)

**Fix approach:**
- Run `npm run lint -- --fix` for auto-fixable rules
- Address `any` types with proper interfaces
- Add missing dependencies to `useEffect` or wrap callbacks with `useCallback`

---

## Component Complexity & Size

### Components Exceeding Recommended Size
- **`AmbienteCard.tsx`** (531 lines) - Contains:
  - Multiple state variables (isOpen, editingName, tempName, etc.)
  - 3 validation hooks (validarSistemas)
  - Complex logic for perfil/fita/driver selection with 28+ context-aware toasts
  - Multiple nested functions (addSistema, updateSistema, removeSistema, handleSelectProduto*)
  - Full tabbed UI for two content areas
- **`Step3Revisao.tsx`** (573 lines) - Contains:
  - Exception status tracking and chat state
  - Real-time Supabase subscription handling
  - PDF generation with image loading
  - Complex violation detection and pricing logic
  - Multiple tables and summaries
- **`DriveExplorer.tsx`** (559 lines) - File browser with navigation, upload, delete
- **`ImportMapper.tsx`** (396 lines) - XLSX mapping interface with preview

**Impact:**
- Hard to test (need full Component tree)
- Difficult to refactor or modify specific behaviors
- Props drilling becomes issue when adding features
- Risk of unintended side effects when changing one part
- Longer load time due to bundle size

**Fix approach:**
- Extract `<MagnetoLuminarias />`, `<SistemaLuminacao />`, `<LuminariaItem />` from AmbienteCard
- Move exception chat logic to separate hook (`useExceptionChat.ts`)
- Extract PDF generation to async utility with progress callback
- Create reusable `<ImportPreview />` component for XLSX/CSV mappers

### Step1DadosOrcamento Inadequacy
- **Issue:** Component description in `CLAUDE.md` is incorrect - "Step1DadosOrcamento não coleta colaborador"
- **Files:** 
  - `CLAUDE.md` (project-level docs) says Step1 "select collaborator" but it doesn't
  - `src/components/Step1DadosOrcamento.tsx` only collects "tipo" (budget type)
  - Colaborador pulled from `useColaborador()` hook in `Index.tsx:44`
- **Impact:**
  - Docs don't match implementation; confuses future developers
  - No UI way to change colaborador once set (locked to user's account)
  - If user_metadata changes, old budgets have wrong associate
- **Fix approach:** Update CLAUDE.md to reflect actual flow, consider adding optional colaborador selector in Step1 for admin override

---

## Missing Validations

### Frontend Input Validation
- **Issue:** No validation that dados.colaborador is actually populated before creating orcamento
- **Files:** `src/components/Step1DadosOrcamento.tsx:15-22` only checks `tipo`, not `colaborador`
- **Impact:** If colaborador is empty string, orçamento can be created without association
- **Fix approach:** Add validation: `if (!dados.tipo || !dados.colaborador)` in handleNext()

### No Ceiling on Decimal Precision
- **Issue:** Price inputs allow arbitrary decimal places (e.g., 10.999999999)
- **Files:** `src/components/PrecoInput` (in AmbienteCard.tsx:23-39) has `step={0.10}` but no max length
- **Impact:** 
  - Display issues when rounding: "R$ 999,99..." truncated in UI
  - Database storage may cause floating-point errors
  - PDF generation inconsistency
- **Fix approach:** Force `toFixed(2)` on all price inputs and outputs

### Fita.wm Validation Gap
- **Issue:** `fita.wm` (watts-per-meter) can be 0 or negative, causing division by zero
- **Files:** `src/types/orcamento.ts:199` checks `!fita.wm` but AmbienteCard allows manual edit
- **Impact:** 
  - `calcularConsumoW()` returns 0 when wm=0 (silent failure)
  - `motivoQtdDrivers()` skips extension check if wm is falsy
  - User won't know their system is invalid until PDF generation
- **Fix approach:** 
  - Add min={0.1} constraint to wm input in AmbienteCard
  - Display warning if wm < typical range (e.g., < 3W/m for most tapes)

### Driver Potencia Edge Case
- **Issue:** If `driver.potencia === 0`, calcularQtdDrivers() returns 0 (not an error)
- **Files:** `src/types/orcamento.ts:173,199`
- **Impact:** User can select "0W driver" and orçamento calculates as needing 0 drivers (invalid)
- **Fix approach:** Prevent driver selection if potencia <= 0, or validate in hook useValidarSistemas

---

## Performance Issues

### Bundle Size
- **Problem:** Main JS bundle is ~1.6MB before gzip (warning from Vite)
- **Files:** `dist/assets/index-*.js` (built output)
- **Contributors:**
  - html2pdf.js adds 982KB (dynamically loaded but increases bundle)
  - shadcn-ui components imported from multiple places (potential duplication)
  - XLSX/xlsx library for import feature
- **Impact:**
  - Slow initial page load on slow connections
  - Bad Core Web Vitals
  - Worse UX for mobile users
- **Fix approach:**
  1. Dynamic import html2pdf only in Step3Revisao (already done with lazy load, but verify)
  2. Audit shadcn-ui imports — ensure tree-shaking
  3. Move XLSX parsing to Web Worker to unblock UI
  4. Consider splitting routes with React.lazy()

### Real-time Subscription Leaks
- **Issue:** Supabase realtime channels not always properly unsubscribed
- **Files:** 
  - `src/components/Step3Revisao.tsx:125-139` - Creates channel but cleanup may miss if component unmounts during async fetch
  - `src/components/AdminExceptions.tsx` - Similar pattern
- **Impact:** 
  - Memory leaks if user switches between tabs rapidly
  - Orphaned subscriptions accumulate
  - Supabase connection pool exhaustion on long sessions
- **Fix approach:**
  - Move fetchExceptions to useCallback with proper cleanup
  - Use AbortController for fetch + subscription cleanup in single useEffect
  - Add timeout to subscription fetch

### Missing Pagination in Admin Lists
- **Issue:** Admin dashboard fetches entire tables without pagination
- **Files:** `src/pages/Admin.tsx:80-90` - `fetchOrcamentos()`, `fetchClientes()`, `fetchColaboradores()`
- **Impact:** 
  - 1000+ records = slow page load
  - No UI feedback for large datasets
  - Browser memory spike
- **Fix approach:**
  - Add `.range(0, 50).limit(50)` to queries
  - Implement pagination buttons or infinite scroll
  - Add `.count('estimated')` for total count display

---

## Fragile Areas

### Exception Status Tracking
- **Issue:** Exception approval status tracked in two places
- **Files:**
  - `src/components/Step3Revisao.tsx:63-65` - Local state: `approvedExceptions`, `pendingExceptionIds`
  - `price_exceptions` table in Supabase - Source of truth
- **Impact:**
  - Realtime update from admin changes status, but may not update both state variables
  - If network is slow, approval may not appear until refresh
  - Violation detection uses key `${codigo}-${precoUnitario}` which is fragile if price changes
- **Fix approach:**
  - Use single source of truth: query from exception table directly in `isViolacao()`
  - Add `onStatusChange` callback that refetches full exception list instead of manual state updates
  - Use UUID or `exception.id` instead of `${codigo}-${precoUnitario}` as key

### Magneto48V Analysis Fragile Regex
- **Issue:** Product matching relies on string patterns that may break
- **Files:** `src/types/orcamento.ts:247,259-260` (analisarMagneto48V function)
  ```typescript
  const modulos = amb.luminarias.filter(l => 
    l.sistema === 'magneto_48v' && 
    l.potencia_watts && 
    !/TRILHO|CONECTOR|DRIVER|KIT/i.test(l.descricao)
  );
  // Later:
  const temDriver = amb.luminarias.some(l => 
    /LM2343|LM2344/.test(l.codigo) || 
    /DRIVER.*TRILHO\s+MAGNETICO/i.test(l.descricao)
  );
  ```
- **Impact:**
  - If product codes change (e.g., "LM2343" → "LM2343-R2"), detection fails silently
  - Uppercase DESC from DB but code defensively uses `/i` flag — inconsistent
  - No way to extend rules without code change
- **Fix approach:**
  - Add `is_magneto_driver`, `is_magneto_conector` boolean columns to `produtos` table
  - Query directly: `amb.luminarias.some(l => l.is_magneto_driver === true)`

### PDF Generation Image Loading
- **Issue:** Images loaded client-side with `crossOrigin="anonymous"` but may fail silently
- **Files:** `src/components/Step3Revisao.tsx:43-56` (imageToBase64 function)
  - If image URL is invalid or CORS blocked, promise rejects
  - No error handler in calling code
- **Impact:**
  - PDF generated without images but user doesn't know
  - User sends incomplete PDF to client
- **Fix approach:**
  - Wrap in try/catch with fallback: use placeholder if image fails
  - Add console.error logging
  - Show toast warning if any images failed to load

### Colaborador Auto-Create Edge Function Race Condition
- **Issue:** If multiple windows/tabs call `create-colaborador` simultaneously, could create duplicate
- **Files:** `src/hooks/useColaborador.ts:54-56` - No race condition protection
- **Impact:**
  - User could end up with 2+ colaborador records with same user_id
  - RLS policies may fail or return unexpected result
- **Fix approach:**
  - Add `ON CONFLICT (user_id) DO NOTHING` to edge function SQL
  - Or use Supabase unique constraint: `UNIQUE(user_id)` on colaboradores table

---

## Missing Critical Features

### No Audit Log for Price Changes
- **Issue:** Admins can change product prices, but no history of what changed when
- **Files:** `src/pages/Admin.tsx` - Produtos tab allows edit but no versioning
- **Impact:**
  - Can't identify if price was accidentally changed
  - No way to revert if wrong price applied
  - Compliance issue if clients ask "why did price change"
- **Fix approach:**
  - Add `updated_at` and `updated_by_id` columns to `produtos` table
  - Create `preco_history` table: `(produto_id, preco_tabela, preco_minimo, changed_at, changed_by_id)`
  - Log all admin changes in edge function

### No Budget Lock/Finalization
- **Issue:** User can modify ambientes/systems even after sending to client
- **Files:** `src/components/Step3Revisao.tsx` - Only saves to DB if status is 'rascunho' or similar
- **Impact:**
  - Changes to sent quote not visible to client (no versioning)
  - No way to know if current state matches what was emailed
  - Confusion if client references old price
- **Fix approach:**
  - Add `locked` boolean column to orcamentos
  - Prevent editing if locked
  - Show "View revision N" dropdown if multiple versions exist

### No Client Portal
- **Issue:** Clients receive PDFs via email but can't see quote in system
- **Files:** All logic is admin/collaborator-only
- **Impact:**
  - No way for client to approve or reject formally
  - No self-service quote status checking
  - Admin must re-send if client asks "what was the quote again?"
- **Fix approach:**
  - Create `/quote/{shareToken}` route for read-only client access
  - Add `share_token` and `client_email` to orcamentos table
  - Send shareable link instead of/alongside PDF

### No Bulk Client/Project Creation
- **Issue:** Adding 10 new clients requires 10 clicks and 10 form submissions
- **Files:** `src/components/ClienteList.tsx` - Dialog-based single-entry
- **Impact:**
  - Slow onboarding for large distributors
  - No way to bulk-import client list from CSV
- **Fix approach:**
  - Add "Import clients from CSV" to Admin > Clientes tab
  - Accept: (nome, email?, telefone?, endereco?)

---

## Test Coverage Gaps

### No Unit Tests for Core Calculation Functions
- **Issue:** Business logic in `src/types/orcamento.ts` has no test coverage
- **Files:** 
  - `calcularQtdDrivers()` - Complex overload with dual algorithm (power vs. extension)
  - `calcularRolosPorGrupo()` - Greedy roll-packing algorithm
  - `calcularDriversPorProjeto()` - Optimization of multiple environments
  - `analisarMagneto48V()` - Product detection and recommendations
- **Impact:**
  - Bugs in pricing/dimensioning found only by end user (e.g., "qty calculated wrong")
  - Refactoring risky — don't know what breaks
  - Edge cases not documented (e.g., what if fita.metragemRolo = 0?)
- **Fix approach:**
  - Create `src/types/__tests__/orcamento.test.ts`
  - Test: single system, multiple systems, edge cases (0W, null driver, etc.)
  - Test roll packing algorithm with various demand/rolo combinations
  - Add example data fixtures: `src/types/__fixtures__/`

### No Tests for RLS Policies
- **Issue:** Supabase RLS policies created but never validated
- **Files:** Multiple migrations with `CREATE POLICY` statements
- **Impact:**
  - Admin could accidentally break user access via typo in policy
  - Escalation/privilege bypass possible if policy rule is wrong
  - No regression testing when schema changes
- **Fix approach:**
  - Create `supabase/tests/rls.test.ts` using Supabase Testing Library
  - Test: user sees only their own orcamentos, admin sees all, etc.
  - Validate RLS with authenticated and anonymous tokens

### No Integration Tests for Exception Flow
- **Issue:** Price exception request → admin approval → visibility in quote is untested
- **Files:** 
  - `src/components/ExceptionChat.tsx` - Submission
  - `src/components/AdminExceptions.tsx` - Approval
  - `src/components/Step3Revisao.tsx` - Consumption
- **Impact:**
  - Exception status may not propagate (realtime subscription fails)
  - Chat messages may not appear in order
  - Approved exception may not unblock PDF generation
- **Fix approach:**
  - Create `src/__tests__/exception-flow.integration.test.ts`
  - Mock Supabase and test: create exception → approve → re-fetch violations

---

## Database & Schema Issues

### JSONB Ambientes Column No Indexing
- **Issue:** `orcamentos.ambientes jsonb NOT NULL DEFAULT '[]'` has no index
- **Files:** `supabase/migrations/20260416000001_orcamentos_ambientes_tipo.sql`
- **Impact:**
  - Queries like "find all orcamentos with sistema código XYZ" require full table scan
  - Performance degrades as orcamentos table grows
- **Fix approach:**
  - Create GIN index: `CREATE INDEX ON orcamentos USING GIN (ambientes)`
  - Or normalize: move ambientes to separate table with FK

### Soft Delete Not Implemented
- **Issue:** When admin deletes cliente, if any orcamentos reference it, cascading delete may lose data
- **Files:** `src/pages/Admin.tsx:93-104` - handleDeleteCliente calls `delete()`
- **Impact:**
  - Hard to audit ("where did that quote go?")
  - Possible data loss if not careful with cascade rules
  - Can't restore accidentally deleted client
- **Fix approach:**
  - Add `deleted_at` column to clientes, projetos, orcamentos
  - Set RLS to exclude deleted_at IS NOT NULL (soft delete)
  - Add admin endpoint to restore

---

## Configuration & Secrets

### Environment Variables Not Validated
- **Issue:** `.env.local` required but no schema validation
- **Files:** `src/integrations/supabase/client.ts` - Assumes VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY exist
- **Impact:**
  - Missing var causes silent error (undefined in runtime)
  - New dev sets up project but forgets env file
  - No clear error message
- **Fix approach:**
  - Create `src/integrations/config.ts` with validation:
    ```typescript
    const requiredEnvVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
    for (const v of requiredEnvVars) {
      if (!import.meta.env[v]) throw new Error(`Missing env var: ${v}`);
    }
    ```

### Public Anon Key Exposed in Frontend
- **Issue:** VITE_SUPABASE_ANON_KEY is in `vite.config.ts` and sent to browser
- **Impact:**
  - Client-side RLS is only protection (if misconfigured, all data exposed)
  - Anyone can reverse-engineer API calls and enumerate data
- **Fix approach:** This is acceptable for Supabase (RLS is designed for this), but:
  - Audit all RLS policies to ensure they're restrictive
  - Don't store sensitive data (e.g., internal cost) in same tables as client-visible data

---

## Documentation Issues

### CLAUDE.md Project Instructions Out of Sync
- **Issue:** 
  - Says "Step1 selects colaborador" but it doesn't
  - Documents old flow that changed with useColaborador hook
  - Doesn't mention auto-create-colaborador edge function
- **Files:** `./CLAUDE.md` (project-level instructions) — no `./CLAUDE.md` in repo found at root
- **Impact:** New developers implement features incorrectly based on old docs
- **Fix approach:** Update or remove outdated sections; clarify actual flow

### No API Documentation for Edge Functions
- **Issue:** Edge functions exist but no comments documenting their contract
- **Files:** 
  - `supabase/functions/create-colaborador/` - What happens if user already exists?
  - `supabase/functions/validar-sistema-orcamento/` - What's the return type?
  - `supabase/functions/import-produtos/` - What CSV format expected?
- **Impact:** 
  - Duplicated logic in frontend and functions (no contract to follow)
  - Hard to refactor or test edge functions
- **Fix approach:** Add JSDoc comments to each function with @param, @returns

### Phase Numbering Inconsistency (Cosmetic)
- **Issue:** Git history shows Fase 1, 2, 4, 4.5, 5, 6 (missing Fase 3)
- **Files:** `git log --oneline` shows commits with this naming
- **Impact:** Cosmetic only, but suggests unplanned development or renamed phases
- **Fix approach:** Rename commits or accept as historical artifact

---

## Security & Validation

### No Rate Limiting on Exception Chat
- **Issue:** Users can spam exception_messages table with no throttling
- **Files:** `src/components/ExceptionChat.tsx:157-162` - insert without rate limit
- **Impact:**
  - Malicious user could fill messages table
  - No DoS protection on edge function
- **Fix approach:**
  - Add RLS policy: limit 10 messages per exception per minute
  - Or implement client-side debounce on send button

### No Input Sanitization
- **Issue:** User-entered data (cliente.nome, ambiente.nome, etc.) not sanitized before display
- **Files:** Everywhere data is echo'd to DOM
- **Impact:**
  - If user enters `<script>alert('xss')</script>`, it renders
  - React escapes by default, but if using dangerouslySetInnerHTML anywhere, vulnerable
- **Fix approach:**
  - Audit all `dangerouslySetInnerHTML` uses (should be none)
  - Use `.textContent` or implicit escaping (React default)

### CORS Misconfiguration Risk
- **Issue:** Image loading uses `crossOrigin="anonymous"` which may allow non-CORS images to fail silently
- **Files:** `src/components/Step3Revisao.tsx:46`
- **Impact:**
  - Attacker could host image on their domain, replace with phishing content
  - User's PDF includes attacker's image without warning
- **Fix approach:**
  - Whitelist image domains: only load from `imagens.luminatti.com.br` or Supabase storage
  - Validate image URL against allowlist before calling `imageToBase64()`

---

*Concerns audit: 2026-04-16*
