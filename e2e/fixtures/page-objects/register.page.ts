import { type Page, type Locator } from "@playwright/test";

export class RegisterPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input[name="name"]');
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    this.submitButton = page.getByRole("button", { name: "Create Account" });
    this.errorBanner = page.locator("div.text-error");
  }

  async goto() {
    await this.page.goto("/register");
  }

  async fillForm(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword);
  }

  async submit() {
    await this.submitButton.click();
  }

  async getErrorMessage(): Promise<string> {
    await this.errorBanner.waitFor({ state: "visible" });
    return this.errorBanner.innerText();
  }
}
