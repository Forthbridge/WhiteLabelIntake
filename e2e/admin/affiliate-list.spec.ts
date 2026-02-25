import { test, expect } from "@playwright/test";
import { AdminPage } from "../fixtures/page-objects/admin.page";

test.describe("admin: client list", () => {
  let admin: AdminPage;

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page);
    await admin.gotoClients();
  });

  test("page renders with heading and search bar", async ({ page }) => {
    await expect(admin.heading).toHaveText("Clients");
    await expect(admin.searchInput).toBeVisible();
  });

  test("status filter dropdown is visible with options", async ({ page }) => {
    const select = page.locator("select");
    await expect(select).toBeVisible();
    await expect(select.locator("option")).toHaveCount(3); // All, Draft, Submitted
  });

  test("seeded affiliates are displayed", async ({ page }) => {
    // Seed creates E2E Buyer Corp, E2E Seller Corp, E2E Dual Corp
    await expect(page.locator("h3", { hasText: "E2E Buyer Corp" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "E2E Seller Corp" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "E2E Dual Corp" })).toBeVisible();
  });

  test("search filters affiliates by name", async ({ page }) => {
    await admin.search("Buyer");
    await expect(page.locator("h3", { hasText: "E2E Buyer Corp" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "E2E Seller Corp" })).not.toBeVisible();
    await expect(page.locator("h3", { hasText: "E2E Dual Corp" })).not.toBeVisible();
  });

  test("search filters affiliates by admin email", async ({ page }) => {
    await admin.search("e2e-seller-admin");
    await expect(page.locator("h3", { hasText: "E2E Seller Corp" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "E2E Buyer Corp" })).not.toBeVisible();
  });

  test("search with no results shows empty state", async ({ page }) => {
    await admin.search("nonexistent-zzz-12345");
    await expect(page.getByText("No clients found.")).toBeVisible();
  });

  test("clicking affiliate card navigates to detail", async ({ page }) => {
    await admin.clickAffiliateCard("E2E Buyer Corp");
    await expect(page).toHaveURL(/\/admin\/affiliates\//);
    await expect(admin.heading).toHaveText("E2E Buyer Corp");
  });
});
