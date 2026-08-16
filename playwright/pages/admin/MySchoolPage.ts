import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class MySchoolPage extends BasePage {
  readonly tabGeneral: Locator;
  readonly tabIdentity: Locator;
  readonly schoolNameText: Locator;
  readonly schoolDaneText: Locator;
  readonly kpisEstudiantes: Locator;
  readonly kpisDocentes: Locator;

  // Identidad Visual Tab
  readonly saveIdentityButton: Locator;
  readonly resetIdentityButton: Locator;
  readonly inputColorPrimario: Locator;
  readonly inputColorSecundario: Locator;
  readonly shieldImagePreview: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    super(page);
    this.tabGeneral = page.locator('button:has-text("Información General")');
    this.tabIdentity = page.locator('button:has-text("Identidad Visual")');

    this.schoolNameText = page.locator('div:has-text("Nombre del Colegio") p.font-extrabold').first();
    this.schoolDaneText = page.locator('div:has-text("Código DANE") p.font-bold').first();
    this.kpisEstudiantes = page.locator('div:has-text("Estudiantes Activos") h3').first();
    this.kpisDocentes = page.locator('div:has-text("Docentes Activos") h3').first();

    this.saveIdentityButton = page.locator('button:has-text("Guardar Cambios")');
    this.resetIdentityButton = page.locator('button:has-text("Restablecer por defecto")');
    this.inputColorPrimario = page.locator('div:has-text("Color Primario") input[type="text"]').first();
    this.inputColorSecundario = page.locator('div:has-text("Color Secundario") input[type="text"]').first();
    this.shieldImagePreview = page.locator('img[alt*="Escudo"]');
    this.successToast = page.locator('.text-emerald-600, .bg-emerald-50, div:has-text("guardada exitosamente")');
  }

  async goto() {
    await this.page.goto('/dashboard/mi-colegio');
    await this.waitForPageLoad();
  }

  async switchTab(tab: 'general' | 'identity') {
    if (tab === 'general') {
      await this.tabGeneral.click();
    } else {
      await this.tabIdentity.click();
    }
  }

  async updateColors(primaryHex: string, secondaryHex?: string) {
    await this.switchTab('identity');
    if (await this.inputColorPrimario.isVisible()) {
      await this.inputColorPrimario.fill(primaryHex);
    }
    if (secondaryHex && (await this.inputColorSecundario.isVisible())) {
      await this.inputColorSecundario.fill(secondaryHex);
    }
    if (await this.saveIdentityButton.isVisible()) {
      await this.saveIdentityButton.click();
    }
  }
}
