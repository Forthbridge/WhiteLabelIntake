import { test, expect } from "@playwright/test";
import { AdminPage } from "../fixtures/page-objects/admin.page";

// Create client tests modify shared state — run serially
test.describe.configure({ mode: "serial" });

test.describe("admin: create client", () => {
  let admin: AdminPage;

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page);
    await admin.gotoCreateClient();
  });

  test("page renders with heading and form fields", async ({ page }) => {
    await expect(admin.heading).toHaveText("Create New Client");
    await expect(page.locator('input[name="legalName"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("shows helper text for password field", async ({ page }) => {
    await expect(page.getByText("Leave blank to auto-generate")).toBeVisible();
  });

  test("name and email fields are required", async ({ page }) => {
    // HTML5 required attributes prevent form submission
    await expect(page.locator('input[name="name"]')).toHaveAttribute("required", "");
    await expect(page.locator('input[name="email"]')).toHaveAttribute("required", "");
  });

  test("successfully creates a client and redirects to detail", async ({ page }) => {
    await page.locator('input[name="legalName"]').fill("E2E Created Client");
    await page.locator('input[name="name"]').fill("E2E New Admin");
    await page.locator('input[name="email"]').fill("e2e-created-admin@test.com");
    await page.locator('input[name="password"]').fill("TestPass123!");
    await page.locator("button", { hasText: "Create Client" }).click();

    // Should redirect to the new affiliate's detail page
    await expect(page).toHaveURL(/\/admin\/affiliates\//, { timeout: 15_000 });
    await expect(admin.heading).toHaveText("E2E Created Client");
  });

  test("new client appears in client list", async ({ page }) => {
    await admin.gotoClients();
    await admin.search("E2E Created Client");
    await expect(page.locator("h3", { hasText: "E2E Created Client" })).toBeVisible();
  });
});
