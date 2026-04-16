# Codebase Structure

**Analysis Date:** 2026-04-16

## Directory Layout

```
auraoramentos/
├── src/                           # Frontend React application
│   ├── pages/                     # Route/page containers (wizard, admin, auth, drive)
│   │   ├── Index.tsx              # Budget wizard + client/project list (main entry)
│   │   ├── Admin.tsx              # Admin dashboard (products, collaborators, budgets, clients, exceptions, imports)
│   │   ├── Auth.tsx               # Login/password reset flow
│   │   ├── Drive.tsx              # File storage explorer
│   │   ├── ForgotPassword.tsx     # Password recovery
│   │   ├── ResetPassword.tsx      # Password reset form
│   │   ├── RequestAccess.tsx      # New user access request
│   │   ├── AdminUploadImagens.tsx # Image upload management
│   │   └── NotFound.tsx           # 404 page
│   │
│   ├── components/                # Reusable React components
│   │   ├── Step1DadosOrcamento.tsx    # Wizard step 1: select budget type
│   │   ├── Step2Ambientes.tsx         # Wizard step 2: add environments + systems
│   │   ├── Step3Revisao.tsx           # Wizard step 3: review totals, detect violations, export PDF
│   │   ├── StepIndicator.tsx          # Step progress indicator
│   │   │
│   │   ├── ClienteList.tsx            # Client/project tree with existing budgets
│   │   ├── ClienteArquivos.tsx        # File browser for client documents
│   │   ├── AmbienteCard.tsx           # Collapsible card for room with luminarias + systems
│   │   ├── ProdutoAutocomplete.tsx    # Product search dropdown (fita, driver, perfil, luminaria)
│   │   │
│   │   ├── AdminDashboard.tsx         # Admin tab: product list overview
│   │   ├── AdminExceptions.tsx        # Admin tab: price exception requests + approval
│   │   ├── ExceptionChat.tsx          # Real-time chat for exception negotiation
│   │   ├── EncerrarNegociacaoModal.tsx # Modal to mark budget status (closed/lost)
│   │   │
│   │   ├── ImportProdutos.tsx         # Admin: bulk import products from CSV
│   │   ├── ImportPrecos.tsx           # Admin: bulk import prices from CSV
│   │   ├── ImportImagens.tsx          # Admin: bulk import product images
│   │   ├── ImportMapper.tsx           # Helper component for column mapping in imports
│   │   │
│   │   ├── DriveExplorer.tsx          # File browser UI
│   │   ├── DriveBreadcrumb.tsx        # Breadcrumb navigation for Drive
│   │   ├── DriveSidebar.tsx           # Sidebar with client/project filters for Drive
│   │   │
│   │   ├── ValidacaoPanel.tsx         # Display validation errors/alerts from edge function
│   │   ├── NavLink.tsx                # Navigation link component
│   │   │
│   │   ├── ui/                        # shadcn-ui Radix components (generated)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── select.tsx
│   │   │   ├── accordion.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── card.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── command.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── label.tsx
│   │   │   └── ... (other Radix UI primitives)
│   │
│   ├── hooks/                     # Custom React hooks for data/state
│   │   ├── useAuth.ts             # Auth state (user, session, signOut)
│   │   ├── useUserRole.ts         # Check if user is admin
│   │   ├── useColaborador.ts      # Get current logged-in collaborator info
│   │   ├── useValidarSistemas.ts  # Invoke edge function for system validation
│   │   ├── useProdutoSearch.ts    # Search/filter products from database
│   │   └── use-toast.ts           # (UI helper for old toast system)
│   │
│   ├── integrations/              # Third-party service integrations
│   │   └── supabase/
│   │       ├── client.ts          # Supabase client initialization (auto-generated config)
│   │       └── types.ts           # Auto-generated TypeScript types for database schema
│   │
│   ├── types/                     # Domain and business logic types
│   │   └── orcamento.ts           # Core domain: interfaces (Produto, Orcamento, SistemaIluminacao, etc.) + all calculation functions
│   │
│   ├── lib/                       # Utility functions
│   │   ├── gerarPdfHtml.ts        # HTML-to-PDF generation for budgets
│   │   └── utils.ts               # Helper utilities (formatDate, cn, etc.)
│   │
│   ├── assets/                    # Static assets
│   │   ├── logo.png               # Application logo
│   │   └── ... (other images/icons)
│   │
│   ├── test/                      # Test files (Vitest)
│   │   ├── example.test.ts        # Example test
│   │   ├── setup.ts               # Test environment setup
│   │   └── ... (test specs)
│   │
│   ├── App.tsx                    # Main app component (routes, providers)
│   ├── main.tsx                   # React app entry point
│   └── vite-env.d.ts              # Vite environment type definitions
│
├── supabase/                      # Supabase backend
│   ├── functions/
│   │   └── validar-sistema-orcamento/
│   │       └── index.ts           # Deno edge function: server-side system validation (28+ rules)
│   │
│   ├── migrations/                # Database schema migrations (auto-generated)
│   └── ... (database config, types)
│
├── public/                        # Static files served by Vite
│   └── ... (favicon, etc.)
│
├── package.json                   # NPM dependencies, scripts
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite build configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── .prettierrc                    # Code formatter config
├── eslint.config.mjs              # Linter config
└── .env (NOT TRACKED)             # Local environment variables (Supabase URL, keys)
```

## Directory Purposes

**src/pages/:**
- Purpose: Route containers that load entire pages/screens
- Contains: Wizard steps (Index, Step1-3), Admin, Auth, Drive, error pages
- Key files: `Index.tsx` (main budget wizard entry), `Admin.tsx` (admin panel)

**src/components/:**
- Purpose: Reusable UI components across multiple pages
- Contains: Step components, cards (AmbienteCard), search dropdowns, forms, tables, dialogs
- Key files: `AmbienteCard.tsx` (environment editor), `Step3Revisao.tsx` (budget review + PDF generation)

**src/hooks/:**
- Purpose: Custom React hooks encapsulating data fetching, subscriptions, auth state
- Contains: Supabase queries wrapped in hooks, real-time subscriptions
- Key files: `useValidarSistemas.ts` (edge function invocation), `useProdutoSearch.ts` (product search)

**src/types/:**
- Purpose: Domain logic and type definitions (pure functions for business calculations)
- Contains: All interfaces (Orcamento, Ambiente, SistemaIluminacao, etc.) + calculation functions (no side effects)
- Key files: `orcamento.ts` (28+ functions for tape demand, driver qty, roll optimization, price totals)

**src/lib/:**
- Purpose: Utility functions not tied to React or domain logic
- Contains: PDF generation, string formatting, DOM utilities
- Key files: `gerarPdfHtml.ts` (HTML template builders for budget export)

**src/integrations/supabase/:**
- Purpose: Supabase client and auto-generated database types
- Contains: Client initialization, TypeScript types from schema
- Key files: `client.ts` (Supabase initialization), `types.ts` (auto-generated DB schema types)

**supabase/functions/validar-sistema-orcamento/:**
- Purpose: Server-side validation engine deployed as Supabase edge function (Deno runtime)
- Contains: 28+ lighting system validation rules (tensão compatibility, profile restrictions, driver power, tape width, etc.)
- Key files: `index.ts` (complete validation logic)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React app bootstrap (calls ReactDOM.createRoot)
- `src/App.tsx`: Route definitions, providers (QueryClient, TooltipProvider, Sonner)
- `src/pages/Index.tsx`: Budget wizard root (orchestrates Step1-3, manages orcamento state)

**Configuration:**
- `vite.config.ts`: Vite build, SWC compiler, path alias `@` → `src/`
- `tsconfig.json`: TypeScript strict mode, DOM lib, JSX
- `tailwind.config.js`: CSS framework customization
- `.prettierrc`: Code formatter (likely uses default Prettier + Tailwind plugin)
- `eslint.config.mjs`: Linting rules (likely TypeScript + React)

**Core Logic:**
- `src/types/orcamento.ts`: All domain calculations (calcularQtdDrivers, calcularRolosPorGrupo, calcularDriversPorProjeto, etc.)
- `src/lib/gerarPdfHtml.ts`: Budget HTML template builders
- `supabase/functions/validar-sistema-orcamento/index.ts`: Server-side validation rules

**Hooks (Data/State):**
- `src/hooks/useAuth.ts`: Manages user session, login/logout
- `src/hooks/useUserRole.ts`: Checks admin status
- `src/hooks/useValidarSistemas.ts`: Calls edge function, debounced, caches validation results
- `src/hooks/useProdutoSearch.ts`: Queries produtos table, debounced search

**UI Components:**
- `src/components/Step2Ambientes.tsx`: Adds/edits environments (calls AmbienteCard for each)
- `src/components/AmbienteCard.tsx`: Edits luminarias + systems within a room
- `src/components/Step3Revisao.tsx`: Displays totals, detects violations, initiates exceptions, generates PDF
- `src/components/ExceptionChat.tsx`: Real-time chat for exception negotiation

**Admin Components:**
- `src/components/AdminDashboard.tsx`: Product table view
- `src/components/AdminExceptions.tsx`: Exception requests list + approval UI
- `src/pages/Admin.tsx`: Admin page with tabs (products, collaborators, budgets, clients, exceptions, imports)

**File Storage (Drive):**
- `src/pages/Drive.tsx`: Main drive page
- `src/components/DriveExplorer.tsx`: File browser UI
- `src/components/ClienteArquivos.tsx`: File list for specific client

## Naming Conventions

**Files:**
- PascalCase for React components: `StepIndicator.tsx`, `ProdutoAutocomplete.tsx`
- camelCase for hooks: `useAuth.ts`, `useProdutoSearch.ts`
- camelCase for utilities: `gerarPdfHtml.ts`, `utils.ts`
- kebab-case for directories: `src/components/ui/`, `supabase/functions/`

**Functions:**
- camelCase for all functions: `calcularDemandaFita()`, `analisarMagneto48V()`, `gerarOrcamentoHtml()`
- Prefix `use` for custom hooks: `useAuth()`, `useValidarSistemas()`
- Prefix `calcular` for domain calculations: `calcularQtdDrivers()`, `calcularRolosPorGrupo()`
- Prefix `validar` for validation: `validarSistemaPadrao()` (in edge function)

**Variables:**
- camelCase for all variables: `orcamento`, `ambientes`, `colaborador`, `userData`
- Prefix underscore for private/internal state: `_tempName` (rarely used)
- Uppercase for constants: `MARGEM_SEGURANCA_DRIVER = 1.05`, `STEPS = ["Dados", "Ambientes", "Revisão"]`

**Types:**
- PascalCase for interfaces: `Orcamento`, `SistemaIluminacao`, `Violacao`, `Produto`
- PascalCase for type aliases: `StatusOrcamento`, `ProdutoFiltro`
- PascalCase for component prop types: `Step1Props`, `AmbienteCardProps`

## Where to Add New Code

**New Feature (e.g., add import from Excel):**
- Primary code: `src/components/ImportExcel.tsx` (new component)
- Hooks: `src/hooks/useExcelImport.ts` (if data fetching needed)
- Types: Add interface to `src/types/orcamento.ts` if new domain model
- Tab in Admin: Add TabsContent to `src/pages/Admin.tsx`
- Test: `src/test/import-excel.test.ts`

**New Calculation Function (e.g., calculate shipping cost):**
- Implementation: `src/types/orcamento.ts` (with other domain functions)
- Function signature: Follow pattern of existing functions (overloads for flexibility)
- Usage: Import in components that need it: `import { calcularFrete } from "@/types/orcamento"`
- Tests: Add test function to `src/test/orcamento.test.ts`

**New Component (e.g., sistema preview card):**
- File: `src/components/SistemaPreview.tsx`
- Props: Create interface `SistemaPreviewProps` at top
- Dependencies: Import types from `src/types/orcamento.ts`, UI components from `src/components/ui/`
- Usage: Import and use in parent component (e.g., AmbienteCard)

**New Page/Route (e.g., budget history page):**
- Page file: `src/pages/HistoricoBudgets.tsx`
- Route: Add Route in `src/App.tsx` (with ProtectedRoute wrapper if needed)
- Navigation: Add link in header or menu
- Hooks: Create `useHistoricoBudgets.ts` if data fetching needed

**New Admin Tab (e.g., usage analytics):**
- Component: `src/components/AdminAnalytics.tsx`
- Integration: Add TabsTrigger and TabsContent in `src/pages/Admin.tsx`
- Hooks: `src/hooks/useAnalyticsData.ts` if querying data

**New Hook (e.g., use budget local storage):**
- File: `src/hooks/useBudgetStorage.ts`
- Pattern: Follow `useAuth.ts` or `useProdutoSearch.ts` (export function hook, manage state with useState/useEffect)
- Usage: Call from components that need the data

**Utilities:**
- Shared helpers: `src/lib/utils.ts`
- Domain-specific: Create new file in `src/lib/` (e.g., `src/lib/pricingHelper.ts`)
- Test utilities: `src/test/helpers.ts`

## Special Directories

**src/components/ui/:**
- Purpose: Unstyled, reusable Radix UI primitives from shadcn-ui
- Generated: Yes (from `npx shadcn-ui add` commands)
- Committed: Yes (checked into repo, not auto-generated from node_modules)
- Note: Do NOT edit these manually; if customization needed, override via Tailwind in consuming components

**supabase/functions/:**
- Purpose: Serverless Deno functions deployed on Supabase edge
- Deployed: Via `supabase functions deploy`
- Environment: Deno runtime (TypeScript natively supported)
- Invoked: From frontend via `supabase.functions.invoke("name", { body })`

**.env (local only):**
- Purpose: Local development environment variables
- Contains: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- NOT committed (in .gitignore)
- Note: Create manually or copy from shared config

**src/test/:**
- Purpose: Vitest test suite
- Contains: `.test.ts` files for domain logic, utilities
- Run: `npm run test`, `npm run test:watch`
- Setup: `setup.ts` configures test environment

---

*Structure analysis: 2026-04-16*
