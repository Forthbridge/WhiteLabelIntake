import { test, expect } from "@playwright/test";
import { LoginPage } from "../fixtures/page-objects/login.page";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("login page", () => {
  test("renders email, password, and Sign In button", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.emailInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.submitButton).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fillCredentials("wrong@test.com", "wrongpassword");
    await login.submit();
    const error = await login.getErrorMessage();
    expect(error).toContain("Invalid email or password");
  });

  test("valid buyer-admin login redirects to /onboarding", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fillCredentials("e2e-buyer-admin@test.com", "TestPass123!");
    await login.submit();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("valid super-admin login redirects to /admin", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fillCredentials("e2e-superadmin@test.com", "TestPass123!");
    await login.submit();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  });
});
