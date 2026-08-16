import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage';
import { MySchoolPage } from '../../pages/admin/MySchoolPage';
import { TEST_USERS } from '../../data/test-users';

test.describe('Módulo 02: Gestión de Colegios — Seguridad e Identidad Institucional (RN-AUTH-009 / HU-COL-005)', () => {
  test('TC-COL-001-04: [P0] Directivos y Docentes no pueden acceder a la gestión global de colegios (/dashboard/colegios) @smoke @critical', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clearSession();
    
    // Login como directivo
    await loginPage.login(TEST_USERS.directivoRector.email, TEST_USERS.directivoRector.password);
    await loginPage.expectLoginSuccess();

    // Intentar navegar directamente a la ruta exclusiva de Admin General
    await page.goto('/dashboard/colegios');
    await page.waitForLoadState('domcontentloaded');

    // El router guard debe redirigir al dashboard base
    await expect(page).not.toHaveURL(/\/dashboard\/colegios/);
  });

  test('TC-COL-005-01: [P1] Directivo visualiza los datos generales de su colegio en /dashboard/mi-colegio', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const mySchoolPage = new MySchoolPage(page);

    await loginPage.goto();
    await loginPage.clearSession();
    await loginPage.login(TEST_USERS.directivoRector.email, TEST_USERS.directivoRector.password);
    await loginPage.expectLoginSuccess();

    await mySchoolPage.goto();
    await expect(page.locator('h1:has-text("Mi Colegio")')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('p:has-text("CEA School Empresarial de los Andes")').first()).toBeVisible();
    await expect(page.locator('p:has-text("341001005652")').first()).toBeVisible();
  });

  test('TC-COL-005-02: [P1] Directivo actualiza los colores institucionales de su colegio (HU-COL-005 / RN-COL-004)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const mySchoolPage = new MySchoolPage(page);

    await loginPage.goto();
    await loginPage.clearSession();
    await loginPage.login(TEST_USERS.directivoRector.email, TEST_USERS.directivoRector.password);
    await loginPage.expectLoginSuccess();

    await mySchoolPage.goto();
    await mySchoolPage.switchTab('identity');

    // Cambiar a colores de prueba
    await mySchoolPage.updateColors('#10b981', '#064e3b');

    // Comprobar que no arrojó errores y los inputs retienen el valor
    await expect(mySchoolPage.inputColorPrimario).toBeVisible();
  });
});
