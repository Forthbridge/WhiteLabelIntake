import { test, expect } from "@playwright/test";
import path from "path";

const authDir = path.resolve(__dirname, "..", ".auth");

test.describe("unauthenticated user", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects /onboarding to /login", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("buyer-admin", () => {
  test.use({ storageState: path.join(authDir, "buyer-admin.json") });

  test("can access /onboarding", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("is redirected from /admin to /onboarding", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/onboarding/);
  });
});

test.describe("super-admin", () => {
  test.use({ storageState: path.join(authDir, "super-admin.json") });

  test("can access /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("is redirected from /onboarding to /admin", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/admin/);
  });
});
