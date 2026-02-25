# WhiteLabelIntake — Codebase Conventions

> AI-enforced rules. Follow these exactly when modifying this codebase.
> For full architectural context, see `docs/ARCHITECTURE.md`.

## Tech Stack (DO NOT change without discussion)

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Prisma 6.x (NOT v7 — v7 has breaking schema changes requiring prisma.config.ts)
- Auth.js (next-auth@beta), JWT strategy, Credentials provider
- Supabase PostgreSQL + file storage
- Zod validation, bcryptjs password hashing, AES-256-GCM field encryption

## Project Structure

```
src/
├── app/(auth)/              # Login, register
├── app/(form)/onboarding/   # Main onboarding page — loads ALL data, renders OnboardingClient
├── app/(admin)/admin/       # Super-admin portal
├── app/(dashboard)/         # User dashboard
├── app/api/                 # Auth routes, file upload, signed URLs
├── components/ui/           # Shared UI primitives (Button, Input, Card, Select, Checkbox, etc.)
├── components/form/         # OnboardingClient orchestrator, nav components, section forms
├── components/admin/        # Admin views (AffiliateDetailView, lists, create form)
├── components/marketplace/  # Network builder map & list views
├── lib/actions/             # Server actions — one file per section + helpers
├── lib/validations/         # Zod schemas — one file per section
├── lib/contexts/            # CompletionContext, AdminFormContext
├── lib/hooks/               # useSaveOnNext
├── types/index.ts           # Section IDs, types, SECTIONS/SELLER_SECTIONS arrays, prerequisites
└── middleware.ts            # Edge auth via getToken (NOT auth wrapper)
```

## Rules: Adding or Modifying a Section

### Form Component (`src/components/form/sections/`)

- Affiliate naming: `SectionXForm.tsx`. Seller naming: `Seller{Name}Form.tsx`
- MUST use `useSaveOnNext` hook from `@/lib/hooks/useSaveOnNext` — never inline save logic
- MUST call `useReportDirty(sectionId, isDirty)` for nav dirty tracking
- Affiliate forms: call `useSyncSectionCache(sectionId, data)` for client cache on unmount
- Seller forms: call `useSellerCacheUpdater()` and update cache on save only (not unmount)
- MUST use shared nav buttons — `SectionNavButtons` (affiliate) or `SellerSectionNavButtons` (seller)
- NEVER inline prev/next nav buttons — always use the shared component
- NEVER import `flushSync` directly in forms — the nav component handles it
- Wrap related fields in `<Card>` groups; use `src/components/ui/` components (Input, Select, etc.)
- Pass `disabled` prop through to all inputs for admin/locked state
- Get admin context via `useAdminForm()` — if editing, route saves to `save*ForAffiliate()` actions
- Get completion context via `useCompletion()` — pass `updateStatuses` to `useSaveOnNext`

### Validation Schema (`src/lib/validations/`)

- One file per section: `sectionX.ts` (affiliate) or `seller-{name}.ts` (seller)
- Export Zod schema AND inferred type: `export type SectionXData = z.infer<typeof schema>`
- All fields `.optional()` to allow partial saves (completion logic is separate)
- Email pattern: `.email().optional().or(z.literal(""))`
- Export constants (SERVICE_TYPES, SELLER_SERVICE_TYPES, etc.) from the relevant schema file

### Server Action (`src/lib/actions/`)

- One file per section: `sectionX.ts` (affiliate) or `seller-{name}.ts` (seller)
- Every save action follows this 5-step pattern:
  1. `const ctx = await getSessionContext()` — auth gate
  2. `await assertNotSubmitted(ctx.affiliateId)` — submission lock (affiliate only)
  3. `schema.parse(data)` — Zod validation
  4. Prisma write (update, upsert, or transaction)
  5. `await writeSectionSnapshot(sectionId, data, ctx.userId, ctx.affiliateId, ctx.programId)`
- Affiliate actions return `getCompletionStatuses(ctx.affiliateId)`
- Seller actions return `computeSellerStatuses(ctx.affiliateId)`
- Encrypted fields (ACH numbers): use `encryptField()` on write, `decryptField()` on load
- Snapshot IDs: affiliate sections use their section number (1-9, 11); seller sections use 100-106

### Type Definitions (`src/types/index.ts`)

- Affiliate section IDs: numeric `SectionId = 1 | 2 | 3 | ... | 10`
- Seller section IDs: string `SellerSectionId = "S-1" | "S-2" | ... | "S-R"`
- Add new sections to `SECTIONS` or `SELLER_SECTIONS` array — order matters (drives nav rendering)
- Update the relevant union type when adding sections
- Add prerequisites to `SECTION_PREREQUISITES` if the new section depends on others
- Update `AllSectionData` (affiliate) or `SellerFlowData` (seller) interface

### OnboardingClient Integration

- Import new form component in `OnboardingClient.tsx`
- Add case to `renderAffiliateSection()` or `renderSellerSection()` switch
- Add data key to `AllSectionData` or `SellerFlowData` interface
- Load data in `src/app/(form)/onboarding/page.tsx` via the section's `loadSection*()` action
- Add to the `Promise.all` data-loading block in `loadAllOnboardingData()` or `loadOnboardingDataByAffiliateId()`

## Rules: Navigation & Save Flow

- Save orchestration lives in `SectionNavButtons` / `SellerSectionNavButtons`
- These call `useSaving()` → `LoadingOverlay` during save
- `flushSync` after save ensures dirty flags clear before unmount
- Previous = navigate only (no save). Next = save then navigate
- Save failure → logs error, still navigates (data persists in client cache)
- Affiliate nav: phase-grouped, collapsible, prerequisite-locked, submitted-phase-locked
- Seller nav: flat list, no prerequisites, locked only when entire flow is SUBMITTED

## Rules: UI Components

- Always use `src/components/ui/` components — never raw HTML inputs
- `<Button variant="cta">` for primary actions, `variant="secondary"` for secondary
- `<Card>` for grouping related fields (white bg, border, shadow, rounded corners)
- `<FileUpload>` for document uploads (W-9, bank docs) — uses Supabase storage
- `<CSVUploadButton>` for bulk imports with Zod validation and dedup
- `<ServiceToggles>` for service/sub-service selection UI
- Tailwind v4: use `@theme inline {}` in globals.css, NOT tailwind.config.js
- Theme tokens: `--color-brand-teal`, `--color-brand-black`, `--radius-card`, `--shadow-card`, etc.

## Rules: Database & Prisma

- Prisma 6.x only — v7 has breaking schema changes
- `.env` and `.env.local` must both exist with same DB values (Prisma reads `.env`, Next reads `.env.local`)
- Supabase pooler host: `aws-1-us-east-2.pooler.supabase.com`
- Port 6543 (transaction/runtime) with `?pgbouncer=true`, port 5432 (session/migrations)
- Two-tier entity model: operations-scoped (`affiliateId`) vs program-scoped (`programId`)
- Seller entities are affiliate-scoped but use separate tables (SellerProfile, SellerLocation, etc.)
- `SectionSnapshot` stores immutable JSON audit trail per section per user
- Sensitive fields (ACH numbers) use AES-256-GCM encryption via `src/lib/encryption.ts`
- `writeSectionSnapshot` data param is `Prisma.InputJsonValue`, not `Record<string, unknown>`

## Rules: Authentication & Authorization

- Auth.js with Credentials provider REQUIRES `strategy: "jwt"` — database sessions cause UnsupportedStrategy error
- Middleware: `getToken` from `next-auth/jwt` (NOT `auth` wrapper — too heavy for Edge, pulls in Prisma+bcrypt)
- Cookie name on HTTPS: `__Secure-authjs.session-token` — must pass `cookieName` to `getToken()`
- Roles: `SUPER_ADMIN` → `/admin`, `ADMIN`/`COLLABORATOR` → `/onboarding`
- Server actions use `getSessionContext()` which calls `auth()` — only middleware uses `getToken`

## Rules: Deployment (Vercel)

- Project: `hop-aboard` in `joes-projects-48865212` scope
- URL: https://hop-aboard.vercel.app
- Deploy: `vercel --prod` from project root
- Build script: `prisma generate && next build`
- Both `AUTH_SECRET` and `NEXTAUTH_SECRET` env vars required (Auth.js v5 uses AUTH_SECRET, getToken uses NEXTAUTH_SECRET)
- `AUTH_TRUST_HOST=true` required for Vercel proxy
- Env vars: use `printf` not `echo` to avoid trailing newlines with `vercel env add`
- `FIELD_ENCRYPTION_KEY`: 64 hex chars for AES-256-GCM

## Rules: Common Patterns

- Auto-save: debounced via `useSaveOnNext` hook (saves on "Next" click, not on keystroke)
- Completion status: computed server-side by checking required fields per section
- Phase-based submission (affiliate): phases can be submitted independently, locked after submission
- Flow-based submission (seller): entire flow submitted at once via `submitSellerFlow()`
- Admin unlock: super-admin can unlock submitted phases/flows for re-editing
- Dual-role orgs: `isAffiliate` + `isSeller` flags on Affiliate model; tab bar switches flows in UI
- Client-side tab navigation: all sections loaded via `Promise.all` in server page, switched client-side
