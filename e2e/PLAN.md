# Playwright E2E Test Suite — Implementation Plan

> Each chunk is a separate implementation session. Run `npm run test:e2e` after each.
> All business rules referenced here are documented in `e2e/BUSINESS-RULES.md`.

---

## Chunk 1: Scaffolding & First Green Test

**Goal:** Install Playwright, configure it, get one test passing.

**Deliverables:**
1. `npm i -D @playwright/test` + `npx playwright install chromium`
2. `e2e/playwright.config.ts`:
   - `baseURL: "http://localhost:3000"`
   - `webServer: { command: "npm run dev", port: 3000, reuseExistingServer: true }`
   - Single project (Chromium only, no auth)
   - `timeout: 30_000`, `expect.timeout: 10_000`
   - `reporter: [["html"], ["list"]]`
3. `package.json` — add `"test:e2e": "npx playwright test"`
4. `.gitignore` — add `e2e/.auth/`, `playwright-report/`, `test-results/`
5. `e2e/global/landing.spec.ts`:
   ```
   test: Navigate to "/" → h1 contains "Client" and "Onboarding"
   ```

**Verify:** `npm run test:e2e` → 1 test green.

---

## Chunk 2: Test Database Seed & Teardown

**Goal:** Create test users/data. No auth tests yet — just verify clean seed/teardown.

**Deliverables:**

### `.env.test`
Same DB connection as `.env`. Test data uses `e2e-` prefix for isolation.

### `e2e/fixtures/test-data.ts`

**`seedTestData()`** creates (in this order):

1. **Super-admin user**
   - email: `e2e-superadmin@test.com`, password: `TestPass123!`, role: `SUPER_ADMIN`
   - No affiliate (SUPER_ADMIN users don't need one)

2. **Buyer affiliate** (isAffiliate: true, isSeller: false, marketplaceEnabled: true)
   - `legalName: "E2E Buyer Corp"`
   - ADMIN user: `e2e-buyer-admin@test.com` / `TestPass123!`
   - Program: `programName: "E2E Test Plan"`
   - COLLABORATOR user: `e2e-collab@test.com` / `TestPass123!`

3. **Seller affiliate** (isAffiliate: false, isSeller: true)
   - `legalName: "E2E Seller Corp"`
   - ADMIN user: `e2e-seller-admin@test.com` / `TestPass123!`
   - SellerProfile: `legalName: "E2E Seller Corp"`, `adminContactName: "Seller Admin"`, `adminContactEmail: "e2e-seller-admin@test.com"`
   - 2x SellerLocations with all required fields filled (locationName, streetAddress, city, state, zip, locationNpi, phoneNumber)
   - SellerServiceOfferings: `clinic_visit` (selected, basePricePerVisit: 150.00), `labs` (selected)
   - SellerOrgSubServices: a few lab sub-services with unitPrice set
   - 1x SellerPriceList (name: "Standard", isDefault: true) with visit prices and sub-service prices
   - OnboardingFlow: status "DRAFT", flowType "SELLER"

4. **Dual-role affiliate** (isAffiliate: true, isSeller: true, marketplaceEnabled: true)
   - `legalName: "E2E Dual Corp"`
   - ADMIN user: `e2e-dual@test.com` / `TestPass123!`
   - Program + SellerProfile + 1 SellerLocation

5. **NetworkContract** linking buyer → seller (affiliateId: buyer, sellerId: seller, programId: buyer's program)

**`teardownTestData()`** deletes in reverse dependency order:
1. NetworkContractTerms (where contract involves e2e affiliates)
2. NetworkContracts
3. SellerPriceListSubService, SellerPriceListVisit, SellerPriceListRule, SellerPriceList
4. SellerLocationSubService, SellerLocationServiceConfig
5. SellerOrgSubService, SellerServiceOffering
6. SellerLocation, SellerProvider, SellerLabNetwork
7. SellerProfile, OnboardingFlow
8. SectionSnapshot, CareNavConfig
9. ProgramService, SubService, Program
10. AffiliatePhase
11. User (where email LIKE 'e2e-%')
12. Affiliate (where legalName LIKE 'E2E %')

### `e2e/global-setup.ts` — calls `seedTestData()`
### `e2e/global-teardown.ts` — calls `teardownTestData()`
### Update `playwright.config.ts` — add `globalSetup` and `globalTeardown`

**Verify:** `npm run test:e2e` → landing test still passes. Query DB: no `e2e-*` residue after run.

---

## Chunk 3: Auth Fixtures & storageState

**Goal:** Authenticate 5 personas, save cookies, verify role routing.

**Deliverables:**

### Auth in `global-setup.ts`
After seeding, authenticate each persona via `request.newContext()`:
- POST to `/api/auth/callback/credentials` with CSRF token
- Save storageState to `e2e/.auth/{role}.json`

| Persona | Email | storageState File |
|---------|-------|------------------|
| Super Admin | `e2e-superadmin@test.com` | `.auth/super-admin.json` |
| Buyer Admin | `e2e-buyer-admin@test.com` | `.auth/buyer-admin.json` |
| Collaborator | `e2e-collab@test.com` | `.auth/collaborator.json` |
| Seller Admin | `e2e-seller-admin@test.com` | `.auth/seller-admin.json` |
| Dual-Role Admin | `e2e-dual@test.com` | `.auth/dual-role-admin.json` |

### Update `playwright.config.ts` — 6 projects:
```
public          — no storageState
buyer-admin     — .auth/buyer-admin.json
collaborator    — .auth/collaborator.json
super-admin     — .auth/super-admin.json
seller-admin    — .auth/seller-admin.json
dual-role-admin — .auth/dual-role-admin.json
```

### `e2e/auth/middleware.spec.ts`

**Assertions (ref: BUSINESS-RULES.md §1):**

| Test | Project | Action | Expected |
|------|---------|--------|----------|
| Unauth → login redirect | public | goto `/onboarding` | URL contains `/login` |
| Buyer admin → onboarding | buyer-admin | goto `/onboarding` | stays on `/onboarding`, heading visible |
| Super admin → admin | super-admin | goto `/admin` | stays on `/admin` |
| Super admin blocked from onboarding | super-admin | goto `/onboarding` | redirects to `/admin` |
| Buyer admin blocked from admin | buyer-admin | goto `/admin` | redirects to `/onboarding` |

**Verify:** 5 middleware tests pass. `.auth/` files created.

---

## Chunk 4: Auth Flow Tests

**Goal:** Test login and registration UI flows.

### `e2e/fixtures/page-objects/login.page.ts`
```ts
class LoginPage {
  goto()                    // navigate to /login
  fillCredentials(email, password)
  submit()                  // click Sign In button
  getErrorMessage()         // read error banner text
}
```

### `e2e/fixtures/page-objects/register.page.ts`
```ts
class RegisterPage {
  goto()                    // navigate to /register
  fillForm({ name, email, password, confirmPassword })
  submit()                  // click Create Account button
  getErrorMessage()         // read error banner text
}
```

### `e2e/auth/login.spec.ts` (public project)

| Test | Action | Expected (ref: §3) |
|------|--------|---------|
| Form renders | goto /login | email input, password input, "Sign In" button visible |
| Invalid credentials | fill bad creds, submit | error: "Invalid email or password" |
| Valid buyer login | fill e2e-buyer-admin creds, submit | redirected to /onboarding |
| Valid super-admin login | fill e2e-superadmin creds, submit | redirected to /admin |

### `e2e/auth/register.spec.ts` (public project)

| Test | Action | Expected (ref: §2) |
|------|--------|---------|
| Form renders | goto /register | name, email, password, confirm inputs visible |
| Password mismatch | fill mismatched passwords, submit | error: "Passwords do not match" |
| Password too short | fill 5-char password, submit | error: "at least 8 characters" |
| Successful registration | fill valid data (e2e-newuser-{timestamp}@test.com), submit | redirected to /onboarding |
| Duplicate email | fill existing email, submit | error: "already exists" |

### `e2e/global/landing.spec.ts` — expand

| Test | Action | Expected |
|------|--------|---------|
| Sign In link | click "Sign In" button | navigates to /login |
| Create Account link | click "Create Account" button | navigates to /register |

**Cleanup:** Registration test creates a real user. Teardown must also delete users with `e2e-newuser-*` emails.

**Verify:** ~12 tests pass.

---

## Chunk 5: Onboarding Navigation & Flow Switching

**Goal:** Test sidebar nav, prerequisites, flow tabs.

### `e2e/fixtures/page-objects/onboarding.page.ts`
```ts
class OnboardingPage {
  goto()                           // navigate to /onboarding
  navigateToSection(title: string) // click nav item by visible title text
  getCurrentSectionTitle()         // read active section heading
  getSectionStatus(title: string)  // read completion indicator (complete/in_progress/not_started)
  switchFlow(tab: "Plan Onboarding" | "Care Delivery Onboarding")
  clickNext()                      // click Next nav button
  clickPrevious()                  // click Previous nav button
  isNavItemDisabled(title: string) // check if nav item has locked/disabled state
}
```

### `e2e/onboarding/navigation/section-nav.spec.ts` (buyer-admin project)

| Test | Action | Expected (ref: §4) |
|------|--------|---------|
| Sidebar renders visible sections | goto /onboarding | "Company & Contacts", "Your Plan", "Payouts & Payments", "Care Network", "Review & Submit" visible in nav |
| Hidden sections not in nav | inspect nav | "In-Person & Extended Services" (3) and "Care Navigation" (9) NOT in sidebar |
| Active section highlighted | default state | Section 1 has active/highlighted class |
| Click Section 1 | click "Company & Contacts" | heading "Company & Contacts" visible |
| Section 2 locked (prereq: 1) | click "Your Plan" | shows prerequisite banner or locked state (Section 1 not complete) |
| Section 4 locked (prereq: 1) | click "Payouts & Payments" | locked |
| Section 5 locked (prereq: 1,2) | inspect | locked |
| Section 10 locked (prereq: 1,2,4,5) | inspect | locked |

### `e2e/onboarding/navigation/flow-switching.spec.ts` (dual-role-admin project)

| Test | Action | Expected (ref: §9) |
|------|--------|---------|
| Tab bar visible for dual-role | goto /onboarding | "Plan Onboarding" and "Care Delivery Onboarding" tabs visible |
| Default to affiliate flow | initial state | "Plan Onboarding" tab active, affiliate sections in nav |
| Switch to seller flow | click "Care Delivery Onboarding" | seller section titles appear: "Organization Info", "Default Services Offered", etc. |
| Switch back to affiliate | click "Plan Onboarding" | affiliate sections reappear |

### `e2e/onboarding/navigation/flow-switching.spec.ts` (buyer-admin project)

| Test | Action | Expected |
|------|--------|---------|
| No tab bar for affiliate-only | goto /onboarding | tab bar NOT visible |

**Verify:** ~10 tests pass.

---

## Chunk 6: Affiliate Section 1 (Company & Contacts)

**Goal:** Test form fill → save → persist → completion status.

### `e2e/onboarding/affiliate/section1-company.spec.ts` (buyer-admin project)

**Ref: BUSINESS-RULES.md §5 (Section 1) + §13 (Section 1 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Section renders | navigate to Section 1 | heading "Company & Contacts", all 8 input fields visible |
| Fill all required fields | fill: legalName="E2E Test Corp", adminContactName="Jane Admin", adminContactEmail="jane@e2etest.com", executiveSponsorName="Bob Exec", executiveSponsorEmail="bob@e2etest.com", itContactName="Carol IT" | all fields populated |
| Fill optional fields | fill: itContactEmail="carol@e2etest.com", itContactPhone="555-0100" | fields populated |
| Save via Next | click Next | navigates to Section 2 (next visible non-locked section) |
| Values persist on return | navigate back to "Company & Contacts" | all 8 values still present |
| Completion status | check nav | Section 1 shows "complete" indicator |
| Section 2 unlocked | check nav | "Your Plan" no longer locked (prereq [1] satisfied) |
| Section 4 unlocked | check nav | "Payouts & Payments" no longer locked (prereq [1] satisfied) |
| Section 5 still locked | check nav | "Care Network" still locked (prereq [1,2] — Section 2 not yet complete) |

**Verify:** ~8 tests pass. This validates the core form → save → completion → prerequisite unlock cycle.

---

## Chunk 7: Affiliate Sections 2, 3, 9, 11 (Plan + Services + CareNav)

**Goal:** Test composite save (2+3+9+11) and service configuration.

### `e2e/onboarding/affiliate/section2-plan.spec.ts` (buyer-admin project)

**Ref: §5 (Sections 2, 3, 9) + §13**

**Precondition:** Section 1 must be complete (done in Chunk 6, but tests should be independent — fill Section 1 in a `beforeAll` or use pre-seeded data).

| Test | Action | Expected |
|------|--------|---------|
| Section renders | navigate to "Your Plan" | heading visible, programName input present |
| Default services listed | inspect | static list: "Unlimited $0 virtual primary care...", "Emotional wellness counseling...", etc. |
| Fill program name | fill programName="E2E Test Plan" | field populated |
| Toggle services | check `labs`, `imaging`, `clinic_visit` in services section | checkboxes checked |
| Configure sub-services | click "Configure" on labs | SubServiceModal opens with lab sub-service categories |
| Select All in modal | click "Select All" | all sub-services checked, count visible |
| Close modal | close/confirm | count badge shows on labs row |
| Uncheck service clears subs | uncheck `labs` | labs unchecked |
| Re-check service empty subs | check `labs`, click "Configure" | modal opens with 0 selected (auto-cleared) |
| Fill care nav fields | fill primaryEscalationName="Primary Nav", primaryEscalationEmail="primary@test.com", secondaryEscalationName="Secondary Nav", secondaryEscalationEmail="secondary@test.com" | fields populated |
| Save via Next | click Next | composite save (2+3+9+11), navigates forward |
| Values persist | navigate back to "Your Plan" | programName, service selections, care nav all persisted |
| Section 2 complete | check nav | "Your Plan" shows complete (programName exists) |
| Section 5 unlocked | check nav | "Care Network" unlocked (prereqs [1,2] satisfied) |

### `e2e/onboarding/affiliate/section4-payments.spec.ts` (buyer-admin project)

**Ref: §5 (Section 4) + §13**

| Test | Action | Expected |
|------|--------|---------|
| Section renders | navigate to "Payouts & Payments" | heading, two ACH card groups visible |
| Upload W-9 | setInputFiles on w9 FileUpload with `e2e/fixtures/files/test-w9.pdf` | file name shown |
| Fill payout ACH | achAccountHolderName="Test Corp", achAccountType="checking", achRoutingNumber="021000021", achAccountNumber="1234567890" | fields populated |
| Upload bank doc | setInputFiles on bank doc FileUpload | file name shown |
| Fill payment ACH | paymentAchAccountHolderName="Test Corp Pay", paymentAchAccountType="savings", paymentAchRoutingNumber="021000021", paymentAchAccountNumber="0987654321" | fields populated |
| Save via Next | click Next | navigates forward |
| Values persist | navigate back | all fields show saved values (account numbers may show masked) |
| Section 4 complete | check nav | "Payouts & Payments" shows complete (all 10 fields filled) |

**Test fixture:** Create `e2e/fixtures/files/test-w9.pdf` and `test-bank-doc.pdf` — minimal valid PDFs (can be 1-page blank PDFs).

**Verify:** ~15 tests pass.

---

## Chunk 8: Affiliate Section 5 (Care Network) & Section 10 (Review)

**Goal:** Test network builder and review/submit flow.

### `e2e/onboarding/affiliate/section5-network.spec.ts` (buyer-admin project)

**Ref: §11 (Marketplace) + §5 (Section 5 completion)**

**Precondition:** Sections 1, 2 complete. Seeded NetworkContract with seller locations.

| Test | Action | Expected |
|------|--------|---------|
| Section renders | navigate to "Care Network" | heading visible, map container or list view visible |
| Toggle to list view | click list view toggle | location cards appear |
| Marketplace toggle visible | inspect | "Show Marketplace" toggle present (marketplaceEnabled=true on buyer) |
| Enable marketplace | toggle ON | seller locations from seeded contract appear |
| Search filters | type seller location name in search | filtered results |
| Add location | click "Add to Network" on a location | PricingReviewModal opens |
| Confirm add | review pricing, click confirm | location now shows as "included" / "in network" |
| Location count updates | check count indicator | count reflects addition |
| Section 5 complete | check nav | "Care Network" shows complete (≥1 ACTIVE term) |

### `e2e/onboarding/affiliate/section10-review.spec.ts` (buyer-admin project)

**Ref: §8 (Submission) + §5 (Section 10)**

**Precondition:** All prerequisite sections complete (1, 2, 4, 5).

| Test | Action | Expected |
|------|--------|---------|
| Section accessible | navigate to "Review & Submit" | heading visible (prereqs [1,2,4,5] met) |
| Summary cards render | inspect | cards for Company, Plan, Network, Payments showing saved data |
| Edit buttons work | click "Edit" on Company card | navigates to Section 1 |
| Completion checklist | inspect | section statuses displayed |
| Submit disabled initially | check submit button | disabled (review checkboxes not checked) |
| Check all review boxes | check each review checkbox | checkboxes checked |
| Submit enabled | check submit button | enabled (all sections complete + all reviewed) |
| Submit succeeds | click Submit | success confirmation visible |
| Sections locked | navigate to Section 1 | all inputs disabled (phase SUBMITTED) |
| Nav shows submitted | check nav | "Review & Submit" shows complete |

**Verify:** ~18 tests pass.

---

## Chunk 9: Seller Flow (All Sections)

**Goal:** Test all 8 seller sections using `seller-admin` project.

### `e2e/onboarding/seller/s1-org-info.spec.ts` (seller-admin project)

**Ref: §7 (S-1) + §13 (S-1 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Section renders | goto /onboarding, navigate to "Organization Info" | heading, 7 fields visible |
| Fill required | legalName="E2E Seller Test", adminContactName="Seller Admin", adminContactEmail="seller@test.com" | populated |
| Save via Next | click Next | saves, navigates to next seller section |
| Persist | navigate back | values persisted |
| Complete | check nav | S-1 shows complete |

### `e2e/onboarding/seller/s2-locations.spec.ts` (seller-admin project)

**Ref: §7 (S-2) + §13 (S-2 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Add location manually | click "Add Location" | empty location card appears |
| Fill required fields | locationName, streetAddress, city, state, zip, locationNpi, phoneNumber | populated |
| CSV import | upload CSV with 2 locations | 2 new location cards appear with filled data |
| Save via Next | click Next | saves all locations |
| Locations persist | navigate back | all locations present |

### `e2e/onboarding/seller/s3-providers.spec.ts` (seller-admin project)

**Ref: §7 (S-3) + §13 (S-3 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Add provider | click "Add Provider" | empty card |
| Fill required | firstName, lastName, npi, licenseNumber | populated |
| CSV import | upload CSV | providers added |
| Save + persist | Next, back | persisted |

### `e2e/onboarding/seller/s4-services.spec.ts` (seller-admin project)

**Ref: §7 (S-4) + §13 (S-4 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Service checkboxes render | inspect | all 12 seller service types visible |
| Must select clinic_visit | select only `labs`, check status | NOT complete (clinic_visit required) |
| Select clinic_visit | check `clinic_visit` | now completable |
| Configure sub-services | click Configure on labs | SubServiceModal opens |
| Save + persist | Next, back | selections persisted |

### `e2e/onboarding/seller/s5-lab.spec.ts` (seller-admin project)

**Ref: §7 (S-5) + §13 (S-5 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Radio buttons render | inspect | Quest, Labcorp, Other options |
| Select Quest | click Quest | selected |
| Fill contact | coordinationContactName="Lab Contact" | populated |
| Select Other shows extra fields | click Other | otherNetworkName + integrationAcknowledged appear |
| Complete with Other | fill name, check acknowledged | all conditions met |
| Save + persist | Next, back | persisted |

### `e2e/onboarding/seller/s6-billing.spec.ts` (seller-admin project)

**Ref: §7 (S-6) + §13 (S-6 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Section renders | inspect | ACH fields + file uploads visible |
| Fill ACH | accountHolder, type=checking, routing, account | populated |
| Upload W-9 | setInputFiles | file name shown |
| Save + persist | Next, back | persisted (account numbers may be masked) |
| Complete | check nav | S-6 shows complete (4 ACH fields filled) |

### `e2e/onboarding/seller/s7-pricing.spec.ts` (seller-admin project)

**Ref: §7 (S-7) + §13 (S-7 fields)**

| Test | Action | Expected |
|------|--------|---------|
| Visit price for clinic_visit | fill basePricePerVisit="150.00" | populated |
| Sub-service prices | fill unitPrice for a few selected sub-services | populated |
| Bulk price apply | enter bulk price, apply | all items in category get same price |
| Save + persist | Next, back | prices persisted |

### `e2e/onboarding/seller/sr-review.spec.ts` (seller-admin project)

**Ref: §7 (S-R) + §8 (Seller Submission)**

| Test | Action | Expected |
|------|--------|---------|
| Completion checklist | inspect | S-1 through S-6 statuses shown |
| Submit disabled | check | disabled (checkbox not checked or sections incomplete) |
| Check confirmation | check "I confirm..." | checkbox checked |
| Submit succeeds | click Submit (if all complete) | success confirmation |
| Flow locked | navigate to S-1 | all inputs disabled |

**Verify:** ~30 tests pass.

---

## Chunk 10: Admin Portal

**Goal:** Test super-admin CRUD workflows.

### `e2e/fixtures/page-objects/admin.page.ts`
```ts
class AdminPage {
  goto()                           // /admin
  searchAffiliates(query: string)
  filterByStatus(status: string)
  clickAffiliate(name: string)     // click into detail
  gotoCreateClient()               // /admin/create-client
  gotoUsers()                      // /admin/users
}
```

### `e2e/admin/affiliate-list.spec.ts` (super-admin project)

**Ref: §14 (Affiliate List)**

| Test | Action | Expected |
|------|--------|---------|
| List renders | goto /admin | affiliate cards visible, "E2E Buyer Corp" present |
| Search works | type "E2E Buyer" | filtered to matching affiliates |
| Status filter | select "DRAFT" | only DRAFT affiliates shown |
| Click through | click "E2E Buyer Corp" | navigates to detail page |

### `e2e/admin/create-client.spec.ts` (super-admin project)

**Ref: §14 (Create Client)**

| Test | Action | Expected |
|------|--------|---------|
| Form renders | goto /admin/create-client | Legal Name, Admin Name, Admin Email, Password fields |
| Required validation | submit with empty name/email | validation errors |
| Create succeeds | fill: name="E2E Created Admin", email="e2e-created@test.com", legalName="E2E Created Corp" | success, navigate to list |
| New affiliate in list | search "E2E Created" | found in list |

### `e2e/admin/affiliate-detail.spec.ts` (super-admin project)

**Ref: §14 (Affiliate Detail)**

| Test | Action | Expected |
|------|--------|---------|
| Detail page renders | click into "E2E Buyer Corp" | Organization Roles card, Phase Progression, Completion Overview, Users visible |
| Role checkboxes reflect data | inspect | isAffiliate checked, isSeller unchecked, marketplaceEnabled checked |
| Phase status shown | inspect | Phase 1 status badge (DRAFT) |
| Users listed | inspect | "e2e-buyer-admin@test.com" (ADMIN), "e2e-collab@test.com" (COLLABORATOR) |
| Completion overview | inspect | section status grid visible |

### `e2e/admin/affiliate-edit.spec.ts` (super-admin project)

**Ref: §14 (Admin Edit Mode)**

| Test | Action | Expected |
|------|--------|---------|
| Edit form loads | click "Edit Form" on detail page | OnboardingClient renders in admin context |
| Can modify Section 1 | change legalName | field editable |
| Save routes to ForAffiliate action | click Next | saves via admin action (verify data persists) |

### `e2e/admin/user-management.spec.ts` (super-admin project)

**Ref: §14 (User Management)**

| Test | Action | Expected |
|------|--------|---------|
| User list renders | goto /admin/users | user cards visible |
| Search works | type "e2e-buyer" | filtered results |
| Role filter | select "ADMIN" | only ADMIN users shown |
| SUPER_ADMIN excluded | inspect | "e2e-superadmin" NOT in list |

### `e2e/global/dashboard.spec.ts` (buyer-admin project)

| Test | Action | Expected |
|------|--------|---------|
| ADMIN can access dashboard | goto /dashboard | dashboard renders |

**Cleanup:** `teardownTestData()` must also delete `e2e-created@test.com` user + "E2E Created Corp" affiliate.

**Verify:** ~20 tests pass.

---

## Chunk 11: Cross-Role Scenarios

**Goal:** Multi-actor workflows using `browser.newContext({ storageState })` to switch actors.

### `e2e/cross-role/admin-unlock.spec.ts`

**Ref: §8 (Admin Unlock)**

| Test | Action | Expected |
|------|--------|---------|
| Admin unlocks affiliate phase | As super-admin: navigate to submitted affiliate detail, click "Unlock for Editing" | Phase status → DRAFT |
| Affiliate can edit again | Switch to buyer-admin context: navigate to Section 1 | inputs are editable (not disabled) |
| Admin unlocks seller flow | As super-admin: navigate to submitted seller detail, click "Unlock for Editing" on seller flow | Flow status → DRAFT |
| Seller can edit again | Switch to seller-admin context: navigate to S-1 | inputs are editable |

### `e2e/cross-role/self-contract.spec.ts`

**Ref: §10 (Self-Contract)**

| Test | Action | Expected |
|------|--------|---------|
| Dual-role submits seller flow | As dual-role: complete all seller sections, submit | success confirmation |
| Self-contract auto-created | As dual-role: switch to affiliate flow, navigate to Care Network | own seller locations visible in network |
| Cannot remove self-locations | Try to remove own location | error or removal blocked |

### `e2e/cross-role/marketplace-discovery.spec.ts`

**Ref: §11 (Marketplace)**

| Test | Action | Expected |
|------|--------|---------|
| Buyer sees marketplace | As buyer-admin: navigate to Care Network, enable marketplace | seller locations from seeded contract visible |
| Seller with pricing addable | As buyer-admin: click "Add to Network" on seller location | PricingReviewModal shows pricing (seeded price list) |
| Add + confirm | Confirm in modal | location marked as "in network" |
| Price list auto-resolved | inspect modal | seeded seller has 1 price list → auto-resolved, no dropdown |

### `e2e/cross-role/price-list-switching.spec.ts`

**Ref: §11 (Switch Price List)**

| Test | Action | Expected |
|------|--------|---------|
| Change price list | As buyer-admin: open ChangePriceListModal, confirm | all ACTIVE locations removed (INACTIVE), contract priceListId cleared |
| Re-add with new selection | click "Add to Network" again | price list selection appears (if multiple) or auto-resolves |

**Verify:** ~15 tests pass.

---

## Chunk 12: API Tests & Polish

**Goal:** Direct API validation + gap coverage + flake fixes.

### `e2e/api/upload.spec.ts` (buyer-admin project)

| Test | Action | Expected |
|------|--------|---------|
| Unauth upload rejected | POST file without auth | 401 |
| Bad file type rejected | POST non-PDF/image | 400 |
| Successful upload | POST valid PDF with auth | 200, file URL returned |

### `e2e/api/register-api.spec.ts` (public project)

| Test | Action | Expected |
|------|--------|---------|
| Duplicate email | POST with existing email | 409, "already exists" |
| Missing fields | POST with no name | 400, validation error |
| Success | POST valid data | 201 |

### `e2e/onboarding/navigation/program-switching.spec.ts` (buyer-admin project)

| Test | Action | Expected |
|------|--------|---------|
| Multi-plan selector | if multiple programs, selector visible | can switch between programs |

### Polish
- Fix any flaky tests from earlier chunks
- Review HTML report for timing issues
- Add retry config if needed

**Verify:** Full suite passes. `npx playwright show-report` clean.

---

## Test Count Summary

| Chunk | Area | Est. Tests |
|-------|------|-----------|
| 1 | Scaffolding | 1 |
| 2 | Seed/teardown | 0 (infra) |
| 3 | Auth + middleware | 5 |
| 4 | Login + register | 12 |
| 5 | Navigation + flow switching | 10 |
| 6 | Affiliate Section 1 | 8 |
| 7 | Sections 2+3+9+11 & Section 4 | 15 |
| 8 | Section 5 (Network) & 10 (Review) | 18 |
| 9 | Seller flow (all 8 sections) | 30 |
| 10 | Admin portal | 20 |
| 11 | Cross-role scenarios | 15 |
| 12 | API + polish | 10 |
| **Total** | | **~144** |

---

## Directory Structure

```
e2e/
├── BUSINESS-RULES.md              # Business rules reference (this file's companion)
├── PLAN.md                        # This file
├── playwright.config.ts
├── global-setup.ts
├── global-teardown.ts
├── .auth/                         # gitignored
│   ├── buyer-admin.json
│   ├── super-admin.json
│   ├── collaborator.json
│   ├── seller-admin.json
│   └── dual-role-admin.json
├── fixtures/
│   ├── test-data.ts               # seedTestData() + teardownTestData()
│   ├── files/
│   │   ├── test-w9.pdf
│   │   └── test-bank-doc.pdf
│   └── page-objects/
│       ├── login.page.ts
│       ├── register.page.ts
│       ├── onboarding.page.ts
│       └── admin.page.ts
├── auth/
│   ├── login.spec.ts
│   ├── register.spec.ts
│   └── middleware.spec.ts
├── onboarding/
│   ├── affiliate/
│   │   ├── section1-company.spec.ts
│   │   ├── section2-plan.spec.ts
│   │   ├── section4-payments.spec.ts
│   │   ├── section5-network.spec.ts
│   │   └── section10-review.spec.ts
│   ├── seller/
│   │   ├── s1-org-info.spec.ts
│   │   ├── s2-locations.spec.ts
│   │   ├── s3-providers.spec.ts
│   │   ├── s4-services.spec.ts
│   │   ├── s5-lab.spec.ts
│   │   ├── s6-billing.spec.ts
│   │   ├── s7-pricing.spec.ts
│   │   └── sr-review.spec.ts
│   └── navigation/
│       ├── section-nav.spec.ts
│       ├── flow-switching.spec.ts
│       └── program-switching.spec.ts
├── cross-role/
│   ├── marketplace-discovery.spec.ts
│   ├── price-list-switching.spec.ts
│   ├── self-contract.spec.ts
│   └── admin-unlock.spec.ts
├── api/
│   ├── upload.spec.ts
│   └── register-api.spec.ts
└── global/
    ├── landing.spec.ts
    └── dashboard.spec.ts
```

---

## Execution Rules

1. **Each chunk = one session.** Don't start chunk N+1 until chunk N is green.
2. **Tests must be independent.** Each spec can set up its own preconditions if needed (fill Section 1 before testing Section 2).
3. **Use seeded data.** Don't create data in one test and depend on it in another (except within the same `test.describe` using `beforeAll`).
4. **Cleanup registered users.** Any user created during tests (registration tests) must be cleaned in teardown.
5. **No test interdependency across files.** Each `.spec.ts` file must work in isolation.
