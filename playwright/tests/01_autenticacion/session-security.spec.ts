import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage';
import { TEST_USERS } from '../../data/test-users';

test.describe('Módulo 01: Autenticación — Seguridad de Sesión y Guards (RN-AUT-001 / RN-AUTH-009)', () => {
  test('TC-AUT-001-10: [P0] Rutas protegidas redirigen automáticamente a /login para usuarios no autenticados @smoke', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/gestion-matriculas',
      '/dashboard/configuracion-academica',
      '/dashboard/docentes',
      '/select-school'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      // Debe haber redirigido a /login
      await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
    }
  });

  test('TC-AUT-001-11: [P0] El token JWT emitido contiene la estructura estándar con JTI y Roles (RN-AUT-001)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clearSession();

    await loginPage.login(TEST_USERS.adminGeneral.email, TEST_USERS.adminGeneral.password);
    await loginPage.expectLoginSuccess();

    const token = await loginPage.getLocalStorageItem('token');
    expect(token).toBeTruthy();

    // Decodificar payload de JWT sin verificar firma (base64)
    const payloadBase64 = token!.split('.')[1];
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    expect(payload).toHaveProperty('id');
    expect(payload).toHaveProperty('email', TEST_USERS.adminGeneral.email);
    expect(payload).toHaveProperty('roles');
    expect(payload.roles).toContain('admin_general');
    expect(payload).toHaveProperty('jti'); // RN-AUT-001: Identificador único JTI
    expect(typeof payload.jti).toBe('string');
  });

  test('TC-AUT-001-12: [P0] Tras eliminar el token de sesión, la navegación a rutas privadas es denegada', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clearSession();

    // Login inicial
    await loginPage.login(TEST_USERS.directivoRector.email, TEST_USERS.directivoRector.password);
    await loginPage.expectLoginSuccess();

    // Simular cierre de sesión / expiración de token
    await loginPage.clearSession();

    // Intentar recargar o navegar a ruta privada
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Debe ser expulsado hacia el login
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});
