# Technology Stack

**Analysis Date:** 2026-04-23

## Languages

**Primary:**
- TypeScript 5.8.3 - Frontend application and configuration
- JavaScript (Deno) - Supabase Edge Functions runtime

**Secondary:**
- SQL - Supabase PostgreSQL queries via SDK

## Runtime

**Environment:**
- Node.js - No specific version constrained (no .nvmrc file)
- Deno - Edge function runtime (Supabase Functions)

**Package Manager:**
- npm
- Lockfile: package-lock.json (present)

## Frameworks

**Core:**
- React 18.3.1 - UI library
- Vite 5.4.19 - Build tool and dev server (configured on port 8080)
- React Router DOM 6.30.1 - Client-side routing

**UI/Component:**
- shadcn-ui (Radix UI) 1.x - Component library (`src/components/ui/`)
- Tailwind CSS 3.4.17 - Styling framework
- lucide-react 0.462.0 - Icon library

**State Management & Data:**
- TanStack React Query 5.83.0 - Server state management (initialized in `src/App.tsx`)
- Supabase JS SDK 2.95.3 - Backend and authentication

**Forms:**
- React Hook Form 7.61.1 - Form state management
- Zod 3.25.76 - Schema validation
- @hookform/resolvers 3.10.0 - Form resolver for Zod

**Utilities:**
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

**Linting & Type Checking:**
- ESLint 9.32.0 - Code linting with flat config (`eslint.config.js`)
- TypeScript ESLint 8.38.0 - TypeScript linting rules
- @eslint/js 9.32.0 - ESLint base rules
- eslint-plugin-react-hooks 5.2.0 - React Hooks linting
- eslint-plugin-react-refresh 0.4.20 - React Fast Refresh linting

**Testing:**
- Vitest 3.2.4 - Unit test runner
- @testing-library/react 16.0.0 - React component testing utilities
- @testing-library/jest-dom 6.6.0 - Jest-DOM matchers
- jsdom 20.0.3 - DOM simulation for tests

**Build & Compilation:**
- @vitejs/plugin-react-swc 3.11.0 - Vite React plugin using SWC compiler
- autoprefixer 10.4.21 - PostCSS autoprefixer
- postcss 8.5.6 - CSS transformation
- @tailwindcss/typography 0.5.16 - Prose styling plugin
- tailwindcss-animate 1.0.7 - Animation utilities

**Type Definitions:**
- @types/react 18.3.23 - React types
- @types/react-dom 18.3.7 - React DOM types
- @types/node 22.16.5 - Node.js types

## Configuration

**Environment:**
- Vite environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Loaded in `src/integrations/supabase/client.ts` via `import.meta.env`
- LocalStorage used for session persistence

**Build:**
- Vite config: `vite.config.ts` (SWC React plugin, path alias `@` → `./src`)
- TypeScript config: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- PostCSS config: `postcss.config.js` (Tailwind + Autoprefixer)
- Tailwind config: `tailwind.config.ts` (dark mode class, CSS variables for theming)
- ESLint config: `eslint.config.js` (flat config, React Hooks & Refresh rules)

## Database

**Primary:**
- Supabase PostgreSQL (jkewlaezvrbuicmncqbj, region sa-east-1)
- Types auto-generated: `src/integrations/supabase/types.ts`

## Platform Requirements

**Development:**
- Node.js (no specific version enforced)
- Vite dev server runs on `::` (all interfaces) port 8080
- HMR overlay disabled in dev config

**Production:**
- Deployment: Vercel (auraoramentos-kappa.vercel.app)
- Build output: dist/
- Static hosting via Vercel

---

*Stack analysis: 2026-04-23*
