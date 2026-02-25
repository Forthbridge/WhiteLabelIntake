# WhiteLabelIntake Architecture

## Overview

WhiteLabelIntake is a white-label onboarding platform for health plans. Organizations complete a multi-section intake form to configure their program, care network, billing, and operational details.

The app supports two parallel flows:

- **Affiliate Flow** (Plan Buyer): 10 sections covering program setup, services, network, billing, and care navigation. Phase-based submission with prerequisite locking.
- **Seller Flow** (Care Delivery): 7 sections covering organization info, services, locations, providers, lab network, and billing. Single-submission model.

Dual-role organizations (both affiliate and seller) see a tab bar to switch between flows. Each flow has independent state, navigation, and submission.

**Live URL**: https://hop-aboard.vercel.app

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.x | App Router, server actions, API routes |
| TypeScript | 5.x | Type safety throughout |
| Tailwind CSS | v4 | Styling via `@theme inline {}` in globals.css |
| Prisma | 6.x | ORM (NOT v7 — breaking schema changes) |
| Supabase | — | PostgreSQL database + file storage |
| Auth.js | next-auth@beta | Authentication with Credentials provider + JWT strategy |
| Zod | — | Runtime validation for all form data |
| bcryptjs | — | Password hashing |
| Node.js crypto | — | AES-256-GCM field encryption for sensitive data |
| Mapbox GL | — | Network builder map visualization |
| Vercel | — | Hosting and deployment |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx                     # Email/password login
│   │   └── register/page.tsx                  # Self-registration with auto sign-in
│   ├── (form)/onboarding/
│   │   ├── page.tsx                           # Server page: loads ALL data via Promise.all
│   │   ├── layout.tsx                         # Onboarding layout wrapper
│   │   ├── review/page.tsx                    # Legacy review route
│   │   └── section/[id]/page.tsx              # Legacy per-section route
│   ├── (admin)/admin/
│   │   ├── page.tsx                           # Affiliate list
│   │   ├── users/page.tsx                     # User management
│   │   ├── create-client/page.tsx             # Create new affiliate
│   │   └── affiliates/[affiliateId]/
│   │       ├── page.tsx                       # Affiliate detail view
│   │       └── edit/page.tsx                  # Admin edit (wraps OnboardingClient in AdminFormProvider)
│   ├── (dashboard)/dashboard/page.tsx         # User dashboard
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts        # Auth.js handler
│   │   ├── auth/register/route.ts             # Registration endpoint
│   │   └── upload/                            # File upload, signed URLs, delete
│   ├── layout.tsx                             # Root layout
│   ├── globals.css                            # Tailwind v4 @theme inline + custom styles
│   └── page.tsx                               # Home/landing redirect
├── components/
│   ├── ui/                                    # Shared primitives
│   │   ├── Button.tsx                         # variant: cta | secondary | primary
│   │   ├── Input.tsx                          # label, helperText, error, required
│   │   ├── Card.tsx                           # White card with border, shadow, rounded
│   │   ├── Select.tsx                         # Dropdown with label, options array
│   │   ├── Checkbox.tsx                       # Inline checkbox with label
│   │   ├── RadioGroup.tsx                     # Boxed radio options with descriptions
│   │   ├── Textarea.tsx                       # Multi-line input
│   │   ├── FileUpload.tsx                     # Supabase-backed upload (W-9, bank docs)
│   │   ├── CSVUploadButton.tsx                # Bulk import with Zod validation, dedup, preview
│   │   ├── LoadingOverlay.tsx                 # Full-screen saving overlay
│   │   ├── ServiceToggles.tsx                 # Service/sub-service selection grids
│   │   └── SubServiceModal.tsx                # Modal for sub-service configuration
│   ├── form/
│   │   ├── OnboardingClient.tsx               # Client-side orchestrator (see below)
│   │   ├── SectionNav.tsx                     # Affiliate sidebar nav (phase-grouped)
│   │   ├── SellerSectionNav.tsx               # Seller sidebar nav (flat list)
│   │   ├── SectionNavButtons.tsx              # Affiliate prev/next with save
│   │   ├── SellerSectionNavButtons.tsx        # Seller prev/next with save
│   │   ├── PrerequisiteBanner.tsx             # Unmet prerequisite warning
│   │   ├── FormShell.tsx                      # Legacy layout wrapper
│   │   └── sections/                          # All form section components
│   │       ├── Section1Form.tsx               # Client & Program Overview
│   │       ├── Section2Form.tsx               # Default Program Services
│   │       ├── Section3Form.tsx               # In-Person & Extended Services
│   │       ├── Section4Form.tsx               # Payouts & Payments
│   │       ├── Section5Form.tsx               # Care Network (locations)
│   │       ├── Section9Form.tsx               # Care Navigation
│   │       ├── Section11Form.tsx              # Sub-Services configuration
│   │       ├── Section12Form.tsx              # Additional/Legacy
│   │       ├── ReviewForm.tsx                 # Affiliate review & submit
│   │       ├── NetworkBuilderForm.tsx         # Map-based network visualization
│   │       ├── SellerOrgInfoForm.tsx          # S-1: Organization Info
│   │       ├── SellerServicesForm.tsx          # S-4: Default Services
│   │       ├── SellerLocationsForm.tsx         # S-2: Physical Locations
│   │       ├── SellerProvidersForm.tsx         # S-3: Providers & Credentials
│   │       ├── SellerLabForm.tsx               # S-5: Lab Network
│   │       ├── SellerBillingForm.tsx           # S-6: Billing Setup
│   │       └── SellerReviewForm.tsx            # S-R: Review & Submit
│   ├── admin/                                 # Admin portal components
│   ├── dashboard/                             # User dashboard components
│   └── marketplace/                           # Network builder map/list views
├── lib/
│   ├── actions/                               # Server actions (one per section)
│   │   ├── helpers.ts                         # getSessionContext, assertNotSubmitted, writeSectionSnapshot
│   │   ├── completion.ts                      # getCompletionStatuses (affiliate)
│   │   ├── onboarding.ts                      # loadAllOnboardingData orchestrator
│   │   ├── submit.ts                          # submitForm, submitPhase (affiliate)
│   │   ├── section1.ts ... section12.ts       # Affiliate section load/save
│   │   ├── seller-org.ts                      # Seller org + computeSellerStatuses
│   │   ├── seller-services.ts                 # Seller service offerings
│   │   ├── seller-locations.ts                # Seller location CRUD
│   │   ├── seller-providers.ts                # Seller provider CRUD
│   │   ├── seller-billing.ts                  # Seller billing (encrypted ACH)
│   │   ├── seller-lab.ts                      # Seller lab network
│   │   ├── seller-submit.ts                   # submitSellerFlow
│   │   ├── seller-org-sub-services.ts         # Per-location sub-service defaults
│   │   ├── admin.ts, admin-sections.ts        # Admin-only operations
│   │   ├── history.ts                         # Snapshot history & rollback
│   │   ├── collaborator.ts                    # Multi-user collaborator management
│   │   ├── network.ts                         # Network contract management
│   │   └── location-services.ts               # Location-service state
│   ├── validations/                           # Zod schemas (one per section)
│   ├── contexts/
│   │   ├── CompletionContext.tsx               # Completion statuses, phase info, lock logic
│   │   └── AdminFormContext.tsx                # Admin editing mode detection
│   ├── hooks/
│   │   └── useSaveOnNext.ts                   # Save-on-navigation hook
│   ├── auth.ts                                # Auth.js configuration
│   ├── encryption.ts                          # AES-256-GCM encrypt/decrypt
│   ├── prisma.ts                              # Prisma client singleton
│   └── supabase/                              # Supabase client helpers
├── types/
│   ├── index.ts                               # Core types, section arrays, prerequisites
│   └── next-auth.d.ts                         # Session type augmentation
└── middleware.ts                              # Edge auth with getToken
```

---

## Data Model

### Two-Tier Entity Design

**Operations-scoped** (keyed by `affiliateId`):
- `Affiliate` — Root entity: legalName, status, isAffiliate/isSeller flags, scheduling defaults
- `Location` — Practice locations with address, schedule, on-site service flags
- `Provider` — Licensed providers with NPI, DEA, credentials
- `ReferringProvider` — External referring providers
- `LabNetwork`, `RadiologyNetwork` — Network configuration
- `CareNavConfig` — Care navigation settings and escalation contacts

**Program-scoped** (keyed by `programId`, child of Affiliate):
- `Program` — Program name, contacts, member count, geographic availability, default services
- `Service` — Selected service types per program
- `SubService` — Sub-service availability per service type

**Seller-specific** (separate tables, keyed by `affiliateId`):
- `SellerProfile` — Legal name, contacts, W-9, encrypted ACH info
- `SellerLocation` — Locations with geocoding (lat/lng for map)
- `SellerProvider` — Provider credentials
- `SellerLabNetwork` — Lab network configuration
- `SellerServiceOffering` — Available service types
- `SellerOrgSubService` — Org-level sub-service defaults
- `SellerLocationServiceConfig`, `SellerLocationSubService` — Per-location service overrides

**Network/Contract Models**:
- `NetworkContract` — Links affiliate (buyer) to seller; `scopeAll` or scoped to specific locations
- `NetworkContractLocation` — Junction table for location-scoped contracts

**Version Control**:
- `SectionSnapshot` — Immutable JSON audit trail per section. Fields: sectionId, data (JSON), userId, affiliateId, programId. Indexed by `[affiliateId, sectionId, createdAt]`

**Flow Tracking**:
- `AffiliatePhase` — Phase-level status tracking (DRAFT/SUBMITTED per phase)
- `OnboardingFlow` — Flow-level status for seller (DRAFT/SUBMITTED)

### Encrypted Fields

AES-256-GCM via `src/lib/encryption.ts`. Format: `iv:authTag:ciphertext` (hex-encoded).

Encrypted on write, decrypted on load:
- Program: `achRoutingNumber`, `achAccountNumber`, `paymentAchRoutingNumber`, `paymentAchAccountNumber`
- SellerProfile: `achRoutingNumber`, `achAccountNumber`

---

## Client Architecture

### OnboardingClient — The Orchestrator

`src/components/form/OnboardingClient.tsx` is the central client component that manages all form state. It:

1. Receives all pre-loaded data from the server page
2. Manages client-side tab switching between sections (no per-click server round-trips)
3. Provides contexts for dirty tracking, saving overlay, caching, and completion

**Internal Contexts** (all defined in OnboardingClient.tsx):

| Context | Purpose | Hook |
|---|---|---|
| `SectionCacheCtx` | Affiliate data cache (updated on unmount) | `useSyncSectionCache(sectionId, data)` |
| `SellerCacheCtx` | Seller data cache (updated on save only) | `useSellerCacheUpdater()` |
| `DirtyCtx` | Tracks which sections have unsaved changes | `useReportDirty(sectionId, isDirty)` |
| `SavingCtx` | Toggles full-screen LoadingOverlay | `useSaving()` |

**External Contexts**:

| Context | File | Purpose |
|---|---|---|
| `CompletionContext` | `src/lib/contexts/CompletionContext.tsx` | Completion statuses, phase info, lock logic, `isLocked()`, `unmetFor()` |
| `AdminFormContext` | `src/lib/contexts/AdminFormContext.tsx` | Detects admin editing mode; forms route saves to `save*ForAffiliate()` actions |

### Why Two Cache Strategies?

- **Affiliate** (`useSyncSectionCache`): Syncs on unmount. Navigating away preserves form state even if unsaved. Safe because affiliate data is always associated with one user at a time.
- **Seller** (`useSellerCacheUpdater`): Syncs on save only. Prevents unsaved edits from corrupting the cache, which matters because seller data involves complex nested structures (locations, providers).

---

## Form Section Lifecycle

### 1. Data Loading (Server)

The server page (`/onboarding/page.tsx`) calls `loadAllOnboardingData()` which fetches all section data in parallel via `Promise.all`:

```
loadAllOnboardingData()
  ├── Fetch affiliate, programs, phases
  ├── Build section data (1–4, 9, 11) from program + affiliate records
  ├── Compute affiliate completion statuses
  └── If isSeller:
      ├── Fetch seller profile, offerings, locations, providers, lab, flow status
      ├── Compute seller statuses via computeSellerStatuses()
      └── Build SellerFlowData object
```

All data is passed as props to `OnboardingClient`.

### 2. Section Rendering (Client)

OnboardingClient maintains `activeSection` (affiliate) or `activeSellerSection` (seller) state. A switch statement in `renderAffiliateSection()` or `renderSellerSection()` renders the active form component.

Each form receives: `initialData` (from cache), `onNavigate` callback, `disabled` flag.

### 3. Hooks Setup (in every form)

```typescript
// 1. Local state
const [data, setData] = useState(initialData);

// 2. Cache sync
useSyncSectionCache(sectionId, data);  // affiliate
// OR: const updateCache = useSellerCacheUpdater();  // seller

// 3. Save handler
const onSave = useCallback(async (d) => {
  if (adminCtx?.isAdminEditing) return saveForAffiliate(adminCtx.affiliateId, d);
  return saveSection(d);
}, [adminCtx]);

// 4. Save-on-next hook
const { save, isDirty } = useSaveOnNext({ data, onSave, onAfterSave: updateStatuses });

// 5. Dirty tracking
useReportDirty(sectionId, isDirty);
```

### 4. useSaveOnNext Internals (`src/lib/hooks/useSaveOnNext.ts`)

- Compares current data (JSON.stringify) to initial snapshot to determine `isDirty`
- `save()` is async: calls `onSave(data)`, updates initial ref on success, calls `onAfterSave` with returned statuses
- Registers `beforeunload` handler when dirty to prevent accidental navigation
- Does NOT debounce — save is triggered explicitly by nav buttons

### 5. Navigation & Save

SectionNavButtons (or SellerSectionNavButtons) orchestrates:
1. User clicks "Next" → `setSaving(true)` (shows LoadingOverlay)
2. Calls `onSave()` from the form
3. `flushSync()` to ensure dirty state updates propagate before unmount
4. `onNavigate(nextSection)` to switch tabs
5. `setSaving(false)` (hides overlay)

Previous button navigates without saving.

---

## Server Action Lifecycle

Every save action follows this pattern:

```
1. getSessionContext()           → Auth gate (session → userId, affiliateId, programId, role)
2. assertNotSubmitted()          → Submission lock (affiliate only; checks phase status)
3. schema.parse(data)            → Zod validation (partial — all fields optional)
4. prisma.[model].update/upsert  → Database write (with encryption for sensitive fields)
5. writeSectionSnapshot()        → Immutable audit trail entry (JSON blob)
6. return completionStatuses     → Affiliate: getCompletionStatuses(), Seller: computeSellerStatuses()
```

### Completion Status Computation

**Affiliate** (`getCompletionStatuses` in `completion.ts`):
- Per-section logic checks required fields against the database
- Returns `Record<number, CompletionStatus>` where status is `"not_started" | "in_progress" | "complete"`
- Section 10 (Review) is `"complete"` only when affiliate status is SUBMITTED

**Seller** (`computeSellerStatuses` in `seller-org.ts`):
- Checks required fields for each seller section (S-1 through S-6)
- S-R (Review) is `"complete"` when flow status is SUBMITTED, or `"in_progress"` when all S-1..S-6 are complete
- Returns `Record<SellerSectionId, CompletionStatus>`

### Snapshot ID Mapping

| Flow | Section | Snapshot ID |
|---|---|---|
| Affiliate | Sections 1–9, 11 | Same as section number |
| Seller | S-1 (Org) | 100 |
| Seller | S-2 (Locations) | 102 |
| Seller | S-3 (Providers) | 103 |
| Seller | S-4 (Services) | 104 |
| Seller | S-5 (Lab) | 105 |
| Seller | S-6 (Billing) | 106 |

---

## Navigation System

### Affiliate: SectionNav

- Sections grouped by `minPhase` (from SECTIONS array)
- Sub-grouped by phase type (program, operations, review)
- Status dots: amber (dirty), green checkmark (complete), teal half-circle (in progress), gray circle (not started)
- Lock states: unmet prerequisites OR submitted phase → section is locked (faded, tooltip explains why)
- Submitted phases start collapsed

### Seller: SellerSectionNav

- Flat list from `SELLER_SECTIONS` array (no phase grouping, no prerequisites)
- Same status dot system as affiliate
- Entire form locked when `sellerFlowStatus === "SUBMITTED"` (banner explains)

### Prerequisites

Defined in `SECTION_PREREQUISITES` in `src/types/index.ts`:
```
Section 2, 3, 4 → require Section 1
Section 10 (Review) → requires Sections 1, 2, 3, 4, 5, 9
```

`getUnmetPrerequisites(sectionId, statuses)` returns `SectionMeta[]` of incomplete prerequisites.

---

## Completion & Submission

### Affiliate (Phase-Based)

1. Each section's completion is computed by checking required fields
2. Review section (10) requires all other sections complete
3. `submitForm()` / `submitPhase()` validates all sections are complete, then:
   - Updates `affiliate.status` to SUBMITTED
   - Creates/updates `AffiliatePhase` record
   - Uses `prisma.$transaction` for atomicity
4. Submitted phases are locked — sections can't be edited
5. Admin can unlock phases for re-editing

### Seller (Flow-Based)

1. `submitSellerFlow()` checks all S-1 through S-6 are complete
2. Creates `OnboardingFlow` record with status SUBMITTED
3. If dual-role (isAffiliate), auto-creates a `NetworkContract` (self-contracting)
4. Entire seller flow locked after submission
5. Admin can unlock via separate action

---

## Authentication & Authorization

### Auth.js Configuration (`src/lib/auth.ts`)

- **Provider**: Credentials (email + bcryptjs password hash)
- **Strategy**: JWT (required for Credentials — database sessions cause UnsupportedStrategy error)
- **Session**: 30-minute maxAge, 5-minute updateAge
- **JWT callback**: Enriches token with `role` and `affiliateId` from database
- **Session callback**: Exposes `id`, `role`, `affiliateId` on `session.user`

### Roles

| Role | Access | Redirect |
|---|---|---|
| `SUPER_ADMIN` | `/admin` portal, can manage all affiliates | Redirected away from `/onboarding` |
| `ADMIN` | `/onboarding` for own affiliate | Redirected away from `/admin` |
| `COLLABORATOR` | `/onboarding` for own affiliate | Same as ADMIN |

### Middleware (`src/middleware.ts`)

Uses `getToken` from `next-auth/jwt` (NOT the `auth()` wrapper which is too heavy for Edge — it pulls in Prisma and bcrypt).

- Detects HTTPS and uses correct cookie name (`__Secure-authjs.session-token` vs `authjs.session-token`)
- Public routes: `/login`, `/register`, `/api/auth/*`
- Unauthenticated → redirect to `/login?callbackUrl=...`
- SUPER_ADMIN on `/onboarding` → redirect to `/admin`
- Non-SUPER_ADMIN on `/admin` → redirect to `/onboarding`

---

## Deployment

### Vercel Configuration

- **Project**: `hop-aboard` in `joes-projects-48865212` scope
- **Build**: `prisma generate && next build`
- **Deploy**: `vercel --prod`

### Required Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooler (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Same pooler for migrations (port 5432) |
| `AUTH_SECRET` | JWT signing key (Auth.js v5) |
| `NEXTAUTH_SECRET` | Same value (used by `getToken` in middleware) |
| `AUTH_TRUST_HOST` | `true` (required for Vercel proxy) |
| `FIELD_ENCRYPTION_KEY` | 64 hex chars for AES-256-GCM |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side file ops) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL token for network builder |

### Supabase Connection Details

- Project ref: `iacguocpjmxrfpnmpoye`, region: `us-east-2`
- Pooler host: `aws-1-us-east-2.pooler.supabase.com` (NOT aws-0)
- Port 6543 = transaction mode (runtime), port 5432 = session mode (migrations)
- Direct DB host (`db.xxx.supabase.co`) DNS doesn't resolve — use pooler for both URLs
- Prisma reads `.env` (not `.env.local`), so both files must have the same values
