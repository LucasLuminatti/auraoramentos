# Technology Stack

**Analysis Date:** 2026-04-16

## Languages

**Primary:**
- TypeScript 5.8.3 - Frontend (React components, hooks) e backend (Deno edge functions)
- JavaScript - Build configuration (Vite)

## Runtime

**Environment:**
- Node.js (implied by npm and Vite)
- Deno (Supabase Edge Functions runtime)

**Package Manager:**
- npm - Primary package manager
- Lockfile: Not detected in this analysis (likely `package-lock.json` present)

## Frameworks

**Core:**
- React 18.3.1 - UI framework and component library
- Vite 5.4.19 - Build tool and dev server
- React Router DOM 6.30.1 - Client-side routing

**State & Data:**
- TanStack React Query 5.83.0 - Server state management, caching, synchronization
  - Configured in `src/App.tsx` via `QueryClientProvider`
- React Hook Form 7.61.1 - Form state management
- Zod 3.25.76 - Runtime type validation and schema parsing

**UI Components:**
- shadcn/ui (Radix UI primitives) - Pre-built accessible component library
  - 27+ Radix UI packages (@radix-ui/react-*)
  - Components live in `src/components/ui/`
  - Styling via Tailwind CSS classes

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- Tailwind CSS Typography 0.5.16 - Typography plugin
- tailwindcss-animate 1.0.7 - Animation utilities
- class-variance-authority 0.7.1 - Component variant management
- clsx 2.1.1 - Conditional class names
- tailwind-merge 2.6.0 - Merge Tailwind classes without conflicts

**UI Utilities:**
- Sonner 1.7.4 - Toast notifications (alternative to default toaster)
- Lucide React 0.462.0 - Icon library (466+ icons available)
- Embla Carousel React 8.6.0 - Carousel/slider component
- React Resizable Panels 2.1.9 - Resizable panel layout
- React Day Picker 8.10.1 - Date picker component
- Recharts 2.15.4 - Charts and data visualization library
- cmdk 1.1.1 - Command/search palette component
- Vaul 0.9.9 - Drawer component

**Testing:**
- Vitest 3.2.4 - Unit test runner (Vite-native)
- @testing-library/react 16.0.0 - React component testing utilities
- @testing-library/jest-dom 6.6.0 - DOM matchers
- jsdom 20.0.3 - DOM environment for tests

**PDF Generation:**
- html2pdf.js 0.14.0 - Client-side HTML to PDF conversion
  - Dynamically imported in `src/components/Step3Revisao.tsx`
  - Renders React-generated HTML to PDF with jsPDF backend

**Spreadsheet/Data Export:**
- xlsx 0.18.5 - Excel file reading/writing (SheetJS)

**Authentication & Identity:**
- @supabase/supabase-js 2.95.3 - Supabase client SDK
  - Handles auth (email/password, MFA support)
  - Real-time subscriptions via WebSocket (`channel` API)
  - PostgreSQL database queries
  - File storage API

**Utilities:**
- date-fns 3.6.0 - Date manipulation and formatting
- input-otp 1.4.2 - One-time password input component
- next-themes 0.3.0 - Theme provider (dark/light mode)
- @hookform/resolvers 3.10.0 - Form validation adapters for Zod

**Build & Development:**
- @vitejs/plugin-react-swc 3.11.0 - Vite React plugin (SWC transpiler)
- autoprefixer 10.4.21 - PostCSS plugin for vendor prefixes
- postcss 8.5.6 - CSS transformation tool (required by Tailwind)
- TypeScript 5.8.3 - Type checking
- ESLint 9.32.0 - Code linting
  - @eslint/js 9.32.0 - ESLint base configuration
  - eslint-plugin-react-hooks 5.2.0 - React hooks linting rules
  - eslint-plugin-react-refresh 0.4.20 - Vite refresh linting
  - typescript-eslint 8.38.0 - TypeScript support for ESLint
- @types/react 18.3.23 - React type definitions
- @types/react-dom 18.3.7 - React DOM type definitions
- @types/node 22.16.5 - Node.js type definitions
- globals 15.15.0 - Global type definitions

## Configuration

**Environment:**
- Vite environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Loaded from `.env` file at runtime
  - Accessed via `import.meta.env.VITE_*` in client code

**Build Configuration:**
- `vite.config.ts` - Vite configuration
  - Dev server: `::` (IPv6), port `8080`
  - HMR overlay disabled
  - Path alias: `@/` → `src/`
  - SWC transpiler plugin enabled

- `vitest.config.ts` - Test configuration
  - Environment: jsdom
  - Globals enabled
  - Setup file: `src/test/setup.ts`
  - Pattern: `src/**/*.{test,spec}.{ts,tsx}`

- `tsconfig.json` - TypeScript configuration
  - Path alias: `@/*` → `src/*`
  - Relaxed settings (allowJs, noImplicitAny false, strictNullChecks false)
  - skipLibCheck enabled

- `tsconfig.app.json` - App-specific TS config (referenced by tsconfig.json)
- `tsconfig.node.json` - Node-specific TS config (referenced by tsconfig.json)

- `.eslintrc.js` - ESLint configuration

**Supabase:**
- Project ID: `qirsfbypqfeobcnkgspk` (in `supabase/config.toml`)
- Edge Functions runtime: Deno
- Database: PostgreSQL
- Auth: Built-in Supabase Auth (email/password, session management)

## Platform Requirements

**Development:**
- Node.js (version not specified, likely 18+)
- npm package manager
- Git
- Web browser with modern ES2020+ support

**Production:**
- Vercel, Netlify, or any static hosting for the compiled SPA
- Supabase hosted backend (PostgreSQL, Auth, Storage, Edge Functions)
- Browser: Chrome, Firefox, Safari, Edge (modern versions)

---

*Stack analysis: 2026-04-16*
