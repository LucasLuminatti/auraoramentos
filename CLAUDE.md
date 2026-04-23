<!-- GSD:project-start source:PROJECT.md -->
## Project

**AURA**

Sistema web de criação de orçamentos de iluminação da Luminatti, já em produção (vercel kappa). Colaboradores montam orçamentos em um wizard de 3 passos (cliente/projeto → ambientes com sistemas de LED → revisão e PDF), e admins gerenciam produtos, preços, clientes e aprovam exceções de preço. Backend em Supabase (auth, Postgres, edge functions); frontend em React 18 + Vite + TypeScript + shadcn-ui.

**Core Value:** Um colaborador consegue montar um orçamento real, do zero ao PDF entregue, sem bug e sem precisar de suporte.

### Constraints

- **Tech stack**: React 18 + Vite + TypeScript + Supabase + shadcn-ui — não trocar stack no marco 1
- **Timeline**: Fechar marco 1 essa semana (pré 2026-04-30)
- **Executor**: Só Lenny roda o UAT (perfil admin + colaborador alternados na mesma conta/conta de teste)
- **Ambiente**: UAT rodado em prod (vercel kappa) contra o Supabase real
- **Fluxo de correção**: Achou bug → para UAT → corrige → commit+push → retesta aquele fluxo → segue
- **Critério de aceite**: Zero bug, mesmo cosmético. Nada tolerado.
- **Dependências externas**: Email via Resend, PDF via html2pdf.js, Vercel deploy — se algum falhar durante UAT, documentar como bloqueador antes de corrigir
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.3 - Frontend application and configuration
- JavaScript (Deno) - Supabase Edge Functions runtime
- SQL - Supabase PostgreSQL queries via SDK
## Runtime
- Node.js - No specific version constrained (no .nvmrc file)
- Deno - Edge function runtime (Supabase Functions)
- npm
- Lockfile: package-lock.json (present)
## Frameworks
- React 18.3.1 - UI library
- Vite 5.4.19 - Build tool and dev server (configured on port 8080)
- React Router DOM 6.30.1 - Client-side routing
- shadcn-ui (Radix UI) 1.x - Component library (`src/components/ui/`)
- Tailwind CSS 3.4.17 - Styling framework
- lucide-react 0.462.0 - Icon library
- TanStack React Query 5.83.0 - Server state management (initialized in `src/App.tsx`)
- Supabase JS SDK 2.95.3 - Backend and authentication
- React Hook Form 7.61.1 - Form state management
- Zod 3.25.76 - Schema validation
- @hookform/resolvers 3.10.0 - Form resolver for Zod
- date-fns 3.6.0 - Date manipulation
- recharts 2.15.4 - Charts and data visualization
- sonner 1.7.4 - Toast notifications
- html2pdf.js 0.14.0 - Client-side PDF generation
- xlsx 0.18.5 - Excel file parsing/writing
- class-variance-authority 0.7.1 - Utility for managing variant styles
- clsx 2.1.1 - Conditional CSS class utilities
- cmdk 1.1.1 - Command/search component
- embla-carousel-react 8.6.0 - Carousel component
- react-resizable-panels 2.1.9 - Resizable panel layout
- vaul 0.9.9 - Drawer component
- next-themes 0.3.0 - Theme management
- tailwind-merge 2.6.0 - Merge Tailwind CSS classes
- input-otp 1.4.2 - OTP input component
## Development Tools
- ESLint 9.32.0 - Code linting with flat config (`eslint.config.js`)
- TypeScript ESLint 8.38.0 - TypeScript linting rules
- @eslint/js 9.32.0 - ESLint base rules
- eslint-plugin-react-hooks 5.2.0 - React Hooks linting
- eslint-plugin-react-refresh 0.4.20 - React Fast Refresh linting
- Vitest 3.2.4 - Unit test runner
- @testing-library/react 16.0.0 - React component testing utilities
- @testing-library/jest-dom 6.6.0 - Jest-DOM matchers
- jsdom 20.0.3 - DOM simulation for tests
- @vitejs/plugin-react-swc 3.11.0 - Vite React plugin using SWC compiler
- autoprefixer 10.4.21 - PostCSS autoprefixer
- postcss 8.5.6 - CSS transformation
- @tailwindcss/typography 0.5.16 - Prose styling plugin
- tailwindcss-animate 1.0.7 - Animation utilities
- @types/react 18.3.23 - React types
- @types/react-dom 18.3.7 - React DOM types
- @types/node 22.16.5 - Node.js types
## Configuration
- Vite environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Loaded in `src/integrations/supabase/client.ts` via `import.meta.env`
- LocalStorage used for session persistence
- Vite config: `vite.config.ts` (SWC React plugin, path alias `@` → `./src`)
- TypeScript config: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- PostCSS config: `postcss.config.js` (Tailwind + Autoprefixer)
- Tailwind config: `tailwind.config.ts` (dark mode class, CSS variables for theming)
- ESLint config: `eslint.config.js` (flat config, React Hooks & Refresh rules)
## Database
- Supabase PostgreSQL (jkewlaezvrbuicmncqbj, region sa-east-1)
- Types auto-generated: `src/integrations/supabase/types.ts`
## Platform Requirements
- Node.js (no specific version enforced)
- Vite dev server runs on `::` (all interfaces) port 8080
- HMR overlay disabled in dev config
- Deployment: Vercel (auraoramentos-kappa.vercel.app)
- Build output: dist/
- Static hosting via Vercel
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: PascalCase matching component name — `AmbienteCard.tsx`, `Step3Revisao.tsx`, `ExceptionChat.tsx`
- Custom hooks: camelCase with `use` prefix — `useAuth.ts`, `useUserRole.ts`, `useColaborador.ts`, `useValidarSistemas.ts`
- shadcn-ui primitives: kebab-case — `use-toast.ts`, `use-mobile.tsx`
- Utility/lib files: camelCase — `gerarPdfHtml.ts`, `utils.ts`
- Pages: PascalCase — `Auth.tsx`, `Admin.tsx`, `Index.tsx`
- Calculation/domain functions: camelCase with Portuguese verb prefix — `calcularMetragemTotal`, `calcularDemandaFita`, `calcularQtdDrivers`, `formatarMoeda`, `analisarMagneto48V`
- React components: PascalCase — `AmbienteCard`, `Step3Revisao`, `ProdutoAutocomplete`
- Event handlers: `handle` prefix — `handleSubmit`, `handleNovoOrcamento`, `handleCriarCliente`, `handleAction`
- Fetch functions: `fetch` prefix — `fetchData`, `fetchExceptions`, `fetchProdutos`
- Supabase payload converters: descriptive camelCase — `sistemaParaPayload`, `imageToBase64`
- State variables: camelCase, often Portuguese nouns — `colaborador`, `orcamento`, `violacoes`, `gruposFita`
- Boolean state: `is`/`loading`/`open`/`saving` prefixes — `isAdmin`, `loading`, `chatOpen`, `savingOrcamento`
- Constants: SCREAMING_SNAKE_CASE for module-level — `MARGEM_SEGURANCA_DRIVER`, `TOAST_LIMIT`, `BATCH_SIZE`
- Inline constants: PascalCase arrays — `RULES`, `STEPS`
- Domain entities: PascalCase Portuguese nouns — `Orcamento`, `Ambiente`, `SistemaIluminacao`, `ItemFitaLED`, `ItemDriver`
- Component prop types: PascalCase with `Props` suffix — `AmbienteCardProps`, `Step3Props`, `ValidacaoPanelProps`
- Local interfaces (not exported): PascalCase, defined at file top — `Violacao`, `PriceException`, `Message`, `OrcamentoRow`
- Union string literals: single-quoted Portuguese strings — `'rascunho' | 'fechado' | 'perdido'`, `'Primeiro Orçamento' | 'Revisão 01'`
- Export only types/interfaces shared across files; keep component-local types unexported
## Code Style
- No Prettier config present — formatting is ad-hoc/editor-driven
- Single quotes for string literals in TypeScript/TSX
- Semicolons used consistently
- Inline JSX attributes on one line for short props, multi-line for long prop lists
- Template literals used for string interpolation
- `"` (double quotes) used inside JSX string props
- ESLint 9 with `typescript-eslint` recommended config (`eslint.config.js`)
- `react-hooks/recommended` rules enabled
- `@typescript-eslint/no-unused-vars` explicitly turned OFF — unused vars are tolerated
- `react-refresh/only-export-components` is a warning, not an error
- `strict: false` in `tsconfig.app.json` — TypeScript is lenient (no strict null checks, `noImplicitAny: false`)
## Import Organization
- `@/` maps to `src/` — used consistently across all files (configured in both `tsconfig.app.json` and `vitest.config.ts`)
- Never use relative paths like `../../` — always use `@/`
## Toast / Notification Pattern
## Supabase Query Pattern
## Error Handling
- Supabase errors: destructure `{ data, error }`, check `if (error)` or `throw error`, show toast to user
- Edge function calls: wrapped in `try/catch`, errors logged with `console.error`, silent fallback or `null` state
- Async handlers: `setLoading(true)` before, `setLoading(false)` in `finally` or after both success/error branches
- User validation errors: `toast.error("message")` and `return` early before any async call
- Never bubble errors to error boundaries — all errors are caught locally
## Form State
## Component Design
- Props interfaces always defined immediately above the component function
- Callback props named `on` + PascalCase verb — `onChange`, `onRemove`, `onNext`, `onPrev`, `onOpenChange`, `onStatusChange`
- Optional props marked with `?` — `clienteId?: string`, `placeholder?: string`
## Styling
- Use design token classes (`text-foreground`, `bg-card`, `text-muted-foreground`, `border-destructive`) not hard-coded colors
- Hard-coded colors allowed for semantic states not in the token system — `bg-red-50`, `text-yellow-800`, `bg-emerald-500`
- Use `cn()` from `src/lib/utils.ts` for conditional class merging:
- Always import from `@/components/ui/` — never directly from `@radix-ui/*`
- Compose shadcn primitives (Card, Dialog, Table, Badge, etc.) rather than building custom markup
- Icons exclusively from `lucide-react`
## Language Convention
- **UI text:** Brazilian Portuguese — button labels, error messages, placeholder text, section headings
- **Code identifiers:** English or Portuguese camelCase depending on domain — domain types use Portuguese (`Orcamento`, `Ambiente`, `colaborador`), infrastructure/React patterns use English (`loading`, `error`, `user`, `session`)
- **Comments:** Portuguese for domain logic, English for infrastructure code
- **JSDoc:** Used sparingly — only on exported calculation functions in `src/types/orcamento.ts` with `/** ... */` style
## Logging
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Frontend-driven state management:** React components manage local state via useState and pass data through props
- **Direct Supabase integration:** All data queries/mutations go directly to Supabase client (no API layer)
- **TanStack React Query:** Available in dependencies but not actively used for caching (direct Supabase calls dominate)
- **Multi-step form patterns:** Wizard-style flows with step navigation
## Layers
- Purpose: UI components rendered to users, form input handling, data visualization
- Location: `src/pages/`, `src/components/`
- Contains: Page components (Index, Auth, Admin, Drive), UI step wizards, data tables, dialogs
- Depends on: React, React Router DOM, shadcn-ui, Tailwind CSS, Lucide icons
- Used by: Browser
- Purpose: Core calculation functions, data transformation, validation rules for lighting systems
- Location: `src/types/orcamento.ts`
- Contains: Calculation functions for tape demand (metragem), power consumption, driver quantity, roll optimization, price violation detection
- Depends on: TypeScript types, math operations
- Used by: Step3Revisao, PDF generation, Admin components
- Purpose: Authentication, database queries, real-time subscriptions, file uploads
- Location: `src/integrations/supabase/client.ts`, `src/hooks/useAuth.ts`, `src/hooks/useColaborador.ts`, `src/hooks/useUserRole.ts`
- Contains: Supabase client initialization, auth state management, role checking, auto-create colaborador flow
- Depends on: Supabase client library, localStorage for session persistence
- Used by: All pages and components needing data
## Data Flow
- **Local React state:** Most state stored in component useState (dados, ambientes)
- **Supabase real-time:** Only price_exceptions use subscriptions for approval updates
- **No Redux/Zustand:** Prop drilling used for multi-step navigation
## Key Abstractions
- Purpose: Represents a complete lighting system combining tape + driver + optional profile rail
- Examples: `src/types/orcamento.ts` interface + `src/components/AmbienteCard.tsx` uses it
- Pattern: Immutable object with calculation functions; updated via component setState
- Purpose: Groups luminarias and systems within a single physical room
- Examples: Created in Step2Ambientes, edited in AmbienteCard
- Pattern: UUID-based, contains arrays of luminarias and systems
- Purpose: Complete budget document with metadata (colaborador, tipo) + all ambientes
- Examples: Passed to Step3Revisao for final review
- Pattern: Top-level aggregate containing dados + ambientes
- Purpose: Represents a single price violation (item below minimum)
- Examples: Detected in Step3Revisao, shown in alerts, can trigger ExceptionChat
- Pattern: Tagged with ambienteId, tipo (luminaria|perfil|fita|driver), and product details
## Entry Points
- Location: `src/main.tsx`
- Triggers: Script executed by browser at app startup
- Responsibilities: Mounts React app to DOM element #root
- Location: `src/App.tsx`
- Triggers: Loaded by main.tsx
- Responsibilities: 
- Location: `src/pages/Auth.tsx`
- Triggers: When user navigates to /auth or logs out
- Responsibilities: 
- Location: `src/pages/Index.tsx`
- Triggers: When authenticated user navigates to /
- Responsibilities:
- Location: `src/pages/Admin.tsx`
- Triggers: When admin user navigates to /admin (blocked by AdminRoute)
- Responsibilities:
- Location: `src/pages/Drive.tsx`
- Triggers: When user clicks "Drive" button or navigates to /drive
- Responsibilities: Cloud file explorer (DriveExplorer) for projeto/cliente document storage
## Error Handling
- Supabase query failures → `toast.error("Erro ao...")` with optional error.message
- Validation failures → `toast.error()` with specific validation message
- Success operations → `toast.success("Ação concluída")`
- No try-catch blocks; errors rely on Supabase SDK returning error objects
## Cross-Cutting Concerns
- Console.error() used in useColaborador for debugging auto-create failures
- No structured logging framework; no production error tracking
- Password strength rules enforced in Auth.tsx (8 chars, uppercase, lowercase, number, special)
- Budget type selection required in Step1DadosOrcamento
- At least one ambiente required in Step2Ambientes
- Price violations detected in Step3Revisao (item price < minimum)
- Edge function `validar-sistema-orcamento` validates system calculations server-side
- Supabase Auth handles session management (localStorage, auto-refresh)
- Allowed-users gate during signup: `allowed_users` table must contain email
- Role-based access: `user_roles` table (role='admin') checked by useUserRole hook
- Colaborador auto-created on first login via `create-colaborador` edge function
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
