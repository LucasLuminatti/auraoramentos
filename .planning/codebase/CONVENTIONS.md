# Coding Conventions

**Analysis Date:** 2026-04-23

## Naming Patterns

**Files:**
- React components: PascalCase matching component name — `AmbienteCard.tsx`, `Step3Revisao.tsx`, `ExceptionChat.tsx`
- Custom hooks: camelCase with `use` prefix — `useAuth.ts`, `useUserRole.ts`, `useColaborador.ts`, `useValidarSistemas.ts`
- shadcn-ui primitives: kebab-case — `use-toast.ts`, `use-mobile.tsx`
- Utility/lib files: camelCase — `gerarPdfHtml.ts`, `utils.ts`
- Pages: PascalCase — `Auth.tsx`, `Admin.tsx`, `Index.tsx`

**Functions:**
- Calculation/domain functions: camelCase with Portuguese verb prefix — `calcularMetragemTotal`, `calcularDemandaFita`, `calcularQtdDrivers`, `formatarMoeda`, `analisarMagneto48V`
- React components: PascalCase — `AmbienteCard`, `Step3Revisao`, `ProdutoAutocomplete`
- Event handlers: `handle` prefix — `handleSubmit`, `handleNovoOrcamento`, `handleCriarCliente`, `handleAction`
- Fetch functions: `fetch` prefix — `fetchData`, `fetchExceptions`, `fetchProdutos`
- Supabase payload converters: descriptive camelCase — `sistemaParaPayload`, `imageToBase64`

**Variables:**
- State variables: camelCase, often Portuguese nouns — `colaborador`, `orcamento`, `violacoes`, `gruposFita`
- Boolean state: `is`/`loading`/`open`/`saving` prefixes — `isAdmin`, `loading`, `chatOpen`, `savingOrcamento`
- Constants: SCREAMING_SNAKE_CASE for module-level — `MARGEM_SEGURANCA_DRIVER`, `TOAST_LIMIT`, `BATCH_SIZE`
- Inline constants: PascalCase arrays — `RULES`, `STEPS`

**Types/Interfaces:**
- Domain entities: PascalCase Portuguese nouns — `Orcamento`, `Ambiente`, `SistemaIluminacao`, `ItemFitaLED`, `ItemDriver`
- Component prop types: PascalCase with `Props` suffix — `AmbienteCardProps`, `Step3Props`, `ValidacaoPanelProps`
- Local interfaces (not exported): PascalCase, defined at file top — `Violacao`, `PriceException`, `Message`, `OrcamentoRow`
- Union string literals: single-quoted Portuguese strings — `'rascunho' | 'fechado' | 'perdido'`, `'Primeiro Orçamento' | 'Revisão 01'`
- Export only types/interfaces shared across files; keep component-local types unexported

## Code Style

**Formatting:**
- No Prettier config present — formatting is ad-hoc/editor-driven
- Single quotes for string literals in TypeScript/TSX
- Semicolons used consistently
- Inline JSX attributes on one line for short props, multi-line for long prop lists
- Template literals used for string interpolation
- `"` (double quotes) used inside JSX string props

**Linting:**
- ESLint 9 with `typescript-eslint` recommended config (`eslint.config.js`)
- `react-hooks/recommended` rules enabled
- `@typescript-eslint/no-unused-vars` explicitly turned OFF — unused vars are tolerated
- `react-refresh/only-export-components` is a warning, not an error
- `strict: false` in `tsconfig.app.json` — TypeScript is lenient (no strict null checks, `noImplicitAny: false`)

## Import Organization

**Order (observed pattern):**
1. React core — `import { useState, useEffect } from "react"`
2. Third-party libraries — `react-router-dom`, `@tanstack/react-query`, `sonner`, `date-fns`, `lucide-react`
3. Supabase client — `import { supabase } from "@/integrations/supabase/client"`
4. Internal types — `import type { ... } from "@/types/orcamento"`
5. Internal hooks — `import { useAuth } from "@/hooks/useAuth"`
6. Internal components (shadcn-ui first, then custom) — `@/components/ui/...` then `@/components/...`
7. Assets — `import logo from "@/assets/logo.png"`

**Path Aliases:**
- `@/` maps to `src/` — used consistently across all files (configured in both `tsconfig.app.json` and `vitest.config.ts`)
- Never use relative paths like `../../` — always use `@/`

## Toast / Notification Pattern

Two toast systems coexist — always use `sonner` for user-facing notifications in new code:

**`sonner` (preferred for all new component/page code):**
```typescript
import { toast } from "sonner";

toast.success("Cliente adicionado!");
toast.error("Erro ao criar cliente");
toast("Mensagem neutra");
```
Files using sonner: `src/components/AmbienteCard.tsx`, `src/components/AdminExceptions.tsx`, `src/components/ExceptionChat.tsx`, `src/pages/Admin.tsx`, `src/pages/Index.tsx`, `src/components/Step1DadosOrcamento.tsx`

**`useToast` hook (legacy, only in `src/pages/Auth.tsx`):**
```typescript
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();
toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
```
Do not use `useToast` in new code. Use `sonner`.

## Supabase Query Pattern

Direct Supabase calls are made inside `useEffect` or async handler functions — TanStack Query is installed but not used for data fetching (no `useQuery`/`useMutation` calls found). Pattern is manual loading-state management:

```typescript
const [data, setData] = useState<Type[]>([]);
const [loading, setLoading] = useState(true);

const fetchData = async () => {
  setLoading(true);
  const { data } = await supabase.from("table").select("*");
  setData(data || []);
  setLoading(false);
};

useEffect(() => { fetchData(); }, [dependency]);
```

Use `.maybeSingle()` (not `.single()`) when a row may or may not exist — avoids throwing on empty results.

Realtime subscriptions use the channel API:
```typescript
const channel = supabase
  .channel("channel-name")
  .on("postgres_changes", { event: "*", schema: "public", table: "table_name" }, callback)
  .subscribe();
return () => { supabase.removeChannel(channel); };
```

## Error Handling

**Patterns:**
- Supabase errors: destructure `{ data, error }`, check `if (error)` or `throw error`, show toast to user
- Edge function calls: wrapped in `try/catch`, errors logged with `console.error`, silent fallback or `null` state
- Async handlers: `setLoading(true)` before, `setLoading(false)` in `finally` or after both success/error branches
- User validation errors: `toast.error("message")` and `return` early before any async call
- Never bubble errors to error boundaries — all errors are caught locally

**`console.error` usage:** Only for non-user-facing errors (edge function failures, 404 route logging). User-visible errors always go through toast.

## Form State

Forms use inline `useState` for each field — no form library for most forms:
```typescript
const [email, setEmail] = useState("");
const [loading, setLoading] = useState(false);
// ...
<Input value={email} onChange={(e) => setEmail(e.target.value)} />
```

`react-hook-form` and `zod` are installed as dependencies but not used in any existing form. Do not introduce them for new forms unless there is significant validation complexity justifying it.

## Component Design

**Props:**
- Props interfaces always defined immediately above the component function
- Callback props named `on` + PascalCase verb — `onChange`, `onRemove`, `onNext`, `onPrev`, `onOpenChange`, `onStatusChange`
- Optional props marked with `?` — `clienteId?: string`, `placeholder?: string`

**Component export:** Always `export default ComponentName` at the end of the file. No named component exports.

**Internal helpers:** Pure utility functions defined above the component function in the same file (not exported) — `getPasswordStrength`, `imageToBase64`, `derivarNomeInicial`, `sistemaParaPayload`, `PrecoInput`.

**Conditional rendering:** Ternary for simple cases, early return for loading/empty states.

## Styling

**Tailwind CSS utilities:**
- Use design token classes (`text-foreground`, `bg-card`, `text-muted-foreground`, `border-destructive`) not hard-coded colors
- Hard-coded colors allowed for semantic states not in the token system — `bg-red-50`, `text-yellow-800`, `bg-emerald-500`
- Use `cn()` from `src/lib/utils.ts` for conditional class merging:
  ```typescript
  import { cn } from "@/lib/utils";
  className={cn("w-28", isAbaixoTabela && "border-destructive text-destructive")}
  ```

**shadcn-ui component usage:**
- Always import from `@/components/ui/` — never directly from `@radix-ui/*`
- Compose shadcn primitives (Card, Dialog, Table, Badge, etc.) rather than building custom markup
- Icons exclusively from `lucide-react`

## Language Convention

- **UI text:** Brazilian Portuguese — button labels, error messages, placeholder text, section headings
- **Code identifiers:** English or Portuguese camelCase depending on domain — domain types use Portuguese (`Orcamento`, `Ambiente`, `colaborador`), infrastructure/React patterns use English (`loading`, `error`, `user`, `session`)
- **Comments:** Portuguese for domain logic, English for infrastructure code
- **JSDoc:** Used sparingly — only on exported calculation functions in `src/types/orcamento.ts` with `/** ... */` style

## Logging

**No structured logging framework.** Use `console.error` only for non-recoverable background failures (edge function invocation errors, unexpected 404s). Do not use `console.log` for debugging in committed code.

---

*Convention analysis: 2026-04-23*
