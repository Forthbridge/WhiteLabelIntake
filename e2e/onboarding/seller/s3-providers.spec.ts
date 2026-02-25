import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

// Provider tests modify shared state — run serially
test.describe.configure({ mode: "serial" });

test.describe("seller S-3: providers & credentials", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.navigateToSection("Providers & Credentials");
  });

  test("section renders with heading", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Providers & Credentials");
  });

  test("add provider button exists", async ({ page }) => {
    const addButton = page.locator("button", { hasText: /Add Provider/i });
    await expect(addButton).toBeVisible();
  });

  test("add and fill provider, save, verify persistence", async ({ page }) => {
    // Inputs don't have name attributes — find by label text within their parent div
    // First check if there's already a provider card with fields
    const firstNameLabel = page.locator("label", { hasText: "First Name" }).first();

    if (!(await firstNameLabel.isVisible().catch(() => false))) {
      // No providers yet, add one
      await page.locator("button", { hasText: /Add Provider/i }).click();
      await expect(firstNameLabel).toBeVisible({ timeout: 5_000 });
    }

    // Fill provider fields using label-based selectors
    const firstNameInput = firstNameLabel.locator("..").locator("input");
    await firstNameInput.fill("Dr. Jane");

    const lastNameInput = page.locator("label", { hasText: "Last Name" }).first().locator("..").locator("input");
    await lastNameInput.fill("Smith");

    const licenseInput = page.locator("label", { hasText: "License Number" }).first().locator("..").locator("input");
    await licenseInput.fill("MD12345");

    // License State — find the select near the label
    const licenseStateSelect = page.locator("label", { hasText: "License State" }).first().locator("..").locator("select");
    await licenseStateSelect.selectOption("OH");

    const npiInput = page.locator("label", { hasText: "NPI" }).first().locator("..").locator("input");
    await npiInput.fill("1234567890");

    // Save via Next
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Providers & Credentials", { timeout: 10_000 });

    // Navigate back
    await onboarding.navigateToSection("Providers & Credentials");

    // Verify persistence
    const firstNameAfter = page.locator("label", { hasText: "First Name" }).first().locator("..").locator("input");
    await expect(firstNameAfter).toHaveValue("Dr. Jane");
    const lastNameAfter = page.locator("label", { hasText: "Last Name" }).first().locator("..").locator("input");
    await expect(lastNameAfter).toHaveValue("Smith");
  });

  test("section shows complete after provider saved", async ({ page }) => {
    const isComplete = await onboarding.isSectionComplete("Providers & Credentials");
    expect(isComplete).toBe(true);
  });
});
