import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../../fixtures/page-objects/onboarding.page";

test.describe("affiliate section navigation", () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
  });

  test("sidebar renders all visible affiliate section titles", async () => {
    const titles = await onboarding.getNavSectionTitles();
    // Visible sections (hidden: false) per SECTIONS array
    expect(titles).toContain("Company & Contacts");
    expect(titles).toContain("Your Plan");
    expect(titles).toContain("Payouts & Payments");
    expect(titles).toContain("Care Network");
    expect(titles).toContain("Review & Submit");
  });

  test("hidden sections not in sidebar", async () => {
    const titles = await onboarding.getNavSectionTitles();
    // Sections 3 and 9 are hidden: true
    expect(titles).not.toContain("In-Person & Extended Services");
    expect(titles).not.toContain("Care Navigation");
  });

  test("Section 1 is active by default", async () => {
    const isActive = await onboarding.isSectionActive("Company & Contacts");
    expect(isActive).toBe(true);
  });

  test("clicking Section 1 shows its heading", async () => {
    await onboarding.navigateToSection("Company & Contacts");
    const heading = await onboarding.getCurrentSectionTitle();
    expect(heading).toContain("Company & Contacts");
  });

  test("Section 2 is locked (prerequisite: Section 1)", async () => {
    const isLocked = await onboarding.isSectionLocked("Your Plan");
    expect(isLocked).toBe(true);
  });

  test("Section 4 is locked (prerequisite: Section 1)", async () => {
    const isLocked = await onboarding.isSectionLocked("Payouts & Payments");
    expect(isLocked).toBe(true);
  });

  test("Section 5 is locked (prerequisite: Sections 1, 2)", async () => {
    const isLocked = await onboarding.isSectionLocked("Care Network");
    expect(isLocked).toBe(true);
  });

  test("Review & Submit is locked (prerequisite: Sections 1, 2, 4, 5)", async () => {
    const isLocked = await onboarding.isSectionLocked("Review & Submit");
    expect(isLocked).toBe(true);
  });

  test("no flow tab bar for affiliate-only org", async () => {
    const visible = await onboarding.isFlowTabBarVisible();
    expect(visible).toBe(false);
  });
});
