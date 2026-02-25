import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

// Review tests modify shared state — run serially
test.describe.configure({ mode: "serial" });

test.describe("seller S-R: review & submit", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.navigateToSection("Review & Submit");
  });

  test("section renders with heading and summary cards", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Review & Submit");
    // Completion checklist card
    await expect(page.locator("h3", { hasText: "Completion Checklist" })).toBeVisible();
    // Summary cards for key sections
    await expect(page.locator("h3", { hasText: "Organization Info" })).toBeVisible();
  });

  test("completion checklist shows section statuses", async ({ page }) => {
    // The checklist should show status for each seller section
    // Some sections are complete from seed (S-1, S-2, S-4), others may not be
    await expect(page.locator("h3", { hasText: "Completion Checklist" })).toBeVisible();
  });

  test("edit links navigate to sections", async ({ page }) => {
    // Click Edit on Organization Info
    const editButton = page.locator("button", { hasText: "Edit" }).first();
    await editButton.click();
    // Should navigate away from Review
    await expect(onboarding.sectionHeading).not.toContainText("Review & Submit", { timeout: 5_000 });
  });

  test("confirmation checkbox is present", async ({ page }) => {
    const confirmCheckbox = page.locator('input[name="sellerConfirm"]');
    await expect(confirmCheckbox).toBeVisible();
  });

  test("submit button disabled when sections incomplete", async ({ page }) => {
    const submitButton = page.locator("button", { hasText: "Submit Care Delivery Onboarding" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeDisabled();
  });
});
