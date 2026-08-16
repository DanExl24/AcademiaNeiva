import { test, expect } from '@playwright/test';
import { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage';
import { TEST_USERS } from '../../data/test-users';

test.describe('Módulo 01: Autenticación — Recuperación de Contraseña (HU-AUT-003)', () => {
  let forgotPasswordPage: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    forgotPasswordPage = new ForgotPasswordPage(page);
    await forgotPasswordPage.goto();
  });

  test('TC-AUT-003-01: [P1] Envío exitoso de solicitud de recuperación para usuario existente', async ({ page }) => {
    await forgotPasswordPage.requestReset(TEST_USERS.directivoRector.email);
    
    // Debe mostrar mensaje confirmando el envío de instrucciones
    await forgotPasswordPage.expectSuccessMessage();
  });

  test('TC-AUT-003-02: [P1] Solicitud para usuario inexistente no revela información interna (Anti-Enumeración)', async ({ page }) => {
    await forgotPasswordPage.requestReset('correo.inexistente.ficticio@noexiste.com');
    
    // Por seguridad, debe responder con el mismo mensaje genérico sin alertar si el usuario existe o no
    await forgotPasswordPage.expectSuccessMessage();
  });
});
