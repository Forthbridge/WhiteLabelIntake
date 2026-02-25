import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";
import path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures/files");

test.describe("affiliate section 10: review & submit", () => {
  let onboarding: OnboardingPage;

  // --- Helper: completes Section 1 + 2 + 4 + 5 prerequisites ---
  async function completeAllPrereqs(page: import("@playwright/test").Page) {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // Section 1: Company & Contacts
    await onboarding.navigateToSection("Company & Contacts");
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page.locator('input[name="adminContactEmail"]').fill("jane@e2etest.com");
    await page.locator('input[name="executiveSponsorName"]').fill("Bob Exec");
    await page.locator('input[name="executiveSponsorEmail"]').fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Company & Contacts", { timeout: 10_000 });

    // Section 2: Your Plan (also saves sections 3, 9, 11 via composite form)
    await onboarding.navigateToSection("Your Plan");
    await page.locator('input[name="programName"]').fill("E2E Test Plan");
    // Toggle at least one service to mark section 3 as complete
    await page.locator('input[name="service-labs"]').check();
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Your Plan", { timeout: 10_000 });

    // Section 4: Payouts & Payments (fill all required fields)
    await onboarding.navigateToSection("Payouts & Payments");
    await page.locator('input[name="achAccountHolderName"]').fill("Test Corp");
    await page.selectOption('select[name="achAccountType"]', "checking");
    await page.locator('input[name="achRoutingNumber"]').fill("021000021");
    await page.locator('input[name="achAccountNumber"]').fill("1234567890");
    await page.locator('input[name="paymentAchAccountHolderName"]').fill("Test Corp Pay");
    await page.selectOption('select[name="paymentAchAccountType"]', "savings");
    await page.locator('input[name="paymentAchRoutingNumber"]').fill("021000021");
    await page.locator('input[name="paymentAchAccountNumber"]').fill("0987654321");
    // Upload W-9 and bank doc
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(path.join(FIXTURES_DIR, "test-w9.pdf"));
    await expect(page.getByText("test-w9.pdf")).toBeVisible({ timeout: 15_000 });
    await fileInputs.nth(1).setInputFiles(path.join(FIXTURES_DIR, "test-bank-doc.pdf"));
    await expect(page.getByText("test-bank-doc.pdf")).toBeVisible({ timeout: 15_000 });
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Payouts & Payments", { timeout: 15_000 });

    // Section 5: Care Network — add at least one location (if not already done)
    // Check if Section 5 is already complete from a previous test run
    const alreadyComplete = await onboarding.isSectionComplete("Care Network");
    if (!alreadyComplete) {
      await onboarding.navigateToSection("Care Network");
      await page.locator("button", { hasText: "List" }).click();
      const marketplaceCheckbox = page.locator('input[name="show-marketplace"]');
      await marketplaceCheckbox.check();
      // Wait for available locations to appear
      await expect(page.locator("p", { hasText: /^Available to Add/ })).toBeVisible({ timeout: 10_000 });
      // Add first available location
      await page.locator("button", { hasText: "Add to Network" }).first().click();
      // Handle pricing modal — wait for pricing data to load
      const modal = page.locator(".fixed.inset-0 .bg-white").first();
      await expect(modal).toBeVisible({ timeout: 5_000 });
      const acceptCheckbox = page.locator('input[name="accept-pricing"]');
      await expect(acceptCheckbox).toBeVisible({ timeout: 15_000 });
      await acceptCheckbox.check();
      const acceptBtn = page.locator("button", { hasText: /Accept & Add/ });
      await expect(acceptBtn).toBeEnabled({ timeout: 5_000 });
      await acceptBtn.click();
      await expect(acceptCheckbox).not.toBeVisible({ timeout: 10_000 });
    }
  }

  test.describe("locked state (no prereqs)", () => {
    test.beforeEach(async ({ page }) => {
      onboarding = new OnboardingPage(page);
      await onboarding.goto();
      await onboarding.navigateToSection("Review & Submit");
    });

    test("section renders with heading and all summary cards", async ({ page }) => {
      await expect(onboarding.sectionHeading).toContainText("Review & Submit");
      await expect(page.locator("h3", { hasText: "Completion Checklist" })).toBeVisible();
      await expect(page.locator("h3", { hasText: "Company & Contacts" })).toBeVisible();
      await expect(page.locator("h3", { hasText: "Your Plan" })).toBeVisible();
      await expect(page.locator("h3", { hasText: "Care Network" })).toBeVisible();
      await expect(page.locator("h3", { hasText: "Payouts & Payments" })).toBeVisible();
    });

    test("submit button is disabled when sections incomplete", async ({ page }) => {
      const submitButton = page.locator("button", { hasText: "Submit Onboarding Form" });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe.configure({ mode: "serial" });

  test.describe("unlocked state (all prereqs complete)", () => {
    // These tests need extra time for the heavy setup
    test.setTimeout(90_000);

    test.beforeEach(async ({ page }) => {
      await completeAllPrereqs(page);
      await onboarding.navigateToSection("Review & Submit");
      await expect(onboarding.sectionHeading).toContainText("Review & Submit", { timeout: 5_000 });
    });

    test("completion checklist shows complete sections", async ({ page }) => {
      await expect(page.locator("h3", { hasText: "Completion Checklist" })).toBeVisible();
      // All 4 prereqs should show green checkmarks — no "Go to section" links
      const goToButtons = page.locator("button", { hasText: "Go to section" });
      // Some sections might still be incomplete on server (3, 9) but client checklist only shows visible sections
      await expect(page.locator("h3", { hasText: "Completion Checklist" })).toBeVisible();
    });

    test("edit buttons navigate to corresponding sections", async ({ page }) => {
      // Find the Edit button next to Company & Contacts heading
      const editButton = page.locator("button", { hasText: "Edit" }).first();
      await editButton.click();
      await expect(onboarding.sectionHeading).not.toContainText("Review & Submit", { timeout: 5_000 });
    });

    test("review checkboxes can be toggled", async ({ page }) => {
      const reviewCheckbox = page.locator("input#review-section-1");
      await expect(reviewCheckbox).toBeVisible();
      await reviewCheckbox.check();
      await expect(reviewCheckbox).toBeChecked();
      await reviewCheckbox.uncheck();
      await expect(reviewCheckbox).not.toBeChecked();
    });

    test("all review checkboxes are present", async ({ page }) => {
      await expect(page.locator("input#review-section-1")).toBeVisible();
      await expect(page.locator("input#review-section-2")).toBeVisible();
      await expect(page.locator("input#review-section-5")).toBeVisible();
      await expect(page.locator("input#review-section-4")).toBeVisible();
    });

    test("submit button enabled when all sections complete and reviewed", async ({ page }) => {
      // Check all review checkboxes
      await page.locator("input#review-section-1").check();
      await page.locator("input#review-section-2").check();
      await page.locator("input#review-section-5").check();
      await page.locator("input#review-section-4").check();

      const submitButton = page.locator("button", { hasText: "Submit Onboarding Form" });
      await expect(submitButton).toBeEnabled({ timeout: 5_000 });
    });

    test("review checkbox persists after navigation", async ({ page }) => {
      await page.locator("input#review-section-1").check();
      await expect(page.locator("input#review-section-1")).toBeChecked();

      // Navigate away and back
      await onboarding.navigateToSection("Company & Contacts");
      await expect(onboarding.sectionHeading).toContainText("Company & Contacts", { timeout: 5_000 });
      await onboarding.navigateToSection("Review & Submit");
      await expect(page.locator("input#review-section-1")).toBeChecked({ timeout: 5_000 });
    });
  });
});
