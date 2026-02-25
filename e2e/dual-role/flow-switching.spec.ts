import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../fixtures/page-objects/onboarding.page";

test.describe("dual-role flow switching", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
  });

  test("tab bar is visible for dual-role org", async () => {
    const visible = await onboarding.isFlowTabBarVisible();
    expect(visible).toBe(true);
  });

  test("defaults to affiliate flow (Plan Onboarding)", async () => {
    const titles = await onboarding.getNavSectionTitles();
    expect(titles).toContain("Company & Contacts");
  });

  test("switching to seller flow shows seller sections", async () => {
    await onboarding.switchFlow("Care Delivery Onboarding");
    const titles = await onboarding.getNavSectionTitles();
    expect(titles).toContain("Organization Info");
    expect(titles).toContain("Default Services Offered");
    expect(titles).toContain("Physical Locations");
    expect(titles).toContain("Payment Account");
    expect(titles).toContain("Review & Submit");
  });

  test("switching back to affiliate flow shows affiliate sections", async () => {
    await onboarding.switchFlow("Care Delivery Onboarding");
    await onboarding.switchFlow("Plan Onboarding");
    const titles = await onboarding.getNavSectionTitles();
    expect(titles).toContain("Company & Contacts");
    expect(titles).toContain("Your Plan");
  });
});
