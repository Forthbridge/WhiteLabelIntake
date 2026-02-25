import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

test.describe("seller S-7: price lists", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.navigateToSection("Price Lists");
  });

  test("section renders with heading", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Price Lists");
  });

  test("pre-seeded price list is displayed", async ({ page }) => {
    // Seed data creates a "Standard" price list
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
  });

  test("can open price list editor", async ({ page }) => {
    // Click Edit on the Standard price list
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    const editButton = page.locator("button", { hasText: "Edit" }).first();
    await editButton.click();

    // Editor loads async (loadPriceList + loadBuyerOrgs) — give CI enough time
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });
  });

  test("visit price field visible in editor", async ({ page }) => {
    // Open editor for Standard price list
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "Edit" }).first().click();
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });

    // Clinic visit price input should be visible (clinic_visit is selected in S-4)
    const visitPriceInput = page.locator('input#clinicVisitPrice');
    await expect(visitPriceInput).toBeVisible();
    // Seeded at $150
    await expect(visitPriceInput).toHaveValue("150");
  });
});
