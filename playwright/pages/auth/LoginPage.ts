import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly backHomeLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('#emailOrCode');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.forgotPasswordLink = page.locator('a[href="/forgot-password"]');
    this.backHomeLink = page.locator('text=Volver al inicio');
    this.errorMessage = page.locator('.text-red-400');
  }

  async goto() {
    await this.page.goto('/login');
    await this.waitForPageLoad();
  }

  async login(emailOrCode: string, password: string) {
    if (emailOrCode) {
      await this.emailInput.fill(emailOrCode);
    }
    if (password) {
      await this.passwordInput.fill(password);
    }
    await this.submitButton.click();
  }

  async getErrorMessage(): Promise<string> {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return (await this.errorMessage.textContent())?.trim() || '';
  }

  async expectErrorMessage(expectedText: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (typeof expectedText === 'string') {
      await expect(this.errorMessage).toContainText(expectedText);
    } else {
      await expect(this.errorMessage).toHaveText(expectedText);
    }
  }

  async expectLoginSuccess(expectedRedirectPattern: string | RegExp = /(dashboard|select-school)/) {
    await expect(this.page).toHaveURL(expectedRedirectPattern, { timeout: 10000 });
    const token = await this.getLocalStorageItem('token');
    expect(token).toBeTruthy();
  }
}
