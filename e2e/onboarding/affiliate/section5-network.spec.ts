import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

// Network tests modify shared DB state — run serially to avoid race conditions
test.describe.configure({ mode: "serial" });

test.describe("affiliate section 5: care network", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // Complete Section 1 (prerequisite)
    await onboarding.navigateToSection("Company & Contacts");
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page.locator('input[name="adminContactEmail"]').fill("jane@e2etest.com");
    await page.locator('input[name="executiveSponsorName"]').fill("Bob Exec");
    await page.locator('input[name="executiveSponsorEmail"]').fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Company & Contacts", { timeout: 10_000 });

    // Complete Section 2 (prerequisite)
    await onboarding.navigateToSection("Your Plan");
    await page.locator('input[name="programName"]').fill("E2E Test Plan");
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Your Plan", { timeout: 10_000 });

    // Navigate to Section 5
    await onboarding.navigateToSection("Care Network");
  });

  test("section renders with heading and filter bar", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Care Network");
    // Filter bar elements
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test("view toggle switches between map and list", async ({ page }) => {
    // Click List view
    const listButton = page.locator("button", { hasText: "List" });
    await listButton.click();

    // List view should render — look for network content area
    await expect(page.locator("button", { hasText: "List" })).toBeVisible();

    // Switch to Map view
    const mapButton = page.locator("button", { hasText: "Map" });
    await mapButton.click();
    await expect(mapButton).toBeVisible();
  });

  test("show marketplace toggle is visible", async ({ page }) => {
    // Buyer affiliate has marketplaceEnabled = true
    const marketplaceCheckbox = page.locator('input[name="show-marketplace"]');
    await expect(marketplaceCheckbox).toBeVisible();
  });

  test("toggling marketplace shows available locations", async ({ page }) => {
    // Switch to list view first
    await page.locator("button", { hasText: "List" }).click();

    // Toggle marketplace ON
    const marketplaceCheckbox = page.locator('input[name="show-marketplace"]');
    await marketplaceCheckbox.check();

    // Seller locations should appear in "Available to Add" heading
    await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });

    // The seeded seller has 2 locations
    await expect(page.getByText("E2E Seller Location 1")).toBeVisible();
    await expect(page.getByText("E2E Seller Location 2")).toBeVisible();
  });

  test("search filters locations", async ({ page }) => {
    // Switch to list view and enable marketplace
    await page.locator("button", { hasText: "List" }).click();
    const marketplaceCheckbox = page.locator('input[name="show-marketplace"]');
    await marketplaceCheckbox.check();
    await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });

    // Search for a specific location
    await page.locator('input[placeholder*="Search"]').fill("Location 1");

    // Only Location 1 should be visible
    await expect(page.getByText("E2E Seller Location 1")).toBeVisible();
    await expect(page.getByText("E2E Seller Location 2")).not.toBeVisible({ timeout: 3_000 });
  });

  test("pricing review modal shows bundle pricing section", async ({ page }) => {
    // Switch to list view and enable marketplace
    await page.locator("button", { hasText: "List" }).click();
    const marketplaceCheckbox = page.locator('input[name="show-marketplace"]');
    await marketplaceCheckbox.check();
    await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });

    // Click "Add to Network" on first location
    const addButton = page.locator("button", { hasText: "Add to Network" }).first();
    await addButton.click();

    // PricingReviewModal should open
    const modal = page.locator(".fixed.inset-0").first();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Wait for pricing to load
    await expect(modal.locator('input[name="accept-pricing"]')).toBeVisible({ timeout: 15_000 });

    // Bundle Pricing section should be visible with seeded bundles
    await expect(modal.getByText("Bundle Pricing", { exact: true })).toBeVisible();
    await expect(modal.getByText("Visits with procedures")).toBeVisible();
    await expect(modal.getByText("Visits with labs")).toBeVisible();
  });

  test("bundle pricing defaults to collapsed with item count", async ({ page }) => {
    // Switch to list view and enable marketplace
    await page.locator("button", { hasText: "List" }).click();
    await page.locator('input[name="show-marketplace"]').check();
    await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });

    // Open pricing modal
    await page.locator("button", { hasText: "Add to Network" }).first().click();
    const modal = page.locator(".fixed.inset-0").first();
    await expect(modal.locator('input[name="accept-pricing"]')).toBeVisible({ timeout: 15_000 });

    // Bundles should show item count and "Show items" toggle
    await expect(modal.getByText(/\d+ items? included/).first()).toBeVisible();
    await expect(modal.getByText("Show items").first()).toBeVisible();
  });

  test("clicking Show items expands bundle to reveal covered items", async ({ page }) => {
    // Switch to list view and enable marketplace
    await page.locator("button", { hasText: "List" }).click();
    await page.locator('input[name="show-marketplace"]').check();
    await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });

    // Open pricing modal
    await page.locator("button", { hasText: "Add to Network" }).first().click();
    const modal = page.locator(".fixed.inset-0").first();
    await expect(modal.locator('input[name="accept-pricing"]')).toBeVisible({ timeout: 15_000 });

    // Click to expand the first bundle
    const bundleButton = modal.locator("button", { hasText: "Visits with procedures" });
    await bundleButton.click();

    // Should now show "Hide items" instead
    await expect(modal.getByText("Hide items")).toBeVisible();
  });

  test("bundle shows flat rate badge and price", async ({ page }) => {
    // Switch to list view and enable marketplace
    await page.locator("button", { hasText: "List" }).click();
    await page.locator('input[name="show-marketplace"]').check();
    await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });

    // Open pricing modal
    await page.locator("button", { hasText: "Add to Network" }).first().click();
    const modal = page.locator(".fixed.inset-0").first();
    await expect(modal.locator('input[name="accept-pricing"]')).toBeVisible({ timeout: 15_000 });

    // Should show "flat rate" badge text
    await expect(modal.getByText("flat rate").first()).toBeVisible();

    // Should show prices
    await expect(modal.getByText("$150.00")).toBeVisible();
    await expect(modal.getByText("$140.00")).toBeVisible();

    // Should show "incl. visit fee" for bundles that include it
    await expect(modal.getByText("incl. visit fee").first()).toBeVisible();
  });

  test("add location to network via pricing review", async ({ page }) => {
    // Switch to list view and enable marketplace
    await page.locator("button", { hasText: "List" }).click();
    const marketplaceCheckbox = page.locator('input[name="show-marketplace"]');
    await marketplaceCheckbox.check();
    await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });

    // Click "Add to Network" on first location
    const addButton = page.locator("button", { hasText: "Add to Network" }).first();
    await addButton.click();

    // PricingReviewModal should open
    const modal = page.locator(".fixed.inset-0").first();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Wait for modal to finish loading — the accept checkbox appears after pricing loads
    const acceptCheckbox = modal.locator('input[name="accept-pricing"]');
    await expect(acceptCheckbox).toBeVisible({ timeout: 15_000 });
    await acceptCheckbox.check();

    // Click accept button — should now be enabled
    const acceptButton = modal.locator("button", { hasText: /Accept & Add/ });
    await expect(acceptButton).toBeEnabled({ timeout: 5_000 });
    await acceptButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // Location count should update in footer
    await expect(page.locator("p", { hasText: /\d+ location.* in your network/ })).toBeVisible({ timeout: 5_000 });
  });

  test("footer shows location count", async ({ page }) => {
    // The footer should show "0 locations in your network" initially (or similar)
    await expect(page.getByText(/\d+ location/)).toBeVisible();
  });
});
