import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

test.describe("affiliate section 2: your plan (composite form)", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // Complete Section 1 first (prerequisite for Section 2)
    await onboarding.navigateToSection("Company & Contacts");
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page.locator('input[name="adminContactEmail"]').fill("jane@e2etest.com");
    await page.locator('input[name="executiveSponsorName"]').fill("Bob Exec");
    await page.locator('input[name="executiveSponsorEmail"]').fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Company & Contacts", { timeout: 10_000 });

    // Navigate to Section 2
    await onboarding.navigateToSection("Your Plan");
  });

  test("section renders with heading and plan name input", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Your Plan");
    await expect(page.locator('input[name="programName"]')).toBeVisible();
  });

  test("default services are displayed as read-only", async ({ page }) => {
    await expect(page.getByText("Unlimited $0 virtual primary care")).toBeVisible();
    await expect(page.locator("h3", { hasText: "Care Navigation" })).toBeVisible();
  });

  test("fill program name, save, verify persistence", async ({ page }) => {
    await page.locator('input[name="programName"]').fill("E2E Test Plan");

    // Save via Next
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Your Plan", { timeout: 10_000 });

    // Navigate back
    await onboarding.navigateToSection("Your Plan");
    await expect(page.locator('input[name="programName"]')).toHaveValue("E2E Test Plan");
  });

  test("toggle services: select and deselect", async ({ page }) => {
    // Find the labs checkbox and toggle it
    const labsCheckbox = page.locator('input[name="service-labs"]');
    await labsCheckbox.check();
    await expect(labsCheckbox).toBeChecked();

    // Check imaging
    const imagingCheckbox = page.locator('input[name="service-imaging"]');
    await imagingCheckbox.check();
    await expect(imagingCheckbox).toBeChecked();

    // Uncheck labs
    await labsCheckbox.uncheck();
    await expect(labsCheckbox).not.toBeChecked();
  });

  test("configure sub-services via modal", async ({ page }) => {
    // Select labs service
    const labsCheckbox = page.locator('input[name="service-labs"]');
    await labsCheckbox.check();

    // Click "Configure" on labs row — the button is a sibling of the checkbox's
    // flex-1 wrapper, inside a shared flex container 3 levels up from the input
    const labsRow = page.locator('div:has(> div > div > input[name="service-labs"])');
    const configureButton = labsRow.locator("button", { hasText: "Configure" });
    await configureButton.click();

    // SubServiceModal should be open
    const modal = page.locator('[role="dialog"]').or(page.locator(".fixed.inset-0")).first();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Click "Select All" if available
    const selectAllButton = modal.getByRole("button", { name: /Select All/i });
    if (await selectAllButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await selectAllButton.click();
    }

    // Close the modal
    const doneButton = modal.getByRole("button", { name: /Done|Close|Save/i });
    await doneButton.click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  });

  test("fill care nav escalation contacts", async ({ page }) => {
    // Scroll to Care Navigation card
    const careNavCard = page.locator("h3:has-text('Care Navigation')").locator("..");

    // Primary escalation — find inputs within the Primary section
    const primarySection = careNavCard.locator("text=Primary Escalation Contact").locator("..");
    const primaryInputs = primarySection.locator("input");
    await primaryInputs.nth(0).fill("Primary Nav");
    await primaryInputs.nth(1).fill("primary@test.com");

    // Secondary escalation
    const secondarySection = careNavCard.locator("text=Secondary Escalation Contact").locator("..");
    const secondaryInputs = secondarySection.locator("input");
    await secondaryInputs.nth(0).fill("Secondary Nav");
    await secondaryInputs.nth(1).fill("secondary@test.com");

    // Also fill programName for completion
    await page.locator('input[name="programName"]').fill("E2E Test Plan");

    // Save via Next
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Your Plan", { timeout: 15_000 });

    // Navigate back and verify persistence
    await onboarding.navigateToSection("Your Plan");
    await expect(page.locator('input[name="programName"]')).toHaveValue("E2E Test Plan");

    // Verify care nav fields persisted
    const careNavCardAfter = page.locator("h3:has-text('Care Navigation')").locator("..");
    const primaryAfter = careNavCardAfter.locator("text=Primary Escalation Contact").locator("..");
    const primaryInputsAfter = primaryAfter.locator("input");
    await expect(primaryInputsAfter.nth(0)).toHaveValue("Primary Nav");
    await expect(primaryInputsAfter.nth(1)).toHaveValue("primary@test.com");
  });

  test("Section 2 shows complete after saving program name", async ({ page }) => {
    await page.locator('input[name="programName"]').fill("E2E Test Plan");
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Your Plan", { timeout: 10_000 });

    const isComplete = await onboarding.isSectionComplete("Your Plan");
    expect(isComplete).toBe(true);
  });

  test("Section 5 unlocks after both Sections 1 and 2 complete", async ({ page }) => {
    // Section 1 already completed in beforeEach
    // Complete Section 2
    await page.locator('input[name="programName"]').fill("E2E Test Plan");
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Your Plan", { timeout: 10_000 });

    // Section 5 prereqs are [1, 2] — both now met
    const isLocked = await onboarding.isSectionLocked("Care Network");
    expect(isLocked).toBe(false);
  });
});
