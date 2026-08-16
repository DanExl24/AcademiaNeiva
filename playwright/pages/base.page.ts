import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getCurrentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }

  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((k) => localStorage.getItem(k), key);
  }

  async clearSession() {
    try {
      const url = this.page.url();
      if (url && !url.startsWith('about:')) {
        await this.page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (_) {}
        });
      }
    } catch (_) {
      // Ignorar si el contexto actual no permite acceso al storage
    }
  }


  async expectPath(pathRegexOrString: string | RegExp) {
    if (typeof pathRegexOrString === 'string') {
      await expect(this.page).toHaveURL(new RegExp(pathRegexOrString));
    } else {
      await expect(this.page).toHaveURL(pathRegexOrString);
    }
  }
}
