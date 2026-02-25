import { test, expect } from "@playwright/test";
import { AdminPage } from "../fixtures/page-objects/admin.page";

test.describe("admin: affiliate detail", () => {
  let admin: AdminPage;

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page);
    // Navigate to buyer affiliate detail via the list
    await admin.gotoClients();
    await admin.clickAffiliateCard("E2E Buyer Corp");
  });

  test("detail page renders with affiliate name and back link", async ({ page }) => {
    await expect(admin.heading).toHaveText("E2E Buyer Corp");
    await expect(page.getByText("Back to Clients")).toBeVisible();
  });

  test("edit form button is visible", async ({ page }) => {
    await expect(page.locator("a", { hasText: "Edit Form" })).toBeVisible();
  });

  test("delete button is visible", async ({ page }) => {
    await expect(page.locator("button", { hasText: "Delete" })).toBeVisible();
  });

  test("organization roles card shows correct flags", async ({ page }) => {
    await expect(page.locator("h2", { hasText: "Organization Roles" })).toBeVisible();
    // Buyer is isAffiliate=true, isSeller=false
    const affiliateCheckbox = page.locator("label", { hasText: "Affiliate (Plan Buyer)" }).locator("input[type='checkbox']");
    const sellerCheckbox = page.locator("label", { hasText: "Seller (Care Delivery)" }).locator("input[type='checkbox']");
    await expect(affiliateCheckbox).toBeChecked();
    await expect(sellerCheckbox).not.toBeChecked();
  });

  test("marketplace checkbox visible for affiliates", async ({ page }) => {
    const mktCheckbox = page.locator("label", { hasText: "Enable Marketplace" }).locator("input[type='checkbox']");
    await expect(mktCheckbox).toBeVisible();
    // Buyer has marketplaceEnabled=true
    await expect(mktCheckbox).toBeChecked();
  });

  test("phase progression card shows status", async ({ page }) => {
    await expect(page.locator("h2", { hasText: "Phase Progression" })).toBeVisible();
    // Buyer affiliate is DRAFT, so status badge should say "In Progress"
    await expect(page.getByText("Phase 1:")).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
  });

  test("completion card shows progress bar", async ({ page }) => {
    await expect(page.locator("h2", { hasText: "Completion" })).toBeVisible();
    // Progress percentage text (e.g. "0%", "50%", "100%")
    await expect(page.getByText(/\d+%/)).toBeVisible();
  });

  test("marketplace visibility card is visible", async ({ page }) => {
    await expect(page.locator("h2", { hasText: "Marketplace Visibility" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Add Visibility" })).toBeVisible();
  });

  test("users card shows affiliate users", async ({ page }) => {
    await expect(page.locator("h2", { hasText: "Users" })).toBeVisible();
    // Buyer has 2 users: e2e-buyer-admin and e2e-collab
    await expect(page.getByText("e2e-buyer-admin@test.com")).toBeVisible();
    await expect(page.getByText("e2e-collab@test.com")).toBeVisible();
  });

  test("existing network contract is displayed", async ({ page }) => {
    // Seed created a contract from buyer → seller
    // Wait for contracts to load asynchronously
    await expect(page.getByText("E2E Seller Corp")).toBeVisible({ timeout: 10_000 });
  });

  test("back link navigates to client list", async ({ page }) => {
    await page.getByText("Back to Clients").click();
    await expect(page).toHaveURL("/admin");
    await expect(admin.heading).toHaveText("Clients");
  });
});

test.describe("admin: seller affiliate detail", () => {
  let admin: AdminPage;

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page);
    await admin.gotoClients();
    await admin.clickAffiliateCard("E2E Seller Corp");
  });

  test("seller role is checked, affiliate role is not", async ({ page }) => {
    const affiliateCheckbox = page.locator("label", { hasText: "Affiliate (Plan Buyer)" }).locator("input[type='checkbox']");
    const sellerCheckbox = page.locator("label", { hasText: "Seller (Care Delivery)" }).locator("input[type='checkbox']");
    await expect(affiliateCheckbox).not.toBeChecked();
    await expect(sellerCheckbox).toBeChecked();
  });

  test("seller flow status card is visible", async ({ page }) => {
    await expect(page.locator("h2", { hasText: "Seller Flow" })).toBeVisible();
    await expect(page.getByText("Care Delivery Onboarding")).toBeVisible();
  });

  test("marketplace checkbox not visible for non-affiliates", async ({ page }) => {
    const mktLabel = page.locator("label", { hasText: "Enable Marketplace" });
    await expect(mktLabel).not.toBeVisible();
  });
});
