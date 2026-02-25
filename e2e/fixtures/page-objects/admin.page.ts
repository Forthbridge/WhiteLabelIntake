import { type Page, type Locator, expect } from "@playwright/test";

export class AdminPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1");
    this.searchInput = page.locator("input[type='search'], input[placeholder*='Search']");
  }

  async gotoClients() {
    await this.page.goto("/admin");
    await this.heading.waitFor({ state: "visible", timeout: 15_000 });
  }

  async gotoUsers() {
    await this.page.goto("/admin/users");
    await this.heading.waitFor({ state: "visible", timeout: 15_000 });
  }

  async gotoCreateClient() {
    await this.page.goto("/admin/create-client");
    await this.heading.waitFor({ state: "visible", timeout: 15_000 });
  }

  async gotoAffiliateDetail(affiliateId: string) {
    await this.page.goto(`/admin/affiliates/${affiliateId}`);
    await this.heading.waitFor({ state: "visible", timeout: 15_000 });
  }

  /** Search in the current list view */
  async search(query: string) {
    await this.searchInput.fill(query);
    // Debounce delay
    await this.page.waitForTimeout(400);
  }

  /** Select status filter on clients page */
  async filterByStatus(status: "all" | "DRAFT" | "SUBMITTED") {
    await this.page.locator("select").selectOption(status);
  }

  /** Select role filter on users page */
  async filterByRole(role: "all" | "ADMIN" | "COLLABORATOR") {
    await this.page.locator("select").selectOption(role);
  }

  /** Click an affiliate card by legal name */
  async clickAffiliateCard(legalName: string) {
    await this.page.locator("h3", { hasText: legalName }).click();
    await this.heading.waitFor({ state: "visible", timeout: 10_000 });
  }

  /** Get the count of visible affiliate/user cards */
  async getCardCount(): Promise<number> {
    return this.page.locator("[class*='Card']").count();
  }
}
