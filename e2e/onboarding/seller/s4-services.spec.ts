import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

test.describe("seller S-4: default services offered", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.navigateToSection("Default Services Offered");
  });

  test("section renders with heading", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Default Services Offered");
  });

  test("pre-seeded services are checked", async ({ page }) => {
    // Seed data has clinic_visit and labs selected
    const clinicCheckbox = page.locator('input[name="seller-service-clinic_visit"]');
    const labsCheckbox = page.locator('input[name="seller-service-labs"]');
    await expect(clinicCheckbox).toBeChecked();
    await expect(labsCheckbox).toBeChecked();
  });

  test("toggle service on and off", async ({ page }) => {
    const imagingCheckbox = page.locator('input[name="seller-service-imaging"]');
    await imagingCheckbox.check();
    await expect(imagingCheckbox).toBeChecked();
    await imagingCheckbox.uncheck();
    await expect(imagingCheckbox).not.toBeChecked();
  });

  test("save services via Next, verify persistence", async ({ page }) => {
    // Add imaging
    await page.locator('input[name="seller-service-imaging"]').check();

    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Default Services Offered", { timeout: 10_000 });

    // Navigate back
    await onboarding.navigateToSection("Default Services Offered");
    await expect(page.locator('input[name="seller-service-imaging"]')).toBeChecked();
  });

  test("section complete when clinic_visit is selected", async ({ page }) => {
    // clinic_visit is already selected from seed
    const isComplete = await onboarding.isSectionComplete("Default Services Offered");
    expect(isComplete).toBe(true);
  });
});
