import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

// Bundle rule tests mutate shared state — run serially
test.describe.configure({ mode: "serial" });

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

  test("seeded bundle rules are displayed in editor", async ({ page }) => {
    // Open editor
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "Edit" }).first().click();
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });

    // Bundle section should show seeded rules
    await expect(page.getByText("Bundle Pricing Rules")).toBeVisible();
    await expect(page.getByText("Visits with procedures")).toBeVisible();
    await expect(page.getByText("Visits with labs")).toBeVisible();
  });

  test("bundle rule summary shows flat rate label and price", async ({ page }) => {
    // Open editor
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "Edit" }).first().click();
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });

    // Each rule row should show "Flat Rate · $X.XX"
    await expect(page.getByText("Flat Rate · $150.00")).toBeVisible();
    await expect(page.getByText("Flat Rate · $140.00")).toBeVisible();

    // No "Capped" option should exist anywhere
    await expect(page.getByText("Capped")).not.toBeVisible();
  });

  test("no capped option in bundle rule editor", async ({ page }) => {
    // Open editor
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "Edit" }).first().click();
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });

    // Expand first bundle rule
    await page.getByText("Visits with procedures").click();

    // Should see Bundle Price input but NO Rule Type select or Cap Qty input
    await expect(page.getByText("Bundle Price")).toBeVisible();
    await expect(page.locator("option[value='capped']")).toHaveCount(0);
    await expect(page.getByText("Cap Qty")).not.toBeVisible();
  });

  test("can expand bundle rule and see target multi-select", async ({ page }) => {
    // Open editor
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "Edit" }).first().click();
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });

    // Expand first bundle rule
    await page.getByText("Visits with procedures").click();

    // Should see "Services Included" section
    await expect(page.getByText("Services Included")).toBeVisible();

    // Should see "Entire category" label in the multi-select button
    await expect(page.getByText("Entire category")).toBeVisible();
  });

  test("multi-select dropdown opens with checkboxes", async ({ page }) => {
    // Open editor
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "Edit" }).first().click();
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });

    // Expand the labs bundle rule (second one)
    await page.getByText("Visits with labs").click();

    // Click the multi-select button that shows "Entire category"
    const multiSelectBtn = page.locator("button", { hasText: "Entire category" }).first();
    await multiSelectBtn.click();

    // Dropdown should appear with checkboxes
    const dropdown = page.locator(".absolute.z-20");
    await expect(dropdown).toBeVisible();

    // "Entire category" checkbox should be checked
    const entireCategoryCheckbox = dropdown.locator("label", { hasText: "Entire category" }).locator("input[type='checkbox']");
    await expect(entireCategoryCheckbox).toBeChecked();
  });

  test("can add a new bundle rule", async ({ page }) => {
    // Open editor
    await expect(page.getByText("Standard")).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "Edit" }).first().click();
    await expect(page.locator('input[name="priceListName"]')).toBeVisible({ timeout: 15_000 });

    // Click "+ Add Rule"
    await page.locator("button", { hasText: "+ Add Rule" }).click();

    // A new "Untitled Rule" should appear
    await expect(page.getByText("Untitled Rule")).toBeVisible();
  });
});
