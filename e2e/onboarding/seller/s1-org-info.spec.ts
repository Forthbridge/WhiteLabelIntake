import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

test.describe("seller S-1: organization info", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    // Seller-only org — already on seller flow, no tab switching needed
    await onboarding.navigateToSection("Organization Info");
  });

  test("section renders with heading and all fields", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Organization Info");
    await expect(page.locator('input[name="legalName"]')).toBeVisible();
    await expect(page.locator('input[name="adminContactName"]')).toBeVisible();
    await expect(page.locator('input[name="adminContactEmail"]')).toBeVisible();
    await expect(page.locator('input[name="adminContactPhone"]')).toBeVisible();
    await expect(page.locator('input[name="operationsContactName"]')).toBeVisible();
    await expect(page.locator('input[name="operationsContactEmail"]')).toBeVisible();
    await expect(page.locator('input[name="operationsContactPhone"]')).toBeVisible();
  });

  test("pre-seeded data is displayed", async ({ page }) => {
    // Seed data already fills legalName, adminContactName, adminContactEmail
    await expect(page.locator('input[name="legalName"]')).toHaveValue("E2E Seller Corp");
    await expect(page.locator('input[name="adminContactName"]')).toHaveValue("Seller Admin");
    await expect(page.locator('input[name="adminContactEmail"]')).toHaveValue("e2e-seller-admin@test.com");
  });

  test("edit fields, save, verify persistence", async ({ page }) => {
    // Update operations contact
    await page.locator('input[name="operationsContactName"]').fill("Ops Manager");
    await page.locator('input[name="operationsContactEmail"]').fill("ops@seller.com");
    await page.locator('input[name="operationsContactPhone"]').fill("555-0200");

    // Save via Next
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Organization Info", { timeout: 10_000 });

    // Navigate back
    await onboarding.navigateToSection("Organization Info");
    await expect(page.locator('input[name="operationsContactName"]')).toHaveValue("Ops Manager");
    await expect(page.locator('input[name="operationsContactEmail"]')).toHaveValue("ops@seller.com");
    await expect(page.locator('input[name="operationsContactPhone"]')).toHaveValue("555-0200");
  });

  test("section shows complete status", async ({ page }) => {
    // Seeded data has all required fields (legalName, adminContactName, adminContactEmail)
    const isComplete = await onboarding.isSectionComplete("Organization Info");
    expect(isComplete).toBe(true);
  });
});
