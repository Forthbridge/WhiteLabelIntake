import { test, expect } from "@playwright/test";
import { RegisterPage } from "../fixtures/page-objects/register.page";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("register page", () => {
  test("renders name, email, password, confirm fields and button", async ({
    page,
  }) => {
    const reg = new RegisterPage(page);
    await reg.goto();
    await expect(reg.nameInput).toBeVisible();
    await expect(reg.emailInput).toBeVisible();
    await expect(reg.passwordInput).toBeVisible();
    await expect(reg.confirmPasswordInput).toBeVisible();
    await expect(reg.submitButton).toBeVisible();
  });

  test("shows error for password mismatch", async ({ page }) => {
    const reg = new RegisterPage(page);
    await reg.goto();
    await reg.fillForm({
      name: "Test User",
      email: "mismatch@test.com",
      password: "TestPass123!",
      confirmPassword: "DifferentPass!",
    });
    await reg.submit();
    const error = await reg.getErrorMessage();
    expect(error).toContain("Passwords do not match");
  });

  test("shows error for password too short", async ({ page }) => {
    const reg = new RegisterPage(page);
    await reg.goto();
    await reg.fillForm({
      name: "Test User",
      email: "short@test.com",
      password: "short",
      confirmPassword: "short",
    });
    await reg.submit();
    const error = await reg.getErrorMessage();
    expect(error).toContain("at least 8 characters");
  });

  test("successful registration redirects to /onboarding", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const reg = new RegisterPage(page);
    await reg.goto();
    await reg.fillForm({
      name: "E2E New User",
      email: `e2e-newuser-${timestamp}@test.com`,
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
    });
    await reg.submit();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("shows error for duplicate email", async ({ page }) => {
    const reg = new RegisterPage(page);
    await reg.goto();
    await reg.fillForm({
      name: "Duplicate User",
      email: "e2e-buyer-admin@test.com",
      password: "TestPass123!",
      confirmPassword: "TestPass123!",
    });
    await reg.submit();
    const error = await reg.getErrorMessage();
    expect(error).toContain("already exists");
  });
});
