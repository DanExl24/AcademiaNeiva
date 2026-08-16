import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class UsuariosPage extends BasePage {
  readonly searchInput: Locator;
  readonly roleFilterSelect: Locator;
  readonly stateFilterSelect: Locator;
  readonly schoolFilterSelect: Locator;
  readonly createUserButton: Locator;
  readonly usersTableRows: Locator;
  readonly statsTotal: Locator;
  readonly statsActivos: Locator;
  readonly statsSuspendidos: Locator;

  // Create User Modal
  readonly createUserModal: Locator;
  readonly selectNewUserRole: Locator;
  readonly selectNewUserSchool: Locator;
  readonly inputNewUserNombre: Locator;
  readonly inputNewUserApellido: Locator;
  readonly inputNewUserEmail: Locator;
  readonly inputNewUserPassword: Locator;
  readonly selectNewUserTipoDoc: Locator;
  readonly inputNewUserDocumento: Locator;
  readonly inputNewUserTelefono: Locator;
  readonly submitCreateUserButton: Locator;

  // Details Modal
  readonly detailsModal: Locator;

  // Reset Password Modal
  readonly resetModal: Locator;
  readonly tempPasswordText: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.locator('input[placeholder*="Buscar por nombre"]');
    this.roleFilterSelect = page.locator('select:has-text("Todos los roles")');
    this.stateFilterSelect = page.locator('select:has-text("Todos los estados")');
    this.schoolFilterSelect = page.locator('select:has-text("Todas las instituciones")');
    this.createUserButton = page.locator('button:has-text("Crear Usuario"), button:has-text("Crear Nuevo Usuario")');
    this.usersTableRows = page.locator('tbody tr');
    this.statsTotal = page.locator('div:has-text("Filtrados") h3').first();
    this.statsActivos = page.locator('div:has-text("Activos") h3').first();
    this.statsSuspendidos = page.locator('div:has-text("Suspendidos") h3').first();

    this.createUserModal = page.locator('.fixed.inset-0:has(h2:has-text("Crear Nuevo Usuario"))');
    this.selectNewUserRole = page.locator('.space-y-1\\.5:has-text("Rol de Usuario") select');
    this.selectNewUserSchool = page.locator('.space-y-1\\.5:has-text("Institución Educativa") select');
    this.inputNewUserNombre = page.locator('.space-y-1\\.5:has-text("Nombres") input');
    this.inputNewUserApellido = page.locator('.space-y-1\\.5:has-text("Apellidos") input');
    this.inputNewUserEmail = page.locator('.space-y-1\\.5:has-text("Correo Electrónico") input');
    this.inputNewUserPassword = page.locator('.space-y-1\\.5:has-text("Contraseña de Acceso") input');
    this.selectNewUserTipoDoc = page.locator('.space-y-1\\.5:has-text("Tipo de Documento") select');
    this.inputNewUserDocumento = page.locator('.space-y-1\\.5:has-text("Número de Documento") input');
    this.inputNewUserTelefono = page.locator('.space-y-1\\.5:has-text("Teléfono de Contacto") input');
    this.submitCreateUserButton = page.locator('button:has-text("Confirmar y Crear Usuario")');

    this.detailsModal = page.locator('div:has-text("ID de Cuenta:")');
    this.resetModal = page.locator('h2:has-text("Contraseña Restablecida")');
    this.tempPasswordText = page.locator('span.select-all');
  }

  async goto() {
    await this.page.goto('/dashboard/usuarios');
    await this.waitForPageLoad();
  }

  async openCreateUserModal() {
    await this.createUserButton.click();
    await expect(this.createUserModal).toBeVisible();
  }

  async fillCreateUserForm(data: {
    rol: string;
    colegio?: string;
    nombre: string;
    apellido?: string;
    email: string;
    password?: string;
    tipoDoc?: string;
    documento?: string;
    telefono?: string;
  }) {
    if (data.rol) await this.selectNewUserRole.selectOption({ value: data.rol });
    if (data.colegio && (await this.selectNewUserSchool.isVisible())) {
      await this.selectNewUserSchool.locator('option:not([value=""])').first().waitFor({ state: 'attached', timeout: 8000 });
      await this.selectNewUserSchool.selectOption({ index: 1 });
    }
    if (data.nombre) await this.inputNewUserNombre.fill(data.nombre);
    if (data.apellido) await this.inputNewUserApellido.fill(data.apellido);
    if (data.email) await this.inputNewUserEmail.fill(data.email);
    if (data.password) await this.inputNewUserPassword.fill(data.password);
    if (data.tipoDoc) await this.selectNewUserTipoDoc.selectOption({ value: data.tipoDoc });
    if (data.documento) await this.inputNewUserDocumento.fill(data.documento);
    if (data.telefono) await this.inputNewUserTelefono.fill(data.telefono);
  }

  async submitCreateUser() {
    await this.submitCreateUserButton.click();
  }

  async searchUser(term: string) {
    await this.searchInput.fill(term);
    await this.page.waitForTimeout(600);
  }

  async getUserRow(emailOrName: string): Promise<Locator> {
    return this.page.locator(`tbody tr:has-text("${emailOrName}")`).first();
  }
}
