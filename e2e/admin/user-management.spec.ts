import { test, expect } from "@playwright/test";
import { AdminPage } from "../fixtures/page-objects/admin.page";

test.describe("admin: user list", () => {
  let admin: AdminPage;

  test.beforeEach(async ({ page }) => {
    admin = new AdminPage(page);
    await admin.gotoUsers();
  });

  test("page renders with heading and search bar", async ({ page }) => {
    await expect(admin.heading).toHaveText("Users");
    await expect(admin.searchInput).toBeVisible();
  });

  test("role filter dropdown is visible with options", async ({ page }) => {
    const select = page.locator("select");
    await expect(select).toBeVisible();
    await expect(select.locator("option")).toHaveCount(3); // All, Admin, Collaborator
  });

  test("seeded users are displayed", async ({ page }) => {
    // Seed creates several e2e users
    await expect(page.getByText("e2e-buyer-admin@test.com")).toBeVisible();
    await expect(page.getByText("e2e-seller-admin@test.com")).toBeVisible();
  });

  test("search filters users by email", async ({ page }) => {
    await admin.search("e2e-collab");
    await expect(page.getByText("e2e-collab@test.com")).toBeVisible();
    await expect(page.getByText("e2e-buyer-admin@test.com")).not.toBeVisible();
  });

  test("search filters users by affiliate name", async ({ page }) => {
    await admin.search("E2E Buyer");
    // Buyer affiliate has buyer-admin and collab users
    await expect(page.getByText("e2e-buyer-admin@test.com")).toBeVisible();
    await expect(page.getByText("e2e-collab@test.com")).toBeVisible();
    // Seller user should not appear
    await expect(page.getByText("e2e-seller-admin@test.com")).not.toBeVisible();
  });

  test("role filter shows only admins", async ({ page }) => {
    await admin.filterByRole("ADMIN");
    await expect(page.getByText("e2e-buyer-admin@test.com")).toBeVisible();
    // Collaborator should not appear
    await expect(page.getByText("e2e-collab@test.com")).not.toBeVisible();
  });

  test("role filter shows only collaborators", async ({ page }) => {
    await admin.filterByRole("COLLABORATOR");
    await expect(page.getByText("e2e-collab@test.com")).toBeVisible();
    // Admins should not appear
    await expect(page.getByText("e2e-buyer-admin@test.com")).not.toBeVisible();
  });

  test("search with no results shows empty state", async ({ page }) => {
    await admin.search("nonexistent-zzz-12345");
    await expect(page.getByText("No users found.")).toBeVisible();
  });
});
