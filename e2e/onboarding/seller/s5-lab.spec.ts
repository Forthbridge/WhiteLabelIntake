import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

// Helper to find an input by its label text (for inputs without name/id attributes)
function inputByLabel(page: import("@playwright/test").Page, labelText: string) {
  return page.locator(`label:has-text("${labelText}")`).locator("..").locator("input");
}

test.describe("seller S-5: lab network", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.navigateToSection("Lab Network");
  });

  test("section renders with heading", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Lab Network");
  });

  test("lab network options are visible", async ({ page }) => {
    await expect(page.getByText("Quest Diagnostics")).toBeVisible();
    await expect(page.getByText("Labcorp")).toBeVisible();
  });

  test("fill lab network and contacts, save, verify persistence", async ({ page }) => {
    // Select Quest via radio input
    await page.locator('input[value="quest"]').check();

    // Fill coordination contact using label-based selectors
    // The lab coordination card has Name, Email, Phone labels
    const labCard = page.locator("h3", { hasText: "Lab Coordination Contact" }).locator("..");
    await labCard.locator("label", { hasText: "Name" }).locator("..").locator("input").fill("Lab Coordinator");
    await labCard.locator("label", { hasText: "Email" }).locator("..").locator("input").fill("lab@seller.com");
    await labCard.locator("label", { hasText: "Phone" }).locator("..").locator("input").fill("555-0300");

    // Save via Next
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Lab Network", { timeout: 10_000 });

    // Navigate back
    await onboarding.navigateToSection("Lab Network");
    await expect(page.locator('input[value="quest"]')).toBeChecked();
    const labCardAfter = page.locator("h3", { hasText: "Lab Coordination Contact" }).locator("..");
    await expect(labCardAfter.locator("label", { hasText: "Name" }).locator("..").locator("input")).toHaveValue("Lab Coordinator");
  });

  test("section shows complete after saving", async ({ page }) => {
    // Check if quest radio is already checked (from previous test or fresh run)
    const questRadio = page.locator('input[value="quest"]');
    const isChecked = await questRadio.isChecked().catch(() => false);
    const labCard = page.locator("h3", { hasText: "Lab Coordination Contact" }).locator("..");
    const nameInput = labCard.locator("label", { hasText: "Name" }).locator("..").locator("input");
    const currentValue = await nameInput.inputValue().catch(() => "");

    if (!isChecked || !currentValue) {
      await questRadio.check();
      await nameInput.fill("Lab Coordinator");
      await labCard.locator("label", { hasText: "Email" }).locator("..").locator("input").fill("lab@seller.com");
      await labCard.locator("label", { hasText: "Phone" }).locator("..").locator("input").fill("555-0300");
      await onboarding.clickNext();
      await expect(onboarding.sectionHeading).not.toContainText("Lab Network", { timeout: 10_000 });
    }

    const navItem = page.locator('[role="button"]', { hasText: "Lab Network" });
    await expect(navItem.locator("svg.text-success")).toBeVisible({ timeout: 10_000 });
  });
});
