# Testing Patterns

**Analysis Date:** 2026-04-23

## Test Framework

**Runner:**
- Vitest 3.x
- Config: `vitest.config.ts`
- Environment: jsdom (browser-like DOM simulation)
- Globals enabled (`globals: true`) — no need to import `describe`, `it`, `expect` explicitly, though the single test file does import them explicitly anyway

**Assertion Library:**
- Vitest built-in (`expect`) + `@testing-library/jest-dom` matchers loaded via setup file

**Run Commands:**
```bash
npm run test          # Run all tests once (vitest run)
npm run test:watch    # Watch mode (vitest)
# No coverage command configured in package.json scripts
```

## Test File Organization

**Location:**
- Centralized in `src/test/` — NOT co-located with source files
- Current test files: `src/test/example.test.ts`, `src/test/setup.ts`

**Naming:**
- Pattern: `[name].test.ts` or `[name].spec.ts` (both matched by `vitest.config.ts`)
- Setup file: `src/test/setup.ts` (loaded via `setupFiles` in vitest config)

**Structure:**
```
src/
  test/
    setup.ts          # Global test setup (jest-dom matchers + matchMedia mock)
    example.test.ts   # Placeholder example test (not production test coverage)
```

## Test Setup

**`src/test/setup.ts` configures:**
1. `@testing-library/jest-dom` matchers (`.toBeInTheDocument()`, `.toHaveClass()`, etc.)
2. `window.matchMedia` mock (required for Radix UI components that check viewport in jsdom)

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

Any new setup required for all tests (e.g., mocking `crypto.randomUUID`, ResizeObserver, IntersectionObserver) belongs in `src/test/setup.ts`.

## Test Structure

**Current example (the only real test):**
```typescript
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

**Recommended pattern for domain logic tests (pure functions):**
```typescript
import { describe, it, expect } from "vitest";
import { calcularQtdDrivers, calcularDemandaFita } from "@/types/orcamento";

describe("calcularQtdDrivers", () => {
  it("returns 1 driver when consumption fits within potência", () => {
    // arrange
    const sistema = { ... };
    // act
    const result = calcularQtdDrivers(sistema);
    // assert
    expect(result).toBe(1);
  });
});
```

**Recommended pattern for component tests:**
```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ValidacaoPanel from "@/components/ValidacaoPanel";

describe("ValidacaoPanel", () => {
  it("renders nothing when validacao is undefined", () => {
    const { container } = render(<ValidacaoPanel validacao={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

## Mocking

**Framework:** Vitest built-in (`vi.mock`, `vi.fn`, `vi.spyOn`)

**What to mock:**
- `@/integrations/supabase/client` — mock the `supabase` object for any component/hook that calls Supabase
- `sonner` toast — mock for components that call `toast.success`/`toast.error`
- `@/hooks/useAuth` — mock to inject a fake user session
- `@/hooks/useUserRole` — mock to control admin/collaborator context

**Supabase mock pattern (to be established):**
```typescript
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));
```

**What NOT to mock:**
- Pure calculation functions from `src/types/orcamento.ts` — test them directly, they have no side effects
- `src/lib/utils.ts` (`cn`, `getSaudacao`) — test directly
- `src/test/setup.ts` globals — already applied automatically

## Fixtures and Factories

**No fixture files exist.** Test data should be defined inline as typed objects:

```typescript
import type { SistemaIluminacao, ItemFitaLED, ItemDriver } from "@/types/orcamento";

const mockFita: ItemFitaLED = {
  id: "fita-1",
  codigo: "LF001",
  descricao: "Fita LED 24V 10W/m",
  wm: 10,
  voltagem: 24,
  metragemRolo: 5,
  precoUnitario: 100,
  precoMinimo: 80,
};

const mockDriver: ItemDriver = {
  id: "driver-1",
  codigo: "LD001",
  descricao: "Driver 100W 24V",
  potencia: 100,
  voltagem: 24,
  precoUnitario: 150,
  precoMinimo: 120,
};
```

**Location for shared fixtures (to be created):**
- `src/test/fixtures/` — create this directory when shared test data is needed across multiple test files

## Coverage

**Requirements:** None enforced — no coverage thresholds in `vitest.config.ts`

**View Coverage:**
```bash
npx vitest run --coverage
```
Note: `@vitest/coverage-v8` or `@vitest/coverage-istanbul` is not listed in `package.json` devDependencies — install one before running coverage.

## Test Types

**Unit Tests:**
- Primary target: pure calculation functions in `src/types/orcamento.ts`
- Functions like `calcularQtdDrivers`, `calcularDemandaFita`, `calcularConsumoW`, `calcularRolosPorGrupo`, `calcularDriversPorProjeto`, `limiteExtensaoMetros`, `analisarMagneto48V` are pure and trivially testable without mocking
- Utility functions in `src/lib/utils.ts` (`cn`, `getSaudacao`)

**Integration Tests:**
- Not currently present
- Recommended scope: hooks with mocked Supabase (`useAuth`, `useUserRole`, `useColaborador`)

**E2E Tests:**
- Not used — no Playwright/Cypress in dependencies

## Critical Gap

The test suite is effectively empty (only a `true === true` placeholder). The highest-value tests to add are unit tests for the domain calculation functions in `src/types/orcamento.ts` since they contain the core business logic (driver sizing, tape demand, roll optimization) and have zero external dependencies:

- `calcularQtdDrivers` — tests for potência vs extensão limit branching, 12V/24V/48V cases
- `calcularRolosPorGrupo` — tests for rolo optimization (greedy algorithm for 5/10/15m splits)
- `calcularDriversPorProjeto` — tests for project-level driver grouping and economy calculation
- `analisarMagneto48V` — tests for 48V magnetic system validation and driver recommendations

Add test files at `src/test/orcamento.test.ts` (or `src/types/orcamento.test.ts` — both paths match the vitest `include` glob `src/**/*.{test,spec}.{ts,tsx}`).

---

*Testing analysis: 2026-04-23*
