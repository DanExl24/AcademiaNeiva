import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage';
import { UsuariosPage } from '../../pages/adminGeneral/UsuariosPage';
import { TEST_USERS } from '../../data/test-users';

test.describe('Módulo 03: Usuarios y Directivos — Seguridad y Control de Sesiones (RN-DIR-003 / RN-AUTH-009)', () => {
  test('TC-USR-001-04: [P0] Directivos y Docentes tienen prohibido el acceso a /dashboard/usuarios @smoke @critical', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clearSession();

    // Login como directivo
    await loginPage.login(TEST_USERS.directivoRector.email, TEST_USERS.directivoRector.password);
    await loginPage.expectLoginSuccess();

    // Navegación directa no autorizada
    await page.goto('/dashboard/usuarios');
    await page.waitForLoadState('domcontentloaded');

    // Debe ser redirigido
    await expect(page).not.toHaveURL(/\/dashboard\/usuarios/);
  });

  test('TC-USR-003-01: [P0] Forzar cierre de sesiones activas de un usuario de forma remota (RN-DIR-003) @critical', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const usuariosPage = new UsuariosPage(page);

    // Login como Admin General
    await loginPage.goto();
    await loginPage.clearSession();
    await loginPage.login(TEST_USERS.adminGeneral.email, TEST_USERS.adminGeneral.password);
    await loginPage.expectLoginSuccess();

    await usuariosPage.goto();

    // Manejar alert nativo del navegador
    let dialogTriggered = false;
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.accept();
    });

    await usuariosPage.searchUser(TEST_USERS.docente.email);
    const teacherRow = await usuariosPage.getUserRow(TEST_USERS.docente.email);
    await expect(teacherRow).toBeVisible();

    const forceLogoutBtn = teacherRow.locator('button[title="Forzar Cierre de Sesiones"]');
    await expect(forceLogoutBtn).toBeVisible();
    await forceLogoutBtn.click();

    await page.waitForTimeout(1000);
    expect(dialogTriggered).toBe(true);
  });
});
