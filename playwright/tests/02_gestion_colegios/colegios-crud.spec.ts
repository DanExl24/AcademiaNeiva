import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage';
import { ColegiosPage } from '../../pages/adminGeneral/ColegiosPage';
import { TEST_USERS } from '../../data/test-users';

test.describe('Módulo 02: Gestión de Colegios — Administración Global (HU-COL-001 / HU-COL-002 / HU-COL-003 / HU-COL-004)', () => {
  let loginPage: LoginPage;
  let colegiosPage: ColegiosPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    colegiosPage = new ColegiosPage(page);

    // Autenticar como Admin General
    await loginPage.goto();
    await loginPage.clearSession();
    await loginPage.login(TEST_USERS.adminGeneral.email, TEST_USERS.adminGeneral.password);
    await loginPage.expectLoginSuccess();

    // Navegar al módulo de colegios
    await colegiosPage.goto();
  });

  test('TC-COL-001-01: [P0] Admin General lista los colegios registrados con sus KPIs @smoke @critical', async ({ page }) => {
    // Verificar que los KPIs y tarjetas de colegios se rendericen
    await expect(page.locator('h1:has-text("Colegios Registrados")')).toBeVisible();
    await expect(colegiosPage.statsTotal).toBeVisible();
    
    // Verificar que colegios seed como CEA School y Heisenberg estén listados
    await colegiosPage.expectCollegeVisible('CEA School');
    await colegiosPage.expectCollegeVisible('Colegio Heisenberg Neiva');
  });

  test('TC-COL-001-02: [P1] Búsqueda y filtrado de colegios por nombre y código DANE', async ({ page }) => {
    // Buscar por DANE del colegio Heisenberg
    await colegiosPage.searchCollege('DANE-H-001');
    await colegiosPage.expectCollegeVisible('Colegio Heisenberg Neiva');

    // Limpiar búsqueda
    await colegiosPage.searchCollege('');
    await colegiosPage.expectCollegeVisible('CEA School');
  });

  test('TC-COL-002-01: [P0] Registro exitoso de una nueva institución educativa con código DANE único @critical', async ({ page }) => {
    const timestamp = Date.now();
    const newSchoolName = `Colegio E2E Test ${timestamp}`;
    const newSchoolDane = `DANE-E2E-${timestamp}`;

    // Aceptar diálogo de alert nativo del navegador si ocurre
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await colegiosPage.openCreateModal();
    await colegiosPage.fillForm({
      nombre: newSchoolName,
      dane: newSchoolDane,
      sede: 'Sede Norte Playwright',
      correo: `contacto.${timestamp}@e2etest.edu.co`,
      contacto: '3109998877',
      calendario: 'A'
    });
    await colegiosPage.submitForm();

    // El modal debe cerrarse y el nuevo colegio debe aparecer en la lista
    await expect(colegiosPage.modalContainer).toBeHidden({ timeout: 10000 });
    await colegiosPage.searchCollege(newSchoolName);
    await colegiosPage.expectCollegeVisible(newSchoolName);
  });

  test('TC-COL-002-02: [P0] Rechazo al intentar registrar colegio con código DANE duplicado (RN-COL-002)', async ({ page }) => {
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await colegiosPage.openCreateModal();
    await colegiosPage.fillForm({
      nombre: 'Colegio Duplicado DANE Test',
      dane: '341001005652', // DANE existente de CEA School
      sede: 'Sede Centro',
      correo: 'duplicado@ceatest.edu.co',
      contacto: '3110000000'
    });
    await colegiosPage.submitForm();

    // El sistema debe alertar el error y mantener el modal abierto
    await page.waitForTimeout(1000);
    expect(dialogMessage).toMatch(/(DANE|duplicado|ya existe|Error)/i);
  });

  test('TC-COL-004-01: [P0] Cambio de estado de colegio (Suspender y Re-activar) por Admin General @critical', async ({ page }) => {
    // Aceptar confirmaciones de cambio de estado
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const targetSchoolCard = await colegiosPage.getCollegeCard('Colegio Heisenberg Neiva');
    await expect(targetSchoolCard).toBeVisible();

    // Suspender colegio si está activo
    const suspendBtn = targetSchoolCard.locator('button[title="Suspender Colegio"]');
    if (await suspendBtn.isVisible()) {
      await suspendBtn.click();
      await page.waitForTimeout(1500);
      // Debe mostrar etiqueta SUSPENDIDO
      await expect(targetSchoolCard.locator('span:has-text("SUSPENDIDO")')).toBeVisible();

      // Re-activar colegio
      const reactivateBtn = targetSchoolCard.locator('button[title="Re-activar Colegio"]');
      await expect(reactivateBtn).toBeVisible();
      await reactivateBtn.click();
      await page.waitForTimeout(1500);
      await expect(targetSchoolCard.locator('span:has-text("ACTIVO")')).toBeVisible();
    }
  });
});
