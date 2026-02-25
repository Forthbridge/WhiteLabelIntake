import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

test.describe("affiliate section 1: company & contacts", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
    // Ensure we're on Section 1
    await onboarding.navigateToSection("Company & Contacts");
  });

  test("section renders with heading and all fields", async ({ page }) => {
    await expect(onboarding.sectionHeading).toContainText("Company & Contacts");
    await expect(page.locator('input[name="legalName"]')).toBeVisible();
    await expect(page.locator('input[name="adminContactName"]')).toBeVisible();
    await expect(page.locator('input[name="adminContactEmail"]')).toBeVisible();
    await expect(page.locator('input[name="executiveSponsorName"]')).toBeVisible();
    await expect(page.locator('input[name="executiveSponsorEmail"]')).toBeVisible();
    await expect(page.locator('input[name="itContactName"]')).toBeVisible();
    await expect(page.locator('input[name="itContactEmail"]')).toBeVisible();
    await expect(page.locator('input[name="itContactPhone"]')).toBeVisible();
  });

  test("fill all fields, save via Next, values persist on return", async ({
    page,
  }) => {
    // Fill all fields
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page
      .locator('input[name="adminContactEmail"]')
      .fill("jane@e2etest.com");
    await page
      .locator('input[name="executiveSponsorName"]')
      .fill("Bob Exec");
    await page
      .locator('input[name="executiveSponsorEmail"]')
      .fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");
    await page
      .locator('input[name="itContactEmail"]')
      .fill("carol@e2etest.com");
    await page.locator('input[name="itContactPhone"]').fill("555-0100");

    // Click Next to save
    await onboarding.clickNext();

    // Should navigate away from Section 1
    await expect(onboarding.sectionHeading).not.toContainText(
      "Company & Contacts",
      { timeout: 10_000 },
    );

    // Navigate back to Section 1
    await onboarding.navigateToSection("Company & Contacts");

    // Verify all values persisted
    await expect(page.locator('input[name="legalName"]')).toHaveValue(
      "E2E Test Corp",
    );
    await expect(page.locator('input[name="adminContactName"]')).toHaveValue(
      "Jane Admin",
    );
    await expect(page.locator('input[name="adminContactEmail"]')).toHaveValue(
      "jane@e2etest.com",
    );
    await expect(
      page.locator('input[name="executiveSponsorName"]'),
    ).toHaveValue("Bob Exec");
    await expect(
      page.locator('input[name="executiveSponsorEmail"]'),
    ).toHaveValue("bob@e2etest.com");
    await expect(page.locator('input[name="itContactName"]')).toHaveValue(
      "Carol IT",
    );
    await expect(page.locator('input[name="itContactEmail"]')).toHaveValue(
      "carol@e2etest.com",
    );
    await expect(page.locator('input[name="itContactPhone"]')).toHaveValue(
      "555-0100",
    );
  });

  test("Section 1 shows complete after saving all required fields", async ({
    page,
  }) => {
    // Fill all required fields (6 fields needed for completion)
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page
      .locator('input[name="adminContactEmail"]')
      .fill("jane@e2etest.com");
    await page
      .locator('input[name="executiveSponsorName"]')
      .fill("Bob Exec");
    await page
      .locator('input[name="executiveSponsorEmail"]')
      .fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");

    // Save
    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText(
      "Company & Contacts",
      { timeout: 10_000 },
    );

    // Check completion status
    const isComplete = await onboarding.isSectionComplete(
      "Company & Contacts",
    );
    expect(isComplete).toBe(true);
  });

  test("Section 2 unlocks after Section 1 is complete", async ({ page }) => {
    // Fill required fields and save
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page
      .locator('input[name="adminContactEmail"]')
      .fill("jane@e2etest.com");
    await page
      .locator('input[name="executiveSponsorName"]')
      .fill("Bob Exec");
    await page
      .locator('input[name="executiveSponsorEmail"]')
      .fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");

    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText(
      "Company & Contacts",
      { timeout: 10_000 },
    );

    // Section 2 (Your Plan) should now be unlocked (prereq [1] met)
    const isLocked = await onboarding.isSectionLocked("Your Plan");
    expect(isLocked).toBe(false);
  });

  test("Section 4 unlocks after Section 1 is complete", async ({ page }) => {
    // Fill required fields and save
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page
      .locator('input[name="adminContactEmail"]')
      .fill("jane@e2etest.com");
    await page
      .locator('input[name="executiveSponsorName"]')
      .fill("Bob Exec");
    await page
      .locator('input[name="executiveSponsorEmail"]')
      .fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");

    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText(
      "Company & Contacts",
      { timeout: 10_000 },
    );

    // Section 4 (Payouts & Payments) should now be unlocked (prereq [1] met)
    const isLocked = await onboarding.isSectionLocked("Payouts & Payments");
    expect(isLocked).toBe(false);
  });

  test("Section 5 still locked after only Section 1 complete", async ({
    page,
  }) => {
    // Fill required fields and save
    await page.locator('input[name="legalName"]').fill("E2E Test Corp");
    await page.locator('input[name="adminContactName"]').fill("Jane Admin");
    await page
      .locator('input[name="adminContactEmail"]')
      .fill("jane@e2etest.com");
    await page
      .locator('input[name="executiveSponsorName"]')
      .fill("Bob Exec");
    await page
      .locator('input[name="executiveSponsorEmail"]')
      .fill("bob@e2etest.com");
    await page.locator('input[name="itContactName"]').fill("Carol IT");

    await onboarding.clickNext();
    await expect(onboarding.sectionHeading).not.toContainText(
      "Company & Contacts",
      { timeout: 10_000 },
    );

    // Section 5 (Care Network) needs prereqs [1, 2] — Section 2 not yet complete
    const isLocked = await onboarding.isSectionLocked("Care Network");
    expect(isLocked).toBe(true);
  });
});
