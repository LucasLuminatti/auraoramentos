# Codebase Structure

**Analysis Date:** 2026-04-23

## Directory Layout

```
auraoramentos/
├── .claude/               # Claude AI context files
├── .planning/             # GSD documentation
├── .lovable/              # Lovable platform config
├── public/                # Static assets (logo, favicon)
├── src/
│   ├── assets/            # Images (logo.png)
│   ├── components/        # React components (~20+ .tsx files)
│   │   ├── ui/            # shadcn-ui components (buttons, dialogs, tables, etc.)
│   │   ├── Step1DadosOrcamento.tsx      # Budget type selection
│   │   ├── Step2Ambientes.tsx           # Room/system editor
│   │   ├── Step3Revisao.tsx             # Review, violations, PDF generation
│   │   ├── AmbienteCard.tsx             # Room editor (luminarias + systems)
│   │   ├── ClienteList.tsx              # Clients/projects/budgets view
│   │   ├── Admin*.tsx                   # Admin dashboard components
│   │   ├── Import*.tsx                  # CSV import components
│   │   ├── Exception*.tsx               # Price exception flow
│   │   └── Drive*.tsx                   # File explorer components
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts                   # Supabase auth state
│   │   ├── useUserRole.ts               # Admin role checking
│   │   ├── useColaborador.ts            # Current user colaborador info
│   │   ├── useProdutoSearch.ts          # Product autocomplete search
│   │   ├── useValidarSistemas.ts        # System validation via edge function
│   │   └── use-*.tsx                    # shadcn-ui hooks (toast, mobile)
│   ├── integrations/supabase/           # Supabase client & types
│   │   ├── client.ts                    # Supabase client initialization
│   │   └── types.ts                     # Auto-generated TypeScript types
│   ├── lib/               # Utility functions
│   │   ├── gerarPdfHtml.ts              # Client-side PDF generation
│   │   └── utils.ts                     # cn() merge utility, getSaudacao()
│   ├── pages/             # Page components (routed via App.tsx)
│   │   ├── Index.tsx                    # Main wizard (Step1→Step2→Step3)
│   │   ├── Auth.tsx                     # Login/signup
│   │   ├── ForgotPassword.tsx           # Password reset request
│   │   ├── ResetPassword.tsx            # Password reset form (from email)
│   │   ├── RequestAccess.tsx            # New user access request form
│   │   ├── Admin.tsx                    # Admin dashboard
│   │   ├── AdminUploadImagens.tsx       # Image upload (admin only)
│   │   ├── Drive.tsx                    # Cloud file explorer
│   │   └── NotFound.tsx                 # 404 page
│   ├── types/             # TypeScript domain types
│   │   └── orcamento.ts                 # Core domain (SistemaIluminacao, Ambiente, Orcamento, calculations)
│   ├── test/              # Test files
│   ├── App.tsx            # Root component (routes + providers)
│   ├── main.tsx           # Entry point
│   ├── App.css            # Root styles
│   ├── index.css          # Global styles (Tailwind directives)
│   └── vite-env.d.ts      # Vite environment types
├── supabase/              # Edge functions, migrations, seed
│   ├── functions/         # Supabase Edge Functions
│   │   └── validar-sistema-orcamento/   # System validation logic (server-side)
│   ├── migrations/        # Database schema migrations
│   ├── .env.example       # Environment variables template
│   └── config.toml        # Supabase config
├── .eslintrc.cjs          # ESLint rules
├── tsconfig.json          # TypeScript base config
├── tsconfig.app.json      # TypeScript app-specific config
├── tsconfig.node.json     # TypeScript node (build) config
├── vite.config.ts         # Vite build config
├── vitest.config.ts       # Vitest test runner config
├── package.json           # Dependencies & scripts
└── dist/                  # Build output (git-ignored)
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript/React source code
- Contains: Pages, components, hooks, utilities, types
- Key files: `App.tsx`, `main.tsx`

**`src/components/ui/`:**
- Purpose: Shadcn-ui component library (button, dialog, table, etc.)
- Contains: Pre-built Radix UI wrappers with Tailwind styling
- Generated via shadcn-ui CLI; not hand-written

**`src/components/`:**
- Purpose: Application-specific React components
- Contains: Wizard steps, budget UI, admin panels, import forms
- Key files: `Step1DadosOrcamento.tsx`, `Step2Ambientes.tsx`, `Step3Revisao.tsx`, `AmbienteCard.tsx`, `Admin.tsx`

**`src/pages/`:**
- Purpose: Route-level pages (one-to-one mapping with routes in App.tsx)
- Contains: Full-page components (Auth, Index budget wizard, Admin dashboard, Drive)
- Key files: `Index.tsx` (main), `Auth.tsx` (login/signup), `Admin.tsx` (admin dashboard)

**`src/hooks/`:**
- Purpose: Reusable React hooks for state, data fetching, role checking
- Contains: Supabase integration hooks, shadcn-ui hooks
- Key files: `useAuth.ts`, `useUserRole.ts`, `useColaborador.ts`

**`src/integrations/supabase/`:**
- Purpose: Supabase client configuration and auto-generated types
- Contains: Initialized Supabase client, TypeScript database schema
- Key files: `client.ts` (do not edit), `types.ts` (auto-generated)

**`src/lib/`:**
- Purpose: Shared utility functions not component-specific
- Contains: PDF generation, formatting, helpers
- Key files: `gerarPdfHtml.ts` (client-side HTML-to-PDF), `utils.ts` (cn merge, greeting)

**`src/types/`:**
- Purpose: Domain type definitions and business logic
- Contains: Lighting system calculations, budget aggregates, validation rules
- Key files: `orcamento.ts` (core domain layer, 439 lines)

**`supabase/`:**
- Purpose: Backend configuration, migrations, edge functions
- Contains: Database schema, Supabase CLI config
- Key subdirs: `functions/` (edge functions), `migrations/` (schema changes)

**`public/`:**
- Purpose: Static files served as-is (images, favicon)
- Contains: `logo.png` (Luminatti logo)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Mounts React app to #root
- `src/App.tsx`: Root component, route definitions, provider setup
- `src/pages/Index.tsx`: Main budget creation wizard

**Configuration:**
- `package.json`: Dependencies, scripts, project metadata
- `vite.config.ts`: Vite dev server (port 8080), path aliases (@/ → src/)
- `tsconfig.json`: TypeScript strict mode, target
- `.eslintrc.cjs`: ESLint rules

**Core Logic:**
- `src/types/orcamento.ts`: All calculation functions (tape demand, driver qty, roll optimization, totals)
- `src/lib/gerarPdfHtml.ts`: PDF generation (html2pdf.js library)

**Testing:**
- `vitest.config.ts`: Vitest test runner config
- `src/test/`: Test files location (currently minimal)

## Naming Conventions

**Files:**
- Page components: PascalCase, match route name (Auth.tsx, Admin.tsx, Index.tsx)
- Feature components: PascalCase, descriptive name (AmbienteCard.tsx, Step2Ambientes.tsx, AdminExceptions.tsx)
- Utility files: camelCase (gerarPdfHtml.ts, useAuth.ts)
- Hooks: camelCase, start with `use` (useAuth.ts, useColaborador.ts)
- UI components: PascalCase, from shadcn-ui library (Button.tsx, Dialog.tsx)

**Directories:**
- Feature folders: singular noun (components, hooks, pages, lib, types)
- UI subfolder: `ui/` for shadcn components

**Exports:**
- Functions/hooks: Named exports (export function useAuth() {})
- Components: Default export (export default Step1DadosOrcamento)
- Types: Named exports (export interface Orcamento {})

## Where to Add New Code

**New Feature (e.g., new tab in Admin):**
- Primary code: `src/components/AdminNewFeature.tsx` (component) or `src/pages/NewPage.tsx` (full page)
- Supabase queries: Use direct `supabase.from()` calls in useEffect or event handlers
- Tests: `src/test/AdminNewFeature.test.tsx` (if test infrastructure expanded)

**New Component/Module:**
- Implementation: `src/components/FeatureName.tsx` (if reusable) or within existing page
- Props interface: Define above component (interface FeatureNameProps {})
- Exports: Default export for page-level, named export for library components

**Utilities:**
- Shared helpers: `src/lib/helperName.ts`
- Domain calculations: Extend `src/types/orcamento.ts` with new functions
- Hooks: `src/hooks/useNewHook.ts`

**Styling:**
- Use Tailwind CSS classes directly in JSX (no separate .css files for components)
- Global styles: `src/index.css` (Tailwind directives)
- Component-specific overrides: `src/App.css` (rare)

## Special Directories

**`src/integrations/supabase/`:**
- Purpose: Supabase client wrapper
- Generated: `types.ts` auto-generated by Supabase CLI (`supabase gen types`)
- Committed: `client.ts` is hand-written and committed
- Notes: Never edit `types.ts` manually; regenerate from schema changes

**`dist/`:**
- Purpose: Production build output (Vite build)
- Generated: Yes (via `npm run build`)
- Committed: No (git-ignored)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (git-ignored)

**`.planning/`:**
- Purpose: GSD codebase documentation
- Generated: Yes (by GSD tools)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

---

*Structure analysis: 2026-04-23*
