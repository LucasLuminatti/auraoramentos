# External Integrations

**Analysis Date:** 2026-04-16

## APIs & External Services

**Supabase (Primary Backend):**
- **Service:** Supabase (supabase.com) - Full-stack backend platform
- **What it's used for:** Authentication, database, real-time subscriptions, file storage, edge functions
- **SDK/Client:** @supabase/supabase-js 2.95.3
- **Client location:** `src/integrations/supabase/client.ts` (auto-generated)
- **Auth:** Environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Data Storage

**Databases:**
- **Type/Provider:** PostgreSQL (hosted via Supabase)
- **Connection:** Via Supabase client in `src/integrations/supabase/client.ts`
  - Auth storage: localStorage (configured for session persistence and auto-refresh)
  - Typed via auto-generated `src/integrations/supabase/types.ts`
- **Client:** @supabase/supabase-js (JavaScript client, no ORM in frontend)
- **Query patterns:**
  - Direct `.from(table).select()` queries in components (e.g., `useUserRole.ts`)
  - Real-time subscriptions via `.channel()` and `.subscribe()` (e.g., `Step3Revisao.tsx`)
  - Realtime updates for price exceptions in `Step3Revisao.tsx` lines 125-138

**Tables in use (identified from codebase):**
- `user_roles` - User permission matrix (admin checks)
- `price_exceptions` - Price negotiation requests and approval tracking
- `colaboradores` - Collaborator profiles and metadata
- `produtos` - Product catalog (LED tapes, drivers, profiles)
- `cliente_arquivos` - Client file attachments and metadata
- `orcamentos` - Budget/quote records
- (Additional tables auto-generated in `src/integrations/supabase/types.ts`)

**File Storage:**
- **Buckets:**
  - `cliente-arquivos` - Client project documents and attachments
    - Managed via `supabase.storage.from("cliente-arquivos")`
    - Referenced in `src/components/DriveExplorer.tsx`, `src/components/ClienteArquivos.tsx`
  - `produto-imagens` - Product images (LED tapes, drivers, profiles)
    - Managed via `supabase.storage.from("produto-imagens")`
    - Referenced in `src/components/ImportImagens.tsx`
- **Upload/Download:** Via Supabase Storage API (`.upload()`, `.remove()`, `.getPublicUrl()`)

**Caching:**
- TanStack React Query (in-memory client-side caching)
  - Not currently being used for Supabase queries (direct calls instead)
  - Configured in `src/App.tsx` but no QueryClient hooks observed in data fetching

## Authentication & Identity

**Auth Provider:**
- **Service:** Supabase Auth (built-in)
- **Implementation:** Email/password authentication
  - Session management via `supabase.auth.onAuthStateChange()` (real-time listener)
  - Auto-refresh token enabled in client config
  - Logout via `supabase.auth.signOut()`
- **Hook:** `src/hooks/useAuth.ts`
  - Returns: `user`, `session`, `loading`, `signOut` function
  - Subscribes to auth state changes and persists via localStorage

**Authorization:**
- Role-based access control (RBAC) via `user_roles` table
- Admin check in `src/hooks/useUserRole.ts` - queries `user_roles` table for "admin" role
- Protected routes in `src/App.tsx`:
  - `/auth` - Public (Auth page)
  - `/` - Protected (ProtectedRoute HOC)
  - `/admin` - Admin-only (AdminRoute HOC)
  - `/admin/upload-imagens` - Admin-only
  - `/drive` - Protected

## Monitoring & Observability

**Error Tracking:**
- Not detected - No error tracking service (Sentry, LogRocket, etc.)

**Logs:**
- Client-side: Sonner toast notifications for user-facing events
  - Success/error messages in `Step3Revisao.tsx` (lines 132-136)
- Server-side: Edge Functions (Deno) - standard stdout/stderr logging
  - No dedicated logging service

**Real-time Debugging:**
- Supabase client logs available via browser DevTools
- Redux DevTools or similar: Not detected

## CI/CD & Deployment

**Hosting:**
- Frontend: Not specified (likely Vercel, Netlify, or similar static host)
- Backend: Supabase hosted cloud platform
  - Region: Inferred from project ID `qirsfbypqfeobcnkgspk` (default region may be US-East)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or similar found

**Build Process:**
- Build command: `npm run build` (runs `vite build`)
- Dev command: `npm run dev` (runs `vite`)
- Output: Static SPA (single-page application)

## Environment Configuration

**Required env vars:**
```
VITE_SUPABASE_URL=https://qirsfbypqfeobcnkgspk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<pk_live_...>
```

**Secrets location:**
- `.env` file (present at project root)
- **WARNING:** Never commit `.env` - use `.gitignore`

## Webhooks & Callbacks

**Incoming:**
- Real-time database triggers via Supabase (`postgres_changes` events)
  - Price exception approvals/rejections in `Step3Revisao.tsx` (lines 126-138)
  - Channel subscription: `supabase.channel("step3-exceptions")`

**Outgoing:**
- Supabase Edge Functions (server-side business logic):
  - `supabase/functions/validar-sistema-orcamento/` - System validation logic (~506 lines)
    - Input: System configuration (tape, driver, profile, tension)
    - Output: Validation errors, alerts, suggestions
  - `supabase/functions/create-colaborador/` - Collaborator creation
  - `supabase/functions/import-precos/` - Price import batch processing
  - `supabase/functions/import-produtos/` - Product import batch processing
  - `supabase/functions/request-access/` - Access request workflow
  - `supabase/functions/review-access/` - Access request review and approval

## External Data Sources

**Product Catalog:**
- Imported via Admin dashboard (`AdminProductos.tsx`)
- Source: Excel/CSV files uploaded by admins
- Processing: `supabase/functions/import-produtos/`

**Product Images:**
- Uploaded to `produto-imagens` bucket
- Processing: `supabase/functions/import-imagens/` (implied)

**Pricing Data:**
- Imported via Admin dashboard (`AdminPrecos.tsx`)
- Source: Excel/CSV files uploaded by admins
- Processing: `supabase/functions/import-precos/`

## Client-Side Libraries for Integration

**Form Submission:**
- React Hook Form + Zod for validation
- Direct Supabase API calls in event handlers (no centralized API layer)

**Realtime Subscriptions:**
- Supabase Realtime (`WebSocket`)
  - Price exception status changes streamed to clients
  - ~50ms latency for exception approvals

**PDF Export:**
- html2pdf.js (converts DOM to PDF client-side)
- Budget PDFs generated without server involvement
- Images converted to base64 before PDF embedding (see `imageToBase64` in `Step3Revisao.tsx`)

---

*Integration audit: 2026-04-16*
