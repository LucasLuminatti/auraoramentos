# Coding Conventions

**Analysis Date:** 2026-04-16

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `Step1DadosOrcamento.tsx`, `AmbienteCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAuth.ts`, `useProdutoSearch.ts`)
- Pages: PascalCase (e.g., `Auth.tsx`, `Index.tsx`)
- Utilities: camelCase (e.g., `utils.ts`, `gerarPdfHtml.ts`)
- Tests: camelCase with `.test.ts` suffix (e.g., `example.test.ts`)
- UI components: lowercase (e.g., `button.tsx`, `dialog.tsx`) — shadow-cn/ui library, auto-generated

**Functions:**
- React components: PascalCase (e.g., `Step1DadosOrcamento`, `AmbienteCard`)
- Utility functions: camelCase (e.g., `getSaudacao()`, `cn()`, `calcularDemandaFita()`)
- Handler functions: camelCase with `handle` prefix (e.g., `handleNext()`, `handleSelectProdutoLuminaria()`)
- Domain calculation functions: camelCase without prefix (e.g., `calcularMetragemTotal()`, `calcularConsumoW()`)

**Variables:**
- React state: camelCase (e.g., `isOpen`, `editingName`, `loading`)
- Props interfaces: PascalCase with `Props` suffix (e.g., `Step1Props`, `AmbienteCardProps`)
- Domain entities (Portuguese): camelCase + Portuguese nouns (e.g., `colaborador`, `ambiente`, `sistema`, `fita`, `driver`, `perfil`)
- Constants: UPPER_SNAKE_CASE (e.g., `MARGEM_SEGURANCA_DRIVER = 1.05`, `STEPS = ["Dados", "Ambientes", "Revisão"]`)
- Type literals: lowercase Portuguese (e.g., `'Primeiro Orçamento'`, `'Revisão 01'`, `'magneto_48v'`)

**Types:**
- Interfaces: PascalCase, no prefix (e.g., `Produto`, `Ambiente`, `SistemaIluminacao`)
- Type unions: lowercase snake_case for discriminator values (e.g., `'fita' | 'driver' | 'perfil'`)
- Branded types: discriminated unions on `tipo_produto` field (e.g., `tipo_produto: 'fita' | 'driver' | 'perfil'`)
- Deprecated types marked with `@deprecated` comment (e.g., `SistemaPerfil`)

## Code Style

**Formatting:**
- No `.prettierrc` — relies on VS Code defaults (2-space indentation, LF line endings)
- No explicit Prettier config; follows ESLint recommendations

**Linting:**
- ESLint config: `eslint.config.js` (using flat config format)
- Extends: `js.configs.recommended` + `typescript-eslint.configs.recommended`
- Key rules:
  - `@typescript-eslint/no-unused-vars: "off"` — unused vars allowed
  - `react-refresh/only-export-components: ["warn", ...]` — warn if non-component exports in component files
  - React Hooks recommended rules enabled

**TypeScript Strictness:**
- `noImplicitAny: false` — allows implicit `any`
- `strictNullChecks: false` — allows nullable types without explicit `| null`
- `noUnusedLocals: false` — allows unused local variables
- `noUnusedParameters: false` — allows unused function parameters
- Low strictness; focus on runtime correctness via overloads and type guards

## Import Organization

**Order:**
1. React/Core library imports (e.g., `import React from "react"`)
2. External packages (e.g., `import { useNavigate } from "react-router-dom"`)
3. UI components from shadcn-ui (e.g., `import { Button } from "@/components/ui/button"`)
4. Internal hooks (e.g., `import { useAuth } from "@/hooks/useAuth"`)
5. Internal types (e.g., `import type { Orcamento } from "@/types/orcamento"`)
6. Internal utils (e.g., `import { getSaudacao } from "@/lib/utils"`)
7. Assets (e.g., `import logo from "@/assets/logo.png"`)
8. Third-party services (e.g., `import { supabase } from "@/integrations/supabase/client"`)
9. Icons (e.g., `import { Plus, Trash2 } from "lucide-react"`)
10. Toast/notifications (e.g., `import { toast } from "sonner"`)

**Path Aliases:**
- `@/*` → `./src/*` — all imports use the `@/` prefix for absolute imports
- Examples: `@/hooks/useAuth`, `@/components/ui/button`, `@/types/orcamento`, `@/integrations/supabase/client`

## Error Handling

**Patterns:**
- Try-catch with early returns on errors
- Supabase errors: check `.error` object, `throw error` to trigger catch block
- Network errors: silenced in debounced hooks (e.g., `useValidarSistemas` catches all errors silently)
- Type errors: use type guards (`'fita' in arg`) for function overloads
- Constraint checks: guard conditions before operations (e.g., `if (!dados.tipo) { toast.error(...); return; }`)

**Examples:**
```typescript
// Hook pattern: try-catch with console.error
try {
  const { data } = await supabase.from("...").select(...);
  if (error) throw error;  // Explicit throw
  setResults(data || []);
} catch {
  setResults([]);  // Silenced on network error
} finally {
  setLoading(false);
}

// Component pattern: early validation with toast
if (!dados.tipo) {
  toast.error("Selecione o tipo de orçamento");
  return;
}

// Edge case: type guard with overloads
if ('fita' in arg) {
  // arg is SistemaIluminacao
  const sis = arg as SistemaIluminacao;
} else {
  // arg is ItemPerfil
  const perfil = arg as ItemPerfil;
}
```

## Logging

**Framework:** `console.error()` only — no structured logging
- Used only for unexpected failures (e.g., `console.error("Falha ao auto-criar colaborador:", err)`)
- Network errors in hooks are silenced intentionally (offline validation as fallback)
- User-facing errors: always show via `toast()` from Sonner

**Patterns:**
```typescript
console.error("Erro ao salvar orçamento:", err);
console.error("Erro ao gerar PDF:", err);
console.error("Error creating colaborador:", res.error);
```

## Comments

**When to Comment:**
- Explain WHY, not WHAT (code is self-documenting via naming)
- Business rules with numbers/magic constants (e.g., `// MARGEM_SEGURANCA_DRIVER = 1.05 (paridade com edge function)`)
- Complex algorithm sections marked with comment dividers
- Deprecated items marked with `@deprecated`

**JSDoc/TSDoc:**
- Used sparingly; optional parameter documentation only
- Public interfaces documented (e.g., `/** Sistema de Iluminação: fita + driver obrigatórios, perfil opcional */`)
- Overloaded functions documented above first signature only

**Example:**
```typescript
/** Margem de segurança aplicada sobre a potência consumida ao dimensionar drivers.
 * Mantém paridade com a edge function `validar-sistema-orcamento` (fator 1.05). */
export const MARGEM_SEGURANCA_DRIVER = 1.05;

/** Metragem de fita necessária para o sistema */
export function calcularDemandaFita(sistema: SistemaIluminacao): number;
export function calcularDemandaFita(perfil: ItemPerfil): number;
export function calcularDemandaFita(arg: SistemaIluminacao | ItemPerfil): number {
  // Implementation with type guard
}
```

## Function Design

**Size:** No hard limit; business calculation functions in `src/types/orcamento.ts` range 30-50 LOC
- Component event handlers: 5-15 LOC
- Utility functions: 10-30 LOC
- Complex calculations: up to 50 LOC (e.g., `calcularDriversPorProjeto`)

**Parameters:**
- Single object when 2+ parameters (e.g., `handleSelectProdutoLuminaria(produto: Produto, index: number)`)
- Destructuring in function signature preferred
- Optional parameters: suffix with `?` (e.g., `imagemUrl?: string`)

**Return Values:**
- Always explicit: no implicit `undefined` returns
- Objects for multiple values: `{ qtd: number; motivo: string; ... }`
- Arrays for collections: `Violacao[]`, `ResumoDriverProjeto[]`
- Null for "no result": `perfil: ItemPerfil | null`, `| null` instead of optional

## Module Design

**Exports:**
- Named exports for utilities and hooks (e.g., `export function useAuth()`)
- Default export for React components (e.g., `export default Step1DadosOrcamento`)
- Type exports with `type` keyword (e.g., `export type StatusOrcamento = 'rascunho' | 'fechado' | 'perdido'`)
- Constants exported as regular exports (e.g., `export const MARGEM_SEGURANCA_DRIVER = 1.05`)

**Barrel Files:**
- None used; direct imports preferred
- UI component re-exports in `src/components/ui/` but not for business logic

**Organization:**
- Business types/calculations in single file: `src/types/orcamento.ts` (390+ LOC, comprehensive)
- Each hook in separate file: `src/hooks/useAuth.ts`, `src/hooks/useProdutoSearch.ts`
- Feature components grouped by feature: `Step1DadosOrcamento.tsx`, `Step2Ambientes.tsx`
- UI components in `src/components/ui/` (shadcn-ui library)
- Pages in `src/pages/`

## Supabase Client Usage

**Pattern:**
- Direct `.from()` calls for queries (no abstraction layer)
- Client initialized in `src/integrations/supabase/client.ts` with auto-refresh enabled
- Types auto-generated in `src/integrations/supabase/types.ts` (never edit manually)
- Edge functions called via `.functions.invoke()`
- RLS enforced; some tables require service_role (e.g., `colaboradores` creation)

**Examples:**
```typescript
// Direct query
const { data } = await supabase
  .from("produtos")
  .select("...")
  .eq('tipo_produto', 'fita')
  .limit(50);

// Check single row
const { data } = await supabase
  .from("allowed_users")
  .select("email")
  .eq("email", email.toLowerCase().trim())
  .maybeSingle();

// Insert
await supabase.from("clientes").insert({ nome: novoClienteNome.trim() });

// Edge function
await supabase.functions.invoke("create-colaborador", {
  body: { nome, user_id },
});
```

## Form Handling

**Framework:** `react-hook-form` with shadcn-ui wrapper components
- Components: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`
- No schema validation in forms; validation mostly client-side via business logic
- Complex inputs: custom components wrapping `Input` (e.g., `PrecoInput`)

**Pattern:**
```typescript
const [valor, setValor] = useState(0);
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.target.value;
  onChange(raw === "" ? 0 : (parseFloat(raw) || 0));
};
<Input
  type="number"
  min={0}
  step={0.10}
  value={valor}
  onChange={handleChange}
/>
```

## Database Field Mapping

**Supabase field names:** snake_case in database
**Frontend mapping:** camelCase in domain types with intentional renaming via `.select()` aliases

Example from `useProdutoSearch.ts`:
```typescript
.select(
  "id, codigo, descricao, preco_tabela, preco_minimo, imagem_url, " +
  "voltagem:tensao, wm:watts_por_metro, passadas:passadas_padrao, " +
  "familia_perfil, driver_tipo:subtipo, ..."
)
```

Maps `tensao` (DB) → `voltagem` (TypeScript), `watts_por_metro` → `wm`, etc.

---

*Convention analysis: 2026-04-16*
