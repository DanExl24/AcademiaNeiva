import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage';
import { TEST_USERS } from '../../data/test-users';

test.describe('Módulo 01: Autenticación — Validaciones y Manejo de Errores (RN-AUT-002 / RN-AUT-007)', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clearSession();
  });

  test('TC-AUT-001-07: [P0] Error de login con contraseña incorrecta retorna mensaje de credenciales incorrectas', async ({ page }) => {
    await loginPage.login(TEST_USERS.directivoRector.email, 'PasswordCompletamenteErroneo123');
    
    await loginPage.expectErrorMessage(/Credenciales incorrectas/i);
    expect(await loginPage.getLocalStorageItem('token')).toBeNull();
  });

  test('TC-AUT-001-08: [P0] Error de login con correo no registrado no revela información del sistema', async ({ page }) => {
    await loginPage.login(TEST_USERS.invalidUser.email, TEST_USERS.invalidUser.password);
    
    await loginPage.expectErrorMessage(/Credenciales incorrectas/i);
    expect(await loginPage.getLocalStorageItem('token')).toBeNull();
  });

  test('TC-AUT-002-03: [P0] Error de login de estudiante con código inexistente retorna error de autenticación', async ({ page }) => {
    await loginPage.login('CODIGO-INEXISTENTE-999', 'estudiante123');
    
    await loginPage.expectErrorMessage(/(Código o contraseña incorrectos|Credenciales incorrectas)/i);
    expect(await loginPage.getLocalStorageItem('token')).toBeNull();
  });

  test('TC-AUT-001-09: [P1] Validación de formulario en frontend ante campos incompletos', async ({ page }) => {
    // Si se intenta enviar vacío, los campos HTML5 'required' impiden el submit o el frontend valida
    await loginPage.submitButton.click();
    
    // La URL permanece en /login
    await expect(page).toHaveURL(/\/login/);
    expect(await loginPage.getLocalStorageItem('token')).toBeNull();
  });
});
