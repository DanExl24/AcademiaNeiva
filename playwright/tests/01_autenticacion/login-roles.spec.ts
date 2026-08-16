import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage';
import { TEST_USERS } from '../../data/test-users';

test.describe('Módulo 01: Autenticación — Login por Roles (HU-AUT-001 / HU-AUT-002)', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clearSession();
  });

  test('TC-AUT-001-01: [P0] Login exitoso como Administrador General @smoke @critical', async ({ page }) => {
    await loginPage.login(TEST_USERS.adminGeneral.email, TEST_USERS.adminGeneral.password);
    
    // Admin General es redirigido a /dashboard o /admin-dashboard
    await loginPage.expectLoginSuccess(/(admin-dashboard|dashboard)/);
    
    const userStr = await loginPage.getLocalStorageItem('user');
    expect(userStr).toBeTruthy();
    const user = JSON.parse(userStr!);
    expect(user.roles).toContain('admin_general');
  });

  test('TC-AUT-001-02: [P0] Login exitoso como Directivo (Rector) @critical', async ({ page }) => {
    await loginPage.login(TEST_USERS.directivoRector.email, TEST_USERS.directivoRector.password);
    
    await loginPage.expectLoginSuccess(/(dashboard|select-school)/);
    
    const userStr = await loginPage.getLocalStorageItem('user');
    expect(userStr).toBeTruthy();
    const user = JSON.parse(userStr!);
    expect(user.roles).toContain('directivo');
  });

  test('TC-AUT-001-03: [P0] Login exitoso como Directivo (Coordinador) @critical', async ({ page }) => {
    await loginPage.login(TEST_USERS.directivoCoordinador.email, TEST_USERS.directivoCoordinador.password);
    
    await loginPage.expectLoginSuccess(/(dashboard|select-school)/);
    
    const userStr = await loginPage.getLocalStorageItem('user');
    expect(userStr).toBeTruthy();
    const user = JSON.parse(userStr!);
    expect(user.roles).toContain('directivo');
  });

  test('TC-AUT-001-04: [P0] Login exitoso como Docente @critical', async ({ page }) => {
    await loginPage.login(TEST_USERS.docente.email, TEST_USERS.docente.password);
    
    await loginPage.expectLoginSuccess(/(dashboard|select-school)/);
    
    const userStr = await loginPage.getLocalStorageItem('user');
    expect(userStr).toBeTruthy();
    const user = JSON.parse(userStr!);
    expect(user.roles).toContain('docente');
  });

  test('TC-AUT-002-01: [P0] Login exitoso como Estudiante mediante código institucional @smoke @critical', async ({ page }) => {
    await loginPage.login(TEST_USERS.estudiante.code, TEST_USERS.estudiante.password);
    
    await loginPage.expectLoginSuccess(/(student|dashboard)/);
    
    const userStr = await loginPage.getLocalStorageItem('user');
    expect(userStr).toBeTruthy();
    const user = JSON.parse(userStr!);
    expect(user.roles).toContain('estudiante');
  });

  test('TC-AUT-002-02: [P0] Login exitoso como Estudiante mediante número de documento @critical', async ({ page }) => {
    await loginPage.login(TEST_USERS.estudiante.document, TEST_USERS.estudiante.password);
    
    await loginPage.expectLoginSuccess(/(student|dashboard)/);
    
    const userStr = await loginPage.getLocalStorageItem('user');
    expect(userStr).toBeTruthy();
    const user = JSON.parse(userStr!);
    expect(user.roles).toContain('estudiante');
  });
});
