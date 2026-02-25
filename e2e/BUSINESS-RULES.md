# E2E Test Business Rules Reference

> This document captures every business rule the E2E test suite needs to verify.
> Each chunk's spec files reference specific sections of this document by header anchor.

---

## 1. Role System

| Role | Route Access | Redirect When Wrong |
|------|-------------|-------------------|
| `SUPER_ADMIN` | `/admin` only | `/onboarding` → redirects to `/admin` |
| `ADMIN` | `/onboarding`, `/dashboard` | `/admin` → redirects to `/onboarding` |
| `COLLABORATOR` | `/onboarding` | `/admin` → redirects to `/onboarding` |
| Unauthenticated | `/`, `/login`, `/register` | Any protected route → `/login?callbackUrl=...` |

**Cookie name (HTTPS):** `__Secure-authjs.session-token`
**Cookie name (HTTP):** `authjs.session-token`
**Session:** JWT strategy, 30-minute max age

---

## 2. Registration

**Required fields:** `name`, `email`, `password`, `confirmPassword`

**Client-side validations:**
- Passwords must match → `"Passwords do not match."`
- Password ≥ 8 chars → `"Password must be at least 8 characters."`

**Server-side validations (Zod):**
- `name`: min 1 → `"Name is required"`
- `email`: valid email → `"Invalid email address"`
- `password`: min 8 → `"Password must be at least 8 characters"`

**Error responses:**
- Duplicate email → HTTP 409, `"An account with this email already exists."`

**On success (HTTP 201):**
1. Creates: Affiliate + User (ADMIN role) + Program
2. Auto-sign-in via `signIn("credentials", ...)` → redirect to `/onboarding`
3. If auto-sign-in fails → redirect to `/login?registered=true`

---

## 3. Login

**Required fields:** `email`, `password`

**Error message (any failure):** `"Invalid email or password. Please try again."`

**Post-login redirect:** `callbackUrl` param if present, else `/onboarding`

---

## 4. Affiliate Sections (Ordered)

| ID | Title | Phase | Hidden | Prerequisites |
|----|-------|-------|--------|--------------|
| 1 | Company & Contacts | program | no | none |
| 2 | Your Plan | program | no | [1] |
| 3 | In-Person & Extended Services | program | yes | none |
| 4 | Payouts & Payments | program | no | [1] |
| 5 | Care Network | program | no | [1, 2] |
| 9 | Care Navigation | program | yes | none |
| 10 | Review & Submit | review | no | [1, 2, 4, 5] |

**Hidden sections** (3, 9) do not appear in the sidebar but their data is saved as part of composite saves (Section 2 save triggers sections 2+3+9+11).

---

## 5. Affiliate Completion Rules

### Section 1: Company & Contacts
**Required fields (all 6):**
- `affiliate.legalName`
- `program.adminContactName`
- `program.adminContactEmail`
- `program.executiveSponsorName`
- `program.executiveSponsorEmail`
- `program.itContactName`

**Status:** 0 filled → `not_started` | all 6 → `complete` | otherwise → `in_progress`

### Section 2: Your Plan
**Required:** `program.programName`
**Status:** programName exists → `complete` | else → `not_started`

### Section 3: In-Person & Extended Services
**Logic:** Count services where `selected: true`
**Status:** 0 exist → `not_started` | exist but none selected → `in_progress` | ≥1 selected → `complete`

### Section 4: Payouts & Payments
**Required fields (all 10):**
- Payout: `w9FilePath`, `achRoutingNumber`, `achAccountNumber`, `achAccountType`, `achAccountHolderName`, `bankDocFilePath`
- Payment: `paymentAchAccountHolderName`, `paymentAchAccountType`, `paymentAchRoutingNumber`, `paymentAchAccountNumber`

**Status:** 0 filled → `not_started` | all 10 → `complete` | otherwise → `in_progress`

### Section 5: Care Network
**Logic:** Count `networkContractTerm` with status `ACTIVE` (deduped by contractId:sellerLocationId)
**Status:** activeTermCount > 0 → `complete` | else → `not_started`

### Section 9: Care Navigation
**Required:** `careNavConfig.primaryEscalationName` AND `careNavConfig.secondaryEscalationName`
**Status:** not exists → `not_started` | both filled → `complete` | otherwise → `in_progress`

### Section 10: Review & Submit
**Status:** `affiliate.status === "SUBMITTED"` → `complete` | else → `not_started`

---

## 6. Seller Sections (Ordered)

| ID | Title | Order |
|----|-------|-------|
| S-1 | Organization Info | 1 |
| S-4 | Default Services Offered | 2 |
| S-7 | Price Lists | 3 |
| S-2 | Physical Locations | 4 |
| S-3 | Providers & Credentials | 5 |
| S-5 | Lab Network | 6 |
| S-6 | Payment Account | 7 |
| S-R | Review & Submit | 8 |

**No prerequisites.** All sections accessible from start.

---

## 7. Seller Completion Rules

### S-1: Organization Info
**Required (all 3):** `sellerProfile.legalName`, `adminContactName`, `adminContactEmail`
**Status:** 0 → `not_started` | all 3 → `complete` | otherwise → `in_progress`

### S-2: Physical Locations
**Per location required (all 7):** `locationName`, `streetAddress`, `city`, `state`, `zip`, `locationNpi`, `phoneNumber`
**Status:** 0 locations → `not_started` | all locations complete → `complete` | otherwise → `in_progress`

### S-3: Providers & Credentials
**Per provider required (all 4):** `firstName`, `lastName`, `npi`, `licenseNumber`
**Status:** 0 providers → `not_started` | all complete → `complete` | otherwise → `in_progress`

### S-4: Default Services Offered
**Required:** ≥1 service selected AND `clinic_visit` must be selected
**Status:** 0 exist or none selected → `not_started` | selected > 0 AND clinic_visit → `complete` | otherwise → `in_progress`

### S-5: Lab Network
**Required:** `networkType` AND `coordinationContactName` AND (networkType ≠ "other" OR `integrationAcknowledged` = true)
**Status:** not exists → `not_started` | all met → `complete` | otherwise → `in_progress`

### S-6: Payment Account
**Required (all 4):** `achAccountHolderName`, `achRoutingNumber`, `achAccountNumber`, `achAccountType`
**Status:** 0 → `not_started` | all 4 → `complete` | any → `in_progress`

### S-7: Price Lists
**Logic:** Count care services (clinic_visit) with `basePricePerVisit` set + org sub-services with `unitPrice` set
**Status:** 0 total → `not_started` | all priced → `complete` | some → `in_progress`

### S-R: Review & Submit
**Status:** flow SUBMITTED → `complete` | all S-1..S-6 complete → `in_progress` | else → `not_started`

---

## 8. Submission & Locking

### Affiliate Submission (`submitForm()`)
**Pre-checks:**
1. `getSessionContext()` — auth gate
2. `assertNotSubmitted(affiliateId)` — no double submit

**Completion gate:** Sections [1, 2, 3, 4, 5, 6, 7, 9] must ALL be `complete`

**On success:**
- `affiliate.status = "SUBMITTED"`, `affiliate.submittedAt = now()`
- `affiliatePhase` for phase 1 → status `"SUBMITTED"`
- All Phase 1 sections become read-only (disabled inputs)

**Error if already submitted:** `"Phase [X] has been submitted and is locked. Contact your account manager to request changes."`

### Seller Submission (`submitSellerFlow()`)
**Completion gate:** Sections [S-1, S-2, S-3, S-4, S-5, S-6] must ALL be `complete` (S-7 NOT required)

**On success:**
- `onboardingFlow.status = "SUBMITTED"`, `submittedAt = now()`
- All seller sections become read-only
- **Self-contract auto-creation** (see §10)

### Admin Unlock
**Affiliate:** `unlockAffiliate(affiliateId)` → affiliate.status = "DRAFT", submittedAt = null, phase status = "DRAFT"
**Seller:** `unlockSellerFlow(affiliateId)` → onboardingFlow.status = "DRAFT", submittedAt = null
**Access:** SUPER_ADMIN only

---

## 9. Dual-Role Behavior

**Flags:** `Affiliate.isAffiliate` (default true) + `Affiliate.isSeller` (default false)

**Tab bar:** Visible ONLY when `isAffiliate && isSeller`
- Tab 1: "Plan Onboarding" (affiliate flow)
- Tab 2: "Care Delivery Onboarding" (seller flow)

**Default flow:** If isAffiliate → AFFILIATE; if seller-only → SELLER

**Validation:** At least one role must be enabled.

---

## 10. Self-Contract (Dual-Role)

**Trigger:** `submitSellerFlow()` when `affiliate.isAffiliate === true`

**Process:**
1. For each program owned by the affiliate:
   - Create `NetworkContract` where `affiliateId === sellerId`
2. If no programs exist: create contract with `programId: null`

**Effect:** Dual-role org's own seller locations appear in their buyer Care Network (Section 5) without external contracting.

**Protection:** Cannot remove self-owned locations (`"Cannot remove your own locations from the network"`)

---

## 11. Marketplace & Network Builder

### Visibility Toggle
- Controlled by `Affiliate.marketplaceEnabled` (admin-set flag)
- When true, "Show Marketplace" toggle appears in Section 5

### Pricing Resolution (per location)
1. If `contract.priceListId` set → use that price list
2. Else if seller has exactly 1 price list → auto-use it
3. Else if seller has 0 price lists → fall back to org-level pricing (`SellerServiceOffering.basePricePerVisit`)
4. Else if seller has 2+ price lists → show "Multiple pricing schedules available — select when adding"

### Price List Visit Pricing Hierarchy
- Location-specific price > org-wide price (within same price list)

### Plan vs Patient Payer
- If buyer's program has `subService.selected = true` for a service:subType → payer = "plan"
- Otherwise → payer = "patient"

### Add to Network Flow
1. Click "Add to Network" on location card
2. PricingReviewModal opens
3. If contract has no priceListId:
   - 0 eligible lists → proceed without (org pricing)
   - 1 eligible list → auto-select
   - 2+ eligible lists → show selection dropdown
4. Review pricing → Confirm
5. Creates `NetworkContractTerm` with status `ACTIVE`, `acceptedPricing` JSON snapshot

### Remove from Network
- Sets term status to `INACTIVE`, reason enum, endDate = now
- If all terms inactive → clears contract's priceListId

### Switch Price List (ChangePriceListModal)
1. `clearContractPriceList(contractId)`:
   - All ACTIVE terms → INACTIVE (reason: PRICING_CHANGE)
   - Contract priceListId → null
2. User re-adds locations with new price list selection

---

## 12. Network Contracts

**Model:** Links buyer affiliate → seller affiliate per program
- Unique constraint: `(affiliateId, sellerId, programId)`
- `priceListId` nullable (set on first "Add to Network" with price list)

**Creation paths:**
1. Admin: `createNetworkContract()` in admin.ts
2. Self-contract: `submitSellerFlow()` for dual-role orgs
3. Auto-ensure: `loadNetworkData()` creates self-contract if needed

---

## 13. Form Field Reference

### Section 1 (Affiliate — Company & Contacts)
| Field | Input Name | Type | Required for Completion |
|-------|-----------|------|----------------------|
| Legal Name | `legalName` | text | yes |
| Admin Contact Name | `adminContactName` | text | yes |
| Admin Contact Email | `adminContactEmail` | email | yes |
| Executive Sponsor Name | `executiveSponsorName` | text | yes |
| Executive Sponsor Email | `executiveSponsorEmail` | email | yes |
| IT Contact Name | `itContactName` | text | yes |
| IT Contact Email | `itContactEmail` | email | no |
| IT Contact Phone | `itContactPhone` | tel | no |

### Section 2 (Affiliate — Your Plan)
- Displays static list of default services (read-only)
- One editable field: `programName` (text input)
- Also contains composite save for sections 2+3+9+11

### Section 3 (Affiliate — In-Person & Extended Services)
- Service checkboxes: `labs`, `imaging`, `immunizations`, `dme`, `bundled_surgeries`, `specialist_care`, `physical_therapy`, `infusion_services`, `behavioral_health`, `pharmacy`, `other`
- "Configure" button per service opens SubServiceModal for sub-service selection
- "Other" → shows `otherServiceName` text input

### Section 4 (Affiliate — Payouts & Payments)
| Field | Input Name | Type | Required |
|-------|-----------|------|----------|
| W-9 Upload | `w9FilePath` | FileUpload | yes |
| Payout Account Holder | `achAccountHolderName` | text | yes |
| Payout Account Type | `achAccountType` | select (checking/savings) | yes |
| Payout Routing Number | `achRoutingNumber` | text | yes |
| Payout Account Number | `achAccountNumber` | text (encrypted) | yes |
| Bank Doc Upload | `bankDocFilePath` | FileUpload | yes |
| Payment Account Holder | `paymentAchAccountHolderName` | text | yes |
| Payment Account Type | `paymentAchAccountType` | select | yes |
| Payment Routing Number | `paymentAchRoutingNumber` | text | yes |
| Payment Account Number | `paymentAchAccountNumber` | text (encrypted) | yes |

### Section 5 (Affiliate — Care Network)
- Not a traditional form — network builder with map/list views
- "Show Marketplace" toggle (only if marketplaceEnabled)
- Location cards with "Add to Network" / "Remove" actions
- Search/filter controls

### Section 9 (Affiliate — Care Navigation)
| Field | Input Name | Type | Required |
|-------|-----------|------|----------|
| Primary Escalation Name | `primaryEscalationName` | text | yes |
| Primary Escalation Email | `primaryEscalationEmail` | email | yes |
| Secondary Escalation Name | `secondaryEscalationName` | text | yes |
| Secondary Escalation Email | `secondaryEscalationEmail` | email | yes |

### S-1 (Seller — Organization Info)
| Field | Input Name | Type | Required |
|-------|-----------|------|----------|
| Legal Name | `legalName` | text | yes |
| Admin Contact Name | `adminContactName` | text | yes |
| Admin Contact Email | `adminContactEmail` | email | yes |
| Admin Contact Phone | `adminContactPhone` | tel | no |
| Operations Contact Name | `operationsContactName` | text | no |
| Operations Contact Email | `operationsContactEmail` | email | no |
| Operations Contact Phone | `operationsContactPhone` | tel | no |

### S-2 (Seller — Physical Locations)
Per location:
| Field | Input Name | Type | Required |
|-------|-----------|------|----------|
| Location Name | `locationName` | text | yes |
| Street Address | `streetAddress` | text (Mapbox) | yes |
| Street Address 2 | `streetAddress2` | text | no |
| City | `city` | text | yes |
| State | `state` | select | yes |
| ZIP | `zip` | text | yes |
| NPI | `locationNpi` | text | yes |
| Phone | `phoneNumber` | tel | yes |
| Hours | `hoursOfOperation` | text | no |
| Access Type | `accessType` | select | no |
| On-Site Labs | `hasOnSiteLabs` | checkbox | no |
| On-Site Radiology | `hasOnSiteRadiology` | checkbox | no |
| On-Site Pharmacy | `hasOnSitePharmacy` | checkbox | no |

CSV import columns: `location_name`, `street_address`, `street_address_2`, `city`, `state`, `zip`, `phone_number`, `location_npi`, `close_by_description`, `hours_of_operation`, `access_type`, `has_on_site_labs`, `has_on_site_radiology`, `has_on_site_pharmacy`

### S-3 (Seller — Providers)
Per provider:
| Field | Input Name | Type | Required |
|-------|-----------|------|----------|
| First Name | `firstName` | text | yes |
| Last Name | `lastName` | text | yes |
| Provider Type | `providerType` | select | no |
| License Number | `licenseNumber` | text | yes |
| License State | `licenseState` | select | no |
| NPI | `npi` | text | yes |
| DEA Number | `deaNumber` | text | no |

CSV columns: `first_name`, `last_name`, `provider_type`, `license_number`, `license_state`, `npi`, `dea_number`

### S-4 (Seller — Default Services Offered)
- Service checkboxes: `clinic_visit`, `labs`, `imaging`, `immunizations`, `dme`, `bundled_surgeries`, `specialist_care`, `physical_therapy`, `infusion_services`, `behavioral_health`, `pharmacy`, `other`
- Input name pattern: `seller-service-{serviceType}`
- "Configure" button per service opens SubServiceModal

### S-5 (Seller — Lab Network)
| Field | Input Name | Type | Required |
|-------|-----------|------|----------|
| Network Type | `sellerNetworkType` | radio (quest/labcorp/other) | yes |
| Other Name | `otherNetworkName` | text (conditional) | if other |
| Coordination Contact | `coordinationContactName` | text | yes |
| Coordination Email | `coordinationContactEmail` | email | no |
| Coordination Phone | `coordinationContactPhone` | tel | no |
| Integration Ack | `sellerIntegrationAcknowledged` | checkbox (conditional) | if other |

### S-6 (Seller — Payment Account)
| Field | Input Name | Type | Required |
|-------|-----------|------|----------|
| W-9 Upload | `w9FilePath` | FileUpload | no |
| Account Holder | `sellerAchAccountHolderName` | text | yes |
| Account Type | `sellerAchAccountType` | select | yes |
| Routing Number | `sellerAchRoutingNumber` | text | yes |
| Account Number | `sellerAchAccountNumber` | text (encrypted) | yes |
| Bank Doc Upload | `bankDocFilePath` | FileUpload | no |

### S-7 (Seller — Price Lists / Pricing)
- Visit prices: only `clinic_visit` has visit-level pricing (`basePricePerVisit`)
- Sub-service prices: each selected sub-service has `unitPrice`
- "Bulk price" input applies same price to all items in a category
- Location-level pricing overrides available

### S-R (Seller — Review & Submit)
- Completion checklist for S-1 through S-6
- Confirmation checkbox: "I confirm all information is accurate and complete"
- Submit button: disabled until checkbox checked AND all sections complete

---

## 14. Admin Portal

### Affiliate List (`/admin`)
- Columns: Legal Name, Status badge (DRAFT/SUBMITTED), Program Name, Admin User, Created Date
- Search: by legal name, admin email, or program name
- Filter: by status (All/DRAFT/SUBMITTED)
- Click → `/admin/affiliates/{id}`

### Create Client (`/admin/create-client`)
- Fields: Legal Name (optional), Admin Name (required), Admin Email (required), Password (optional, auto-generated if blank)
- Creates: Affiliate + User (ADMIN) + Program
- Auto-password format: `random(10) + "A1!"`

### Affiliate Detail (`/admin/affiliates/{id}`)
Cards:
1. **Organization Roles** — checkboxes: isAffiliate, isSeller, marketplaceEnabled (conditional on isAffiliate). "Save Roles" button.
2. **Phase Progression** — Phase 1 status badge + "Unlock for Editing" button (when SUBMITTED)
3. **Seller Flow Status** (if isSeller) — status badge + "Unlock for Editing" button
4. **Completion Overview** — progress bar + section status grid
5. **Marketplace Visibility** (if isAffiliate) — network contracts list + "Add Visibility" form (seller select + notes)
6. **Users** — user list with name, email, role, "Remove" button

### Admin Edit Mode (`/admin/affiliates/{id}/edit`)
- Wraps OnboardingClient with `AdminFormProvider`
- Forms detect `useAdminForm()` context and route saves to `save*ForAffiliate()` actions
- Loads data via `loadAllOnboardingDataForAffiliate(affiliateId)`

### User Management (`/admin/users`)
- Search: by name, email, or affiliate name
- Filter: by role (All/ADMIN/COLLABORATOR)
- SUPER_ADMIN users excluded from list
- Shows: Name, Email, Role badge, Affiliate name, Join date
