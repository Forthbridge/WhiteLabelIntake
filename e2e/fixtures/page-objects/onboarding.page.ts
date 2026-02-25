import { type Page, type Locator, expect } from "@playwright/test";

export class OnboardingPage {
  readonly page: Page;
  readonly nav: Locator;
  readonly sectionHeading: Locator;
  readonly stepCounter: Locator;
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly prerequisiteBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nav = page.locator("nav");
    this.sectionHeading = page.locator("main h1");
    this.stepCounter = page.locator("main p.uppercase");
    this.nextButton = page.locator("main").getByRole("button", { name: /Next/ });
    this.prevButton = page.locator("main").getByRole("button", { name: /Previous/ });
    this.prerequisiteBanner = page.getByText("Complete these sections first:");
  }

  async goto() {
    await this.page.goto("/onboarding");
    await this.sectionHeading.waitFor({ state: "visible", timeout: 15_000 });
  }

  /** Click a nav item by its visible section title text */
  async navigateToSection(title: string) {
    await this.nav.getByRole("button", { name: title, exact: true }).click();
    // Wait for heading to update
    await expect(this.sectionHeading).toContainText(title, { timeout: 10_000 });
  }

  /** Get the active section heading text */
  async getCurrentSectionTitle(): Promise<string> {
    return this.sectionHeading.innerText();
  }

  /** Check if a nav item has the "complete" checkmark (svg with text-success class) */
  async isSectionComplete(title: string): Promise<boolean> {
    const navItem = this.nav.getByRole("button", { name: title, exact: true });
    const checkmark = navItem.locator("svg.text-success");
    return checkmark.isVisible();
  }

  /** Check if a nav item is locked (has title tooltip attribute) */
  async isSectionLocked(title: string): Promise<boolean> {
    const navItem = this.nav.getByRole("button", { name: title, exact: true });
    const titleAttr = await navItem.getAttribute("title");
    return titleAttr !== null && titleAttr.length > 0;
  }

  /** Check if a nav item is active (has the teal highlight class) */
  async isSectionActive(title: string): Promise<boolean> {
    const navItem = this.nav.getByRole("button", { name: title, exact: true });
    const className = await navItem.getAttribute("class");
    return className?.includes("text-brand-teal") ?? false;
  }

  /** Get all visible nav section titles */
  async getNavSectionTitles(): Promise<string[]> {
    const buttons = this.nav.locator("button span.truncate");
    return buttons.allInnerTexts();
  }

  /** Click "Plan Onboarding" or "Care Delivery Onboarding" tab */
  async switchFlow(tab: "Plan Onboarding" | "Care Delivery Onboarding") {
    await this.page.getByRole("button", { name: tab, exact: true }).click();
    // Wait for nav to update
    await this.page.waitForTimeout(500);
  }

  /** Check if the flow tab bar is visible */
  async isFlowTabBarVisible(): Promise<boolean> {
    return this.page
      .getByRole("button", { name: "Plan Onboarding", exact: true })
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickPrevious() {
    await this.prevButton.click();
  }
}
