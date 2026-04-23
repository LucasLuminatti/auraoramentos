# Architecture

**Analysis Date:** 2026-04-23

## Pattern Overview

**Overall:** Three-layer client-side architecture with backend integration via Supabase

**Key Characteristics:**
- **Frontend-driven state management:** React components manage local state via useState and pass data through props
- **Direct Supabase integration:** All data queries/mutations go directly to Supabase client (no API layer)
- **TanStack React Query:** Available in dependencies but not actively used for caching (direct Supabase calls dominate)
- **Multi-step form patterns:** Wizard-style flows with step navigation

## Layers

**Presentation Layer:**
- Purpose: UI components rendered to users, form input handling, data visualization
- Location: `src/pages/`, `src/components/`
- Contains: Page components (Index, Auth, Admin, Drive), UI step wizards, data tables, dialogs
- Depends on: React, React Router DOM, shadcn-ui, Tailwind CSS, Lucide icons
- Used by: Browser

**Business Logic / Domain Layer:**
- Purpose: Core calculation functions, data transformation, validation rules for lighting systems
- Location: `src/types/orcamento.ts`
- Contains: Calculation functions for tape demand (metragem), power consumption, driver quantity, roll optimization, price violation detection
- Depends on: TypeScript types, math operations
- Used by: Step3Revisao, PDF generation, Admin components

**Integration Layer:**
- Purpose: Authentication, database queries, real-time subscriptions, file uploads
- Location: `src/integrations/supabase/client.ts`, `src/hooks/useAuth.ts`, `src/hooks/useColaborador.ts`, `src/hooks/useUserRole.ts`
- Contains: Supabase client initialization, auth state management, role checking, auto-create colaborador flow
- Depends on: Supabase client library, localStorage for session persistence
- Used by: All pages and components needing data

## Data Flow

**Budget Creation Wizard (Index → Step1 → Step2 → Step3):**

1. User selects cliente + projeto from ClienteList
2. **Step 1 (Step1DadosOrcamento):** User selects budget type (Primeiro Orçamento, Revisão 01–05)
   - Validates selection, stores in `dados: DadosOrcamento`
   - Sends to Step 2

3. **Step 2 (Step2Ambientes):** User adds rooms/lighting systems
   - Each `Ambiente` can have: `ItemLuminaria[]` (standalone light fixtures) + `SistemaIluminacao[]` (tape+driver+optional profile combinations)
   - Local state: `ambientes: Ambiente[]`
   - Provides button to advance to Step 3

4. **Step 3 (Step3Revisao):** Calculation & review
   - Runs all domain functions: `calcularRolosPorGrupo()`, `calcularDriversPorProjeto()`, `calcularTotalGeral()`
   - Detects price violations (item price < minimum price)
   - If violations exist:
     - User can **adjust price to minimum** (auto-fix) OR
     - **Request exception** via ExceptionChat → saves to `price_exceptions` table
     - Admins approve/reject in AdminExceptions → real-time Supabase subscription notifies Step3Revisao
   - Generates PDF client-side via `gerarPdfHtml()`, saves budget snapshot to `orcamentos` table
   - Downloads PDF to user's machine

**State Management:**
- **Local React state:** Most state stored in component useState (dados, ambientes)
- **Supabase real-time:** Only price_exceptions use subscriptions for approval updates
- **No Redux/Zustand:** Prop drilling used for multi-step navigation

## Key Abstractions

**SistemaIluminacao (Lighting System):**
- Purpose: Represents a complete lighting system combining tape + driver + optional profile rail
- Examples: `src/types/orcamento.ts` interface + `src/components/AmbienteCard.tsx` uses it
- Pattern: Immutable object with calculation functions; updated via component setState

**Ambiente (Room):**
- Purpose: Groups luminarias and systems within a single physical room
- Examples: Created in Step2Ambientes, edited in AmbienteCard
- Pattern: UUID-based, contains arrays of luminarias and systems

**Orcamento (Budget):**
- Purpose: Complete budget document with metadata (colaborador, tipo) + all ambientes
- Examples: Passed to Step3Revisao for final review
- Pattern: Top-level aggregate containing dados + ambientes

**Violacao (Price Violation):**
- Purpose: Represents a single price violation (item below minimum)
- Examples: Detected in Step3Revisao, shown in alerts, can trigger ExceptionChat
- Pattern: Tagged with ambienteId, tipo (luminaria|perfil|fita|driver), and product details

## Entry Points

**`src/main.tsx`:**
- Location: `src/main.tsx`
- Triggers: Script executed by browser at app startup
- Responsibilities: Mounts React app to DOM element #root

**`src/App.tsx`:**
- Location: `src/App.tsx`
- Triggers: Loaded by main.tsx
- Responsibilities: 
  - Initializes TanStack React Query client
  - Wraps app with QueryClientProvider, TooltipProvider, toast providers
  - Defines ProtectedRoute (requires auth) and AdminRoute (requires admin role)
  - Maps all routes: /auth, /forgot-password, /reset-password, /request-access, /, /admin, /admin/upload-imagens, /drive

**`src/pages/Auth.tsx`:**
- Location: `src/pages/Auth.tsx`
- Triggers: When user navigates to /auth or logs out
- Responsibilities: 
  - Login: Supabase.auth.signInWithPassword
  - Signup: Checks allowed_users table, validates password strength, creates account if approved
  - Renders password strength meter, validation rules

**`src/pages/Index.tsx`:**
- Location: `src/pages/Index.tsx`
- Triggers: When authenticated user navigates to /
- Responsibilities:
  - Shows ClienteList (mode="list") — list of all clientes, projetos, orcamentos with operations
  - Transitions to budget wizard (mode="create") — 3-step form
  - Routes between step components based on step state
  - Handles logo click to return to list (with unsaved data warning)

**`src/pages/Admin.tsx`:**
- Location: `src/pages/Admin.tsx`
- Triggers: When admin user navigates to /admin (blocked by AdminRoute)
- Responsibilities:
  - Tabs: Produtos (search), Colaboradores, Orcamentos, Clientes, Exceções
  - Import functionality (CSV) for produtos, preços, imagens
  - Price exception review (AdminExceptions component)

**`src/pages/Drive.tsx`:**
- Location: `src/pages/Drive.tsx`
- Triggers: When user clicks "Drive" button or navigates to /drive
- Responsibilities: Cloud file explorer (DriveExplorer) for projeto/cliente document storage

## Error Handling

**Strategy:** Toast notifications (Sonner library) for all user-facing errors

**Patterns:**
- Supabase query failures → `toast.error("Erro ao...")` with optional error.message
- Validation failures → `toast.error()` with specific validation message
- Success operations → `toast.success("Ação concluída")`
- No try-catch blocks; errors rely on Supabase SDK returning error objects

## Cross-Cutting Concerns

**Logging:** 
- Console.error() used in useColaborador for debugging auto-create failures
- No structured logging framework; no production error tracking

**Validation:** 
- Password strength rules enforced in Auth.tsx (8 chars, uppercase, lowercase, number, special)
- Budget type selection required in Step1DadosOrcamento
- At least one ambiente required in Step2Ambientes
- Price violations detected in Step3Revisao (item price < minimum)
- Edge function `validar-sistema-orcamento` validates system calculations server-side

**Authentication:** 
- Supabase Auth handles session management (localStorage, auto-refresh)
- Allowed-users gate during signup: `allowed_users` table must contain email
- Role-based access: `user_roles` table (role='admin') checked by useUserRole hook
- Colaborador auto-created on first login via `create-colaborador` edge function

---

*Architecture analysis: 2026-04-23*
