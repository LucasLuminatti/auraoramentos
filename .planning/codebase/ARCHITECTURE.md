# Architecture

**Analysis Date:** 2026-04-16

## Pattern Overview

**Overall:** Multi-layer client-side React application with pure functional domain logic, React hook-based state management, and real-time Supabase integration through edge functions for validation and server-side consensus.

**Key Characteristics:**
- **Domain-first design**: All calculation logic in pure functions (`src/types/orcamento.ts`)
- **Step-based wizard UI**: 3-step linear flow with local state in React for all budget data
- **Edge function validation**: Server-side rules engine (`validar-sistema-orcamento`) validates lighting systems
- **Real-time price exceptions**: Supabase subscriptions (`price_exceptions` + `exception_messages` tables) for async approval workflows
- **Role-based access**: Admin vs. collaborator checked at route level and component level
- **No global state container**: React hooks + component props drilling for budget state management

## Layers

**Presentation (UI Components):**
- Purpose: Render budget wizard, admin dashboards, and file explorer; handle user interactions
- Location: `src/pages/` (page/route containers), `src/components/` (reusable UI)
- Contains: React components using shadcn-ui (Radix UI) + Tailwind CSS, dialogs, forms, tables
- Depends on: Domain logic (`src/types/orcamento.ts`), API hooks (`useAuth`, `useColaborador`, `useValidarSistemas`)
- Used by: App router (`src/App.tsx`)

**Domain Logic (Business Rules):**
- Purpose: Pure functional calculations for lighting systems, drivers, tapes, profiles, and price violations
- Location: `src/types/orcamento.ts`
- Contains: Interfaces (`SistemaIluminacao`, `Ambiente`, `Orcamento`) and calculation functions
- Depends on: Nothing (pure functions; no external dependencies)
- Used by: All components (`Step2Ambientes`, `Step3Revisao`, `AmbienteCard`, PDF generation)

**API Integration Layer:**
- Purpose: Abstract Supabase client calls behind typed hooks for auth, roles, product search, system validation
- Location: `src/hooks/` (useAuth, useUserRole, useValidarSistemas, useProdutoSearch, useColaborador)
- Contains: Custom React hooks wrapping Supabase queries, edge function invocations, real-time subscriptions
- Depends on: Supabase client (`src/integrations/supabase/client.ts`), domain types
- Used by: Pages and major components

**Persistence Layer:**
- Purpose: Supabase PostgreSQL database + Edge Functions for validation rules and consensus
- Location: `supabase/functions/validar-sistema-orcamento/` (Deno-based edge function)
- Contains: Database tables (`orcamentos`, `clientes`, `projetos`, `produtos`, `price_exceptions`, `exception_messages`, `user_roles`), server-side validation logic
- Depends on: Database schema, Deno runtime
- Used by: Frontend via `supabase.functions.invoke()` and direct queries

**Data Generation Layer:**
- Purpose: Convert in-memory budget state to formatted HTML/PDF for PDF export
- Location: `src/lib/gerarPdfHtml.ts`
- Contains: HTML template builders for budgets (tables, totals, images as base64)
- Depends on: Domain logic (calculations), image fetching/conversion utilities
- Used by: `Step3Revisao` component

## Data Flow

**Budget Creation Workflow (Index → Step1 → Step2 → Step3):**

1. User lands on `Index.tsx` in "list" mode showing existing clients/projects
2. User clicks "Novo Orçamento" → mode switches to "create", Step 1 displays
3. **Step 1** (`Step1DadosOrcamento.tsx`): User selects budget type (Primeiro Orçamento, Revisão 01, etc.)
   - State: `dados: DadosOrcamento` (colaborador, tipo)
   - Validation: Checks `tipo` is not empty
   - Next → Step 2

4. **Step 2** (`Step2Ambientes.tsx`): User adds environments with lighting systems
   - State: `ambientes: Ambiente[]` where each Ambiente contains `luminarias[]` and `sistemas[]`
   - For each system: User adds Fita (LED tape) + Driver + optional Perfil (profile rail)
   - Real-time validation via `useValidarSistemas` hook:
     - Debounces 800ms, invokes `validar-sistema-orcamento` edge function
     - Returns erros (blocking), alertas (warnings), sugestoes (suggestions)
   - Component: `AmbienteCard` → `ProdutoAutocomplete` for product selection
   - Validation: At least one environment required before advancing
   - Next → Step 3

5. **Step 3** (`Step3Revisao.tsx`): Review totals, detect price violations, negotiate exceptions
   - State: Immutable `orcamento` object (dados + ambientes) read-only for review
   - Calculations: `calcularRolosPorGrupo()`, `calcularDriversPorProjeto()`, `calcularTotalGeral()` run in useMemo
   - Violation detection: Scans all items for `preco_unitario < preco_minimo`
   - Exception flow:
     - If violation exists → User can submit exception request via `ExceptionChat`
     - Exception stored in `price_exceptions` table with status "pendente"
     - Real-time subscription to `exception_messages` table for admin replies
     - Admin approves/rejects via `AdminExceptions` component
     - Once approved → Button to save/generate PDF becomes available
   - PDF generation: Converts budget HTML to PDF client-side using `gerarPdfHtml()`
   - Finalize: Saves orcamento to `orcamentos` table with status (rascunho/enviado/aprovado)

**State Management:**
- Budget data (`dados`, `ambientes`) flows down from `Index.tsx` as props → Step components → child components
- Each step component has local `setDados`/`setAmbientes` callbacks for mutations
- No Redux/Zustand; React state with callback props (prop drilling)
- Query state (products, collaborators, exceptions) managed by `useQuery`-like patterns in custom hooks

**Real-Time Collaboration (Price Exceptions):**
1. Collaborator submits exception: Creates row in `price_exceptions` + initial message in `exception_messages`
2. Supabase real-time subscription on `exception_messages` (channel: `exception-messages-{id}`) listens for new messages
3. Admin sees exception in `AdminExceptions` tab, opens chat, adds reply message
4. Collaborator sees admin reply in real-time via channel subscription
5. Admin approves → Updates `price_exceptions.status = "aprovado"`
6. Collaborator sees approval, budget advances to PDF/save

## Key Abstractions

**SistemaIluminacao (Lighting System):**
- Purpose: Represents a complete lighting fixture unit: LED tape (fita) + driver + optional profile rail (perfil)
- Examples: `src/types/orcamento.ts` line 78
- Pattern: Contains `ItemFitaLED`, `ItemDriver`, optional `ItemPerfil`, manual metragem/passadas fallback
- Calculation contract: Exposes `calcularDemandaFita()`, `calcularConsumoW()`, `calcularQtdDrivers()`

**Ambiente (Room/Zone):**
- Purpose: Groups luminarias (fixtures) and sistemas (lighting systems) within a budget scope
- Examples: "Living Room" with 3 luminarias + 2 fita-driver systems
- Pattern: Simple container with ID, name, and arrays of items
- Used by: Budget structure, calculation aggregations

**Produto (Product Catalog Entry):**
- Purpose: Catalog item from database with technical specs (voltagem, wm, potencia, family, restrictions)
- Examples: Different LED tape types, drivers by power/voltage, profile families
- Pattern: Loaded dynamically via `useProdutoSearch`, typed in `src/types/orcamento.ts` line 1
- Mapping: Product selected → converted to `ItemFitaLED`, `ItemDriver`, or `ItemLuminaria` in UI

**Violacao (Price Violation):**
- Purpose: Detected when item's `preco_unitario < preco_minimo`
- Examples: Step3Revisao line 32-41
- Pattern: Contains reference to item (codigo, descricao) + both prices for display in exception UI
- Scope: Violation → Exception Request (create row in DB) → Admin Approval (real-time chat)

**ResumoDriverProjeto (Project-Level Driver Summary):**
- Purpose: Aggregate driver quantities across all systems in budget using global optimization rule (Regra 26)
- Examples: Combines 3 systems with same driver code → calculates single optimal qty instead of sum of individual qtys
- Pattern: `calcularDriversPorProjeto()` groups systems by driver, calculates global power/demand, returns optimized qty
- Impact: Shows savings vs. individual summation in Step3Revisao

## Entry Points

**Web Application Entry:**
- Location: `src/main.tsx` (bootstraps React app)
- Triggers: Page load
- Responsibilities: Mounts `App.tsx` with QueryClient + Router providers

**Auth Router:**
- Location: `src/pages/Auth.tsx`
- Triggers: User not authenticated (redirected by ProtectedRoute in `App.tsx`)
- Responsibilities: Supabase magic link login, password reset flow, error handling

**Main Wizard (Budget Creation):**
- Location: `src/pages/Index.tsx`
- Triggers: POST-auth, user clicks "Novo Orçamento" from client list
- Responsibilities: Orchestrates 3-step flow, holds budget state, manages mode (list/create)

**Admin Dashboard:**
- Location: `src/pages/Admin.tsx`
- Triggers: User has admin role (checked by AdminRoute + useUserRole)
- Responsibilities: Tabs for products, collaborators, budgets, clients, exceptions, imports

**Drive (File Storage):**
- Location: `src/pages/Drive.tsx`
- Triggers: User clicks Drive button from header
- Responsibilities: Cloud file explorer for project documents

**Edge Function (Validation Engine):**
- Location: `supabase/functions/validar-sistema-orcamento/index.ts`
- Triggers: Frontend calls `supabase.functions.invoke("validar-sistema-orcamento", { body })`
- Responsibilities: Server-side validation of lighting systems against hardware rules (28+ validation rules), returns structured errors/alerts/suggestions

## Error Handling

**Strategy:** Client-side toast notifications (sonner) for user feedback; silent network error recovery for edge function calls; form validation before submission.

**Patterns:**
- **Form validation**: Each step checks required fields before `onNext()`, shows error toast if missing
- **Product search errors**: `useProdutoSearch` silently catches Supabase errors, returns empty results
- **Edge function errors**: `useValidarSistemas` catches invoke errors, does not propagate (offline mode gracefully continues)
- **Exception chat errors**: Toast error shown if message send fails or status change fails
- **Database writes**: `handleCriarCliente()`, `handleSalvarOrcamento()` wrap errors in try-catch + toast.error()

## Cross-Cutting Concerns

**Logging:** None (no logger configured; debug via browser console)

**Validation:** Three layers:
1. **Client-side frontend validation**: Form field checks in React components (required fields, type checking)
2. **Client-side domain validation**: Pure function calculations (calcularQtdDrivers checks potencia > 0) 
3. **Server-side validation**: Edge function rules engine (28+ hardware rules for systems, tensão compatibility, profile restrictions)

**Authentication:** 
- Supabase magic link + password reset flow
- Session persistence via localStorage
- Protected routes check `useAuth().user` + `useUserRole().isAdmin`
- Role check queries `user_roles` table for admin status

**Authorization:**
- Route-level: `AdminRoute` wrapper prevents non-admins from accessing `/admin`
- Component-level: `AdminExceptions` checks `useUserRole().isAdmin` to show approve/reject buttons
- Data-level: `useAuth().user.id` filters `price_exceptions` for current user in Step3Revisao

**Real-time Updates:**
- `ExceptionChat`: Subscribes to `exception_messages` via `supabase.channel()` with postgres_changes filter
- Exception status changes broadcast to admin dashboard via subscription
- No optimistic updates; all state refreshed from DB on subscription events

---

*Architecture analysis: 2026-04-16*
