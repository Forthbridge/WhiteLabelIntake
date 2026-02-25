import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";
import path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures/files");

test.describe("affiliate section 4: payouts & payments", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // Complete Section 1 first (prerequisite for Section 4)
    await onboarding.navigateToSection("Company & Contacts");
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page.locator('input[name="adminContactEmail"]').fill("jane@e2etest.com");
    await page.locator('input[name="executiveSponsorName"]').fill("Bob Exec");
    await page.locator('input[name="executiveSponsorEmail"]').fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Company & Contacts", { timeout: 10_000 });

    // Navigate to Section 4
    await onboarding.navigateToSection("Payouts & Payments");
  });

  test("section renders with heading and all fields", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Payouts & Payments");
    // Payout ACH fields
    await expect(page.locator('input[name="achAccountHolderName"]')).toBeVisible();
    await expect(page.locator('select[name="achAccountType"]')).toBeVisible();
    await expect(page.locator('input[name="achRoutingNumber"]')).toBeVisible();
    await expect(page.locator('input[name="achAccountNumber"]')).toBeVisible();
    // Payment ACH fields
    await expect(page.locator('input[name="paymentAchAccountHolderName"]')).toBeVisible();
    await expect(page.locator('select[name="paymentAchAccountType"]')).toBeVisible();
    await expect(page.locator('input[name="paymentAchRoutingNumber"]')).toBeVisible();
    await expect(page.locator('input[name="paymentAchAccountNumber"]')).toBeVisible();
  });

  test("upload W-9 file", async ({ page }) => {
    // FileUpload uses a hidden <input type="file"> — set files directly
    const fileInputs = page.locator('input[type="file"]');
    // First file input = W-9
    await fileInputs.nth(0).setInputFiles(path.join(FIXTURES_DIR, "test-w9.pdf"));

    // Wait for upload to complete — filename should appear
    await expect(page.getByText("test-w9.pdf")).toBeVisible({ timeout: 15_000 });
  });

  test("fill payout ACH fields", async ({ page }) => {
    await page.locator('input[name="achAccountHolderName"]').fill("Test Corp");
    await page.selectOption('select[name="achAccountType"]', "checking");
    await page.locator('input[name="achRoutingNumber"]').fill("021000021");
    await page.locator('input[name="achAccountNumber"]').fill("1234567890");

    // Verify filled
    await expect(page.locator('input[name="achAccountHolderName"]')).toHaveValue("Test Corp");
    await expect(page.locator('select[name="achAccountType"]')).toHaveValue("checking");
    await expect(page.locator('input[name="achRoutingNumber"]')).toHaveValue("021000021");
  });

  test("fill payment ACH fields", async ({ page }) => {
    await page.locator('input[name="paymentAchAccountHolderName"]').fill("Test Corp Pay");
    await page.selectOption('select[name="paymentAchAccountType"]', "savings");
    await page.locator('input[name="paymentAchRoutingNumber"]').fill("021000021");
    await page.locator('input[name="paymentAchAccountNumber"]').fill("0987654321");

    await expect(page.locator('input[name="paymentAchAccountHolderName"]')).toHaveValue("Test Corp Pay");
    await expect(page.locator('select[name="paymentAchAccountType"]')).toHaveValue("savings");
  });

  test("fill all fields, save via Next, verify persistence", async ({ page }) => {
    // Upload files
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(path.join(FIXTURES_DIR, "test-w9.pdf"));
    await expect(page.getByText("test-w9.pdf")).toBeVisible({ timeout: 15_000 });

    await fileInputs.nth(1).setInputFiles(path.join(FIXTURES_DIR, "test-bank-doc.pdf"));
    await expect(page.getByText("test-bank-doc.pdf")).toBeVisible({ timeout: 15_000 });

    // Fill payout ACH
    await page.locator('input[name="achAccountHolderName"]').fill("Test Corp");
    await page.selectOption('select[name="achAccountType"]', "checking");
    await page.locator('input[name="achRoutingNumber"]').fill("021000021");
    await page.locator('input[name="achAccountNumber"]').fill("1234567890");

    // Fill payment ACH
    await page.locator('input[name="paymentAchAccountHolderName"]').fill("Test Corp Pay");
    await page.selectOption('select[name="paymentAchAccountType"]', "savings");
    await page.locator('input[name="paymentAchRoutingNumber"]').fill("021000021");
    await page.locator('input[name="paymentAchAccountNumber"]').fill("0987654321");

    // Save via Next
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText("Payouts & Payments", { timeout: 15_000 });

    // Navigate back
    await onboarding.navigateToSection("Payouts & Payments");

    // Verify text fields persisted
    await expect(page.locator('input[name="achAccountHolderName"]')).toHaveValue("Test Corp");
    await expect(page.locator('select[name="achAccountType"]')).toHaveValue("checking");
    await expect(page.locator('input[name="achRoutingNumber"]')).toHaveValue("021000021");
    await expect(page.locator('input[name="paymentAchAccountHolderName"]')).toHaveValue("Test Corp Pay");
    await expect(page.locator('select[name="paymentAchAccountType"]')).toHaveValue("savings");
    await expect(page.locator('input[name="paymentAchRoutingNumber"]')).toHaveValue("021000021");

    // File names should still be visible
    await expect(page.getByText("test-w9.pdf")).toBeVisible();
    await expect(page.getByText("test-bank-doc.pdf")).toBeVisible();
  });
});
