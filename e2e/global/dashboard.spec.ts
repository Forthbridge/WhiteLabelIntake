import { test, expect } from "@playwright/test";

test.describe("admin access & role gate", () => {
  test("super-admin accessing /admin stays on admin", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/super-admin.json",
    });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin");
    await expect(page.locator("h1")).toHaveText("Clients");
    await context.close();
  });

  test("buyer-admin accessing /admin redirects to /onboarding", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/buyer-admin.json",
    });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10_000 });
    await context.close();
  });

  test("super-admin accessing /onboarding redirects to /admin", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/super-admin.json",
    });
    const page = await context.newPage();
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
    await context.close();
  });

  test("admin top nav links are visible", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/super-admin.json",
    });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page.locator("a", { hasText: "Clients" })).toBeVisible();
    await expect(page.locator("a", { hasText: "Users" })).toBeVisible();
    await expect(page.locator("a", { hasText: "+ New Client" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Sign Out" })).toBeVisible();
    await context.close();
  });

  test("admin nav links navigate correctly", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/super-admin.json",
    });
    const page = await context.newPage();
    await page.goto("/admin");

    // Navigate to Users
    await page.locator("a", { hasText: "Users" }).click();
    await expect(page).toHaveURL("/admin/users");
    await expect(page.locator("h1")).toHaveText("Users");

    // Navigate to Create Client
    await page.locator("a", { hasText: "+ New Client" }).click();
    await expect(page).toHaveURL("/admin/create-client");
    await expect(page.locator("h1")).toHaveText("Create New Client");

    // Navigate back to Clients
    await page.locator("a", { hasText: "Clients" }).click();
    await expect(page).toHaveURL("/admin");
    await expect(page.locator("h1")).toHaveText("Clients");

    await context.close();
  });
});
