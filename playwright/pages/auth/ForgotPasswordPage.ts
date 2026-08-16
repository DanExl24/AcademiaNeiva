import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class ForgotPasswordPage extends BasePage {
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly backToLoginLink: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('#email');
    this.submitButton = page.locator('button[type="submit"]');
    this.backToLoginLink = page.locator('text=Volver al inicio de sesión');
    this.successMessage = page.locator('.text-green-700');
    this.errorMessage = page.locator('.text-red-600');
  }

  async goto() {
    await this.page.goto('/forgot-password');
    await this.waitForPageLoad();
  }

  async requestReset(email: string) {
    if (email) {
      await this.emailInput.fill(email);
    }
    await this.submitButton.click();
  }

  async expectSuccessMessage() {
    await expect(this.successMessage).toBeVisible({ timeout: 10000 });
  }

  async expectErrorMessage(text?: string) {
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
    if (text) {
      await expect(this.errorMessage).toContainText(text);
    }
  }
}
