# Testing Patterns

**Analysis Date:** 2026-04-16

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest.config.ts`
- Environment: jsdom (browser simulation)
- Global: true (describe/it/expect available without imports)

**Assertion Library:**
- Vitest built-in expect (compatible with Jest)
- TypeScript Testing Library: @testing-library/react 16.0.0

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode for development
```

**Coverage:**
- No coverage reporting configured
- No enforcement of coverage thresholds
- Coverage commands not present in package.json

## Test File Organization

**Location:**
- Dedicated test directory: `src/test/`
- Currently only: `src/test/example.test.ts` (placeholder)
- Setup file: `src/test/setup.ts` (jest-dom polyfills for window.matchMedia)

**Naming:**
- Pattern: `[name].test.ts` or `[name].spec.ts`
- Config includes both patterns: `"src/**/*.{test,spec}.{ts,tsx}"`

**Structure:**
```
src/test/
├── setup.ts              # Vitest setup (jsdom polyfills)
└── example.test.ts       # Placeholder test
```

**NOT YET IMPLEMENTED:**
- No co-located test files (e.g., `useAuth.test.ts` alongside `useAuth.ts`)
- No tests for components
- No tests for hooks
- No tests for business logic functions in `src/types/orcamento.ts`

## Test Structure

**Suite Organization:**

Vitest uses describe-it-expect pattern (identical to Jest):

```typescript
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

**Patterns:**

No established patterns yet. The single test file shows:
- Suite wrapping via `describe()`
- Single assertion via `expect().toBe()`
- No setup/teardown (beforeEach/afterEach)
- No fixtures or factories
- No async/await testing patterns

**Current Example:**
```typescript
// src/test/example.test.ts
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

## Mocking

**Framework:** Not in use yet
- Vitest supports `vi.mock()` but not currently used
- No mock utilities installed or configured
- No setupFiles for global mocks beyond jsdom polyfills

**What Should Be Mocked (Not Yet Done):**
- Supabase client (`src/integrations/supabase/client.ts`)
- React Router (`react-router-dom`)
- Sonner toast notifications
- HTTP/network calls in hooks

**What Should NOT Be Mocked:**
- Date functions (rely on actual `new Date()`)
- Math calculations for accuracy
- DOM APIs (jsdom provides real DOM)
- Local storage (jsdom supports it)

## Fixtures and Factories

**Test Data:**
- None currently implemented
- Would be needed for:
  - Mock `Produto` objects (with all fields)
  - Mock `Ambiente` objects (with sistemas and luminarias)
  - Mock `Orcamento` objects (for Step3Revisao testing)
  - Mock Supabase responses (database tables)

**Suggested Location:**
```
src/test/fixtures/
├── produtos.ts           # Mock Produto[] arrays
├── ambientes.ts          # Mock Ambiente objects
├── orcamentos.ts         # Mock Orcamento objects
└── supabase.ts           # Mock Supabase responses
```

**Example Pattern (Not Yet Implemented):**
```typescript
// Would look like:
export const mockProduto: Produto = {
  id: "test-1",
  codigo: "FITA-LED-24V",
  descricao: "Fita LED RGB 24V 14.4W/m",
  preco_tabela: 150,
  preco_minimo: 120,
  wm: 14.4,
  voltagem: 24,
  tipo_produto: "fita",
};
```

## Coverage

**Requirements:** None enforced
- No minimum threshold set
- No coverage reporting in package.json
- No CI checks on coverage

**View Coverage (Not Configured):**
- Would use: `vitest --coverage` (requires @vitest/coverage-v8 or similar)
- Not currently installed in devDependencies

## Test Types

**Unit Tests:**
- Scope: Individual functions/hooks in isolation
- Approach: Test inputs and outputs, mock dependencies
- Target: Business logic functions in `src/types/orcamento.ts` (calculation functions)
- Target: Hook logic in `src/hooks/` (state management, API calls)
- NOT YET IMPLEMENTED

**Integration Tests:**
- Scope: Component + hook + Supabase interactions
- Approach: Render component, mock Supabase, verify state and UI updates
- Target: Step components (Step1, Step2, Step3) with user interactions
- Target: Admin dashboard with data fetching
- NOT YET IMPLEMENTED

**E2E Tests:**
- Framework: Not configured; would need Playwright or Cypress
- Scope: Full user flows (login → create budget → generate PDF)
- Status: Not applicable at current test infrastructure level

## Common Patterns (Not Yet Implemented)

**Async Testing:**

Would follow Vitest pattern with async/await:
```typescript
// Example pattern (not yet in codebase):
it("should fetch produtos on search", async () => {
  const { result } = renderHook(() => useProdutoSearch("LED", "fita"));
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
  expect(result.current.results.length).toBeGreaterThan(0);
});
```

**Error Testing:**

Would use try-catch or expect().rejects:
```typescript
// Example pattern (not yet in codebase):
it("should handle Supabase errors gracefully", async () => {
  vi.mocked(supabase.from).mockRejectedValue(new Error("Network error"));
  const { result } = renderHook(() => useAuth());
  await waitFor(() => {
    expect(result.current.user).toBeNull();
  });
});
```

**Component Testing (React Testing Library):**

Would use render + screen queries:
```typescript
// Example pattern (not yet in codebase):
it("should validate and show error toast on Step1", () => {
  render(<Step1DadosOrcamento dados={{...}} onChange={vi.fn()} onNext={vi.fn()} />);
  const button = screen.getByText("Próximo");
  fireEvent.click(button);
  expect(mockToast.error).toHaveBeenCalledWith("Selecione o tipo de orçamento");
});
```

## Setup and Dependencies

**Setup File:**
`src/test/setup.ts` provides jsdom polyfills:
```typescript
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
```

This mocks:
- `@testing-library/jest-dom` matchers (toBeInTheDocument, etc.)
- `window.matchMedia()` for responsive design queries

**Installed Test Dependencies:**
- `vitest@^3.2.4` — test runner
- `@testing-library/react@^16.0.0` — React component testing
- `@testing-library/jest-dom@^6.6.0` — DOM matchers
- `jsdom@^20.0.3` — DOM implementation for Node

**Missing for Full Coverage:**
- `@vitest/coverage-v8` — coverage reporting
- `@vitest/ui` — test UI dashboard
- `testing-library/user-event` — better user interactions
- Mock factory libraries (factory-bot equivalent)

## Current Testing Status

**CRITICAL GAP:** Only 1 placeholder test exists
- `src/test/example.test.ts` — trivial "expect(true).toBe(true)"
- Zero tests for:
  - Calculation functions (`calcularDemandaFita`, `calcularQtdDrivers`, etc.)
  - Hooks (`useAuth`, `useProdutoSearch`, `useValidarSistemas`)
  - Components (`Step1DadosOrcamento`, `AmbienteCard`, `Step3Revisao`)
  - API integration (Supabase queries)
  - Business logic (price violation detection, driver recommendations)

**Recommendations for Adding Tests:**

1. **Priority 1: Business Logic (`src/types/orcamento.ts`)**
   - Test all calculation functions with multiple scenarios
   - Test discriminated unions and type guards
   - Test edge cases (0 power, null perfil, 48V vs 12V limits)
   - No mocking needed — pure functions

2. **Priority 2: Hooks (`src/hooks/`)**
   - Test `useAuth()` — session state management
   - Test `useProdutoSearch()` — debouncing and error handling
   - Test `useValidarSistemas()` — edge function integration
   - Mock Supabase client

3. **Priority 3: Components**
   - Test `AmbienteCard` — adding/removing systems, price validation
   - Test `Step3Revisao` — violation detection, exception chat
   - Mock child hooks and Supabase
   - Verify toast messages on validation failures

4. **Priority 4: Integration**
   - Test full budget creation flow (Step1 → Step2 → Step3)
   - Mock Supabase for saving orcamentos
   - Verify PDF generation side effects

---

*Testing analysis: 2026-04-16*
