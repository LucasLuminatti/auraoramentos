# External Integrations

**Analysis Date:** 2026-04-23

## APIs & External Services

**Email Service:**
- Resend - Email provider for onboarding and approval notifications
  - SDK/Client: npm package `resend@2.0.0` (used in Edge Functions)
  - Auth: `RESEND_API_KEY` (stored as Supabase secret)
  - Sender email: `noreply@orcamentosaura.com.br` (custom domain via Registro.br)
  - Domain configuration: DKIM, SPF, DMARC configured at domain registrar

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Project ID: `jkewlaezvrbuicmncqbj`
  - Region: sa-east-1
  - Connection: Auto-configured via Supabase client in `src/integrations/supabase/client.ts`
  - Client: @supabase/supabase-js v2.95.3
  - Auto-generated types: `src/integrations/supabase/types.ts`

**File Storage:**
- Supabase Storage buckets - Client/project document storage (accessed via `Drive.tsx` page)
- Local filesystem only for exports (PDF generation via html2pdf.js, Excel via xlsx)

**Caching:**
- TanStack React Query - Server state caching (QueryClient initialized in `src/App.tsx`)
- No Redis or external cache layer

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in)
  - Implementation: Email/password via Supabase SDK
  - Session storage: localStorage with persistent session
  - Auto-refresh: Token auto-refresh enabled
  - Role-based access: `useUserRole()` hook checks admin vs. collaborator roles
  - Access control via `allowed_users` and `access_requests` tables

**Access Control Flow:**
1. User requests access via `/request-access` page
2. `request-access` Edge Function validates and stores in `access_requests` table
3. Admin approves/rejects via `review-access` Edge Function (verify_jwt=false)
4. Approved users added to `allowed_users` table and can signup via `/auth?mode=signup`

## Webhooks & Callbacks

**Incoming:**
- None - Supabase Auth redirects handled client-side

**Outgoing:**
- Email notifications via Resend:
  - New access requests → admin email
  - Access approval confirmation → requester email
  - Access rejection notice → requester email
  - Managed in `supabase/functions/request-access/index.ts` and `supabase/functions/review-access/index.ts`

## Edge Functions

Supabase Edge Functions (Deno runtime, TypeScript):

**1. validar-sistema-orcamento**
- Location: `supabase/functions/validar-sistema-orcamento/index.ts`
- Purpose: Validates lighting systems (fita, driver, perfil compatibility)
- Input: Array of lighting system items with specifications
- Output: Validation results (errors, alerts, suggestions)
- Dependencies: Supabase client (reads `regras_compatibilidade_perfil` table)
- No JWT verification (public endpoint)

**2. create-colaborador**
- Location: `supabase/functions/create-colaborador/index.ts`
- Purpose: Auto-creates collaborator record when user signs up
- Triggered by: `useColaborador()` hook in `src/hooks/useColaborador.ts`
- Input: nome, cargo, departamento, user_id
- Output: Created record from `colaboradores` table
- Uses: SERVICE_ROLE_KEY for admin access
- JWT verification: Required (implicit)

**3. request-access**
- Location: `supabase/functions/request-access/index.ts`
- Purpose: Handles new access requests from public users
- Input: name, email
- Flow:
  1. Validates against existing requests
  2. Inserts into `access_requests` table
  3. Generates HMAC-signed approval link (24h expiry)
  4. Emails admin with approve/reject links
- Email template: styled HTML with approve/reject CTAs
- JWT verification: false (public endpoint, verify_jwt=false in config)

**4. review-access**
- Location: `supabase/functions/review-access/index.ts`
- Purpose: Processes admin approval/rejection of access requests
- Input: action (approve/reject), requestId, token (HMAC signed)
- Flow:
  1. Verifies HMAC signature (prevents tampering)
  2. Checks token expiry (24h)
  3. Updates `access_requests` status (APPROVED/REJECTED)
  4. If approved: adds to `allowed_users` table
  5. Sends email to requester
- Returns: HTML page with status (cannot re-process approved/rejected requests)
- JWT verification: false (allow clickthrough from email, verify_jwt=false in config)

**5. import-precos**
- Location: `supabase/functions/import-precos/index.ts`
- Purpose: Bulk import product pricing (admin only)
- Triggered by: `ImportPrecos.tsx` component
- Input: Excel file (multipart/form-data) with price updates
- Parses and upserts into pricing tables
- JWT verification: Required

**6. import-produtos**
- Location: `supabase/functions/import-produtos/index.ts`
- Purpose: Bulk import product catalog (admin only)
- Triggered by: `ImportProdutos.tsx` component
- Input: Excel file with product data
- Parses and upserts into product tables
- JWT verification: Required

## Environment Configuration

**Required frontend env vars (.env.local or via Vercel):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key

**Required Edge Function secrets (set in Supabase dashboard):**
- `RESEND_API_KEY` - API key for Resend email service
- `ADMIN_EMAIL` - Admin email for access request notifications
- `APPROVAL_TOKEN_SECRET` - Secret for HMAC-signing approval tokens
- `SUPABASE_URL` - Supabase project URL (auto-provided by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations (auto-provided)
- `APP_URL` - Frontend URL (defaults to https://auraoramentos-kappa.vercel.app)

**Secrets location:**
- Environment variables: Vercel project settings (production) or .env.local (development)
- Edge Function secrets: Supabase project dashboard → Settings → Functions

## Deployment & Hosting

**Frontend:**
- Vercel (auraoramentos-kappa.vercel.app)
- Deployed from: https://github.com/LucasLuminatti/auraoramentos (main branch)
- Built with: `vite build` → dist/ → Vercel static hosting

**Backend:**
- Supabase Edge Functions
- Deno runtime, deployed via `supabase functions deploy` CLI
- Environment: Supabase managed environment (sa-east-1)

## CI/CD

**Pipeline:**
- No automated CI/CD detected in config (manual deployment)
- Vercel auto-deploys from GitHub main branch (if connected)
- Edge Functions deployed via Supabase CLI manually

---

*Integration audit: 2026-04-23*
