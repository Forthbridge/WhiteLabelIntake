import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";
import path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures/files");

test.describe("seller S-6: payment account", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.navigateToSection("Payment Account");
  });

  test("section renders with heading and ACH fields", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Payment Account");
    await expect(page.locator('input[name="sellerAchAccountHolderName"]')).toBeVisible();
    await expect(page.locator('select[name="sellerAchAccountType"]')).toBeVisible();
    await expect(page.locator('input[name="sellerAchRoutingNumber"]')).toBeVisible();
    await expect(page.locator('input[name="sellerAchAccountNumber"]')).toBeVisible();
  });

  test("W-9 file upload input exists", async ({ page }) => {
    // FileUpload renders a hidden file input
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();
    expect(count).toBeGreaterThanOrEqual(1); // W-9 + bank doc
  });

  test("fill ACH fields, save, verify persistence", async ({ page }) => {
    await page.locator('input[name="sellerAchAccountHolderName"]').fill("Seller Corp");
    await page.selectOption('select[name="sellerAchAccountType"]', "checking");
    await page.locator('input[name="sellerAchRoutingNumber"]').fill("021000021");
    await page.locator('input[name="sellerAchAccountNumber"]').fill("9876543210");

    // Save via Next
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Payment Account", { timeout: 10_000 });

    // Navigate back
    await onboarding.navigateToSection("Payment Account");
    await expect(page.locator('input[name="sellerAchAccountHolderName"]')).toHaveValue("Seller Corp");
    await expect(page.locator('select[name="sellerAchAccountType"]')).toHaveValue("checking");
    await expect(page.locator('input[name="sellerAchRoutingNumber"]')).toHaveValue("021000021");
  });

  test("section shows complete after ACH fields saved", async ({ page }) => {
    // Fill and save if not already done
    const holder = page.locator('input[name="sellerAchAccountHolderName"]');
    if (!(await holder.inputValue())) {
      await holder.fill("Seller Corp");
      await page.selectOption('select[name="sellerAchAccountType"]', "checking");
      await page.locator('input[name="sellerAchRoutingNumber"]').fill("021000021");
      await page.locator('input[name="sellerAchAccountNumber"]').fill("9876543210");
      await onboarding.clickNext();
      await expect(onboarding.sectionHeading).not.toContainText("Payment Account", { timeout: 10_000 });
    }

    const isComplete = await onboarding.isSectionComplete("Payment Account");
    expect(isComplete).toBe(true);
  });
});
