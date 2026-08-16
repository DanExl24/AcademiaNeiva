import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class ColegiosPage extends BasePage {
  readonly searchInput: Locator;
  readonly statusFilterSelect: Locator;
  readonly registerButton: Locator;
  readonly collegeCards: Locator;
  readonly statsTotal: Locator;
  readonly statsActivos: Locator;

  // Modal Crear/Editar
  readonly modalContainer: Locator;
  readonly modalTitle: Locator;
  readonly inputNombre: Locator;
  readonly inputDane: Locator;
  readonly selectTipoColegio: Locator;
  readonly inputSede: Locator;
  readonly inputCorreo: Locator;
  readonly inputContacto: Locator;
  readonly selectCalendario: Locator;
  readonly submitModalButton: Locator;

  // Modal Detalles
  readonly detailsModal: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.locator('input[placeholder*="Buscar por nombre"]');
    this.statusFilterSelect = page.locator('select:has-text("Todos los estados"), select:has-text("Activos")').first();
    this.registerButton = page.locator('button:has-text("Registrar Colegio")');
    this.collegeCards = page.locator('.grid > div.bg-white, .grid > div.dark\\:bg-slate-900');
    this.statsTotal = page.locator('div:has-text("TOTAL") h3').first();
    this.statsActivos = page.locator('div:has-text("ACTIVOS") h3').first();

    this.modalContainer = page.locator('.fixed.inset-0.z-\\[100\\]');
    this.modalTitle = page.locator('.fixed.inset-0.z-\\[100\\] h2');
    this.inputNombre = page.locator('input[placeholder*="Colegio San José"]');
    this.inputDane = page.locator('input[placeholder*="14100100123"]');
    this.selectTipoColegio = page.locator('select:has-text("OFICIAL")');
    this.inputSede = page.locator('input[placeholder*="Sede Central"]');
    this.inputCorreo = page.locator('input[placeholder*="rectoria@colegio.edu.co"]');
    this.inputContacto = page.locator('input[placeholder*="3123456789"]');
    this.selectCalendario = page.locator('select:has-text("Calendario A")');
    this.submitModalButton = page.locator('button:has-text("Confirmar"), button:has-text("Guardar")');

    this.detailsModal = page.locator('div:has-text("Información Institucional")');
  }

  async goto() {
    await this.page.goto('/dashboard/colegios');
    await this.waitForPageLoad();
  }

  async openCreateModal() {
    await this.registerButton.click();
    await expect(this.modalContainer).toBeVisible();
  }

  async fillForm(data: {
    nombre: string;
    dane: string;
    tipo?: string;
    sede?: string;
    correo: string;
    contacto?: string;
    calendario?: string;
  }) {
    if (data.nombre) await this.inputNombre.fill(data.nombre);
    if (data.dane) await this.inputDane.fill(data.dane);
    if (data.sede) await this.inputSede.fill(data.sede);
    if (data.correo) await this.inputCorreo.fill(data.correo);
    if (data.contacto) await this.inputContacto.fill(data.contacto);
    if (data.tipo) await this.selectTipoColegio.selectOption({ label: data.tipo });
    if (data.calendario) await this.selectCalendario.selectOption({ value: data.calendario });
  }

  async submitForm() {
    await this.submitModalButton.click();
  }

  async searchCollege(term: string) {
    await this.searchInput.fill(term);
    await this.page.waitForTimeout(500); // Pequeña espera para debounce de Vue
  }

  async getCollegeCard(nameOrDane: string): Promise<Locator> {
    return this.page.locator(`.grid > div:has-text("${nameOrDane}")`).first();
  }

  async expectCollegeVisible(name: string) {
    await expect(this.page.locator(`h3:has-text("${name}")`).first()).toBeVisible({ timeout: 8000 });
  }
}
