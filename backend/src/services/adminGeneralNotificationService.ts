import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS?.replace(/"/g, ''),
  },
});

const FROM = `"Academia Neiva" <${process.env.SMTP_USER}>`;

/**
 * Servicio de notificaciones por email para eventos del Admin General.
 * Solo envía emails para los eventos especificados por el usuario:
 * - Solicitud de supervisión
 * - Supervisión aprobada
 * - Supervisión rechazada (revocada)
 * - Supervisión iniciada
 * - Supervisión finalizada
 * - Colegio suspendido
 */
export class AdminGeneralNotificationService {

  static async verifySMTP(): Promise<boolean> {
    try {
      await transporter.verify();
      return true;
    } catch (error) {
      console.error('Error al verificar conexión SMTP:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUPERVISIÓN: Solicitud
  // ─────────────────────────────────────────────────────────────
  static async sendSupervisionSolicitada(
    to: string,
    directivoNombre: string,
    adminNombre: string,
    colegioNombre: string,
    motivo: string,
    tipoSupervision: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Solicitud de Supervisión</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${colegioNombre}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${directivoNombre},</p>
        <p style="line-height: 1.6;">El Administrador General <strong>${adminNombre}</strong> ha solicitado entrar en modo de supervisión a tu colegio.</p>

        <div style="background-color: #fffbeb; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #fde68a;">
          <h2 style="font-size: 15px; color: #92400e; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Detalles de la solicitud</h2>
          <p style="margin: 8px 0;"><strong>Tipo:</strong> ${tipoSupervision === 'EDITOR' ? 'Modo Editor' : 'Solo Lectura'}</p>
          <p style="margin: 8px 0;"><strong>Motivo:</strong> ${motivo}</p>
        </div>

        <p style="line-height: 1.6; color: #6b7280;">Por favor, ingresa a la plataforma para aprobar o rechazar esta solicitud.</p>

        <div style="text-align: center; margin-top: 40px;">
          <a href="http://localhost:5173/login" style="background-color: #d97706; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
            Revisar Solicitud
          </a>
        </div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({ from: FROM, to, subject: `Solicitud de Supervisión - ${colegioNombre}`, html });
    } catch (error) {
      console.error('Error enviando email de solicitud de supervisión:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUPERVISIÓN: Aprobada
  // ─────────────────────────────────────────────────────────────
  static async sendSupervisionAprobada(
    to: string,
    adminNombre: string,
    colegioNombre: string,
    directivoNombre: string,
    tipoSupervision: string,
    duracionMinutos: number
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Supervisión Aprobada</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${colegioNombre}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${adminNombre},</p>
        <p style="line-height: 1.6;">Tu solicitud de supervisión ha sido <strong>aprobada</strong> por el directivo <strong>${directivoNombre}</strong>.</p>

        <div style="background-color: #ecfdf5; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #a7f3d0;">
          <p style="margin: 8px 0;"><strong>Tipo:</strong> ${tipoSupervision === 'EDITOR' ? 'Modo Editor' : 'Solo Lectura'}</p>
          <p style="margin: 8px 0;"><strong>Duración máxima:</strong> ${duracionMinutos} minutos</p>
        </div>

        <p style="line-height: 1.6; color: #6b7280;">Ya puedes iniciar el modo supervisión desde la plataforma.</p>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({ from: FROM, to, subject: `Supervisión Aprobada - ${colegioNombre}`, html });
    } catch (error) {
      console.error('Error enviando email de supervisión aprobada:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUPERVISIÓN: Rechazada / Revocada
  // ─────────────────────────────────────────────────────────────
  static async sendSupervisionRechazada(
    to: string,
    adminNombre: string,
    colegioNombre: string,
    directivoNombre: string,
    motivo: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Supervisión Rechazada</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${colegioNombre}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${adminNombre},</p>
        <p style="line-height: 1.6;">Tu solicitud de supervisión ha sido <strong>rechazada/revocada</strong> por el directivo <strong>${directivoNombre}</strong>.</p>

        ${motivo ? `
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: 500;"><strong>Motivo:</strong> ${motivo}</p>
          </div>
        ` : ''}

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({ from: FROM, to, subject: `Supervisión Rechazada - ${colegioNombre}`, html });
    } catch (error) {
      console.error('Error enviando email de supervisión rechazada:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUPERVISIÓN: Iniciada (notificar a directivos)
  // ─────────────────────────────────────────────────────────────
  static async sendSupervisionIniciada(
    to: string,
    directivoNombre: string,
    adminNombre: string,
    colegioNombre: string,
    tipoSupervision: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Supervisión Iniciada</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${colegioNombre}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${directivoNombre},</p>
        <p style="line-height: 1.6;">El Administrador General <strong>${adminNombre}</strong> ha <strong>iniciado el modo supervisión</strong> en tu colegio.</p>

        <div style="background-color: #f5f3ff; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #ddd6fe;">
          <p style="margin: 8px 0;"><strong>Modo:</strong> ${tipoSupervision === 'EDITOR' ? 'Editor (puede realizar cambios)' : 'Solo Lectura'}</p>
          <p style="margin: 8px 0;"><strong>Estado:</strong> En curso</p>
        </div>

        <p style="line-height: 1.6; color: #6b7280;">Todas las acciones realizadas quedarán registradas en la auditoría del sistema.</p>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({ from: FROM, to, subject: `⚠️ Supervisión Iniciada - ${colegioNombre}`, html });
    } catch (error) {
      console.error('Error enviando email de supervisión iniciada:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUPERVISIÓN: Finalizada (notificar a directivos)
  // ─────────────────────────────────────────────────────────────
  static async sendSupervisionFinalizada(
    to: string,
    directivoNombre: string,
    adminNombre: string,
    colegioNombre: string,
    duracionReal: string,
    totalAcciones: number
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Supervisión Finalizada</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${colegioNombre}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${directivoNombre},</p>
        <p style="line-height: 1.6;">El Administrador General <strong>${adminNombre}</strong> ha <strong>finalizado el modo supervisión</strong> en tu colegio.</p>

        <div style="background-color: #eff6ff; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #bfdbfe;">
          <h2 style="font-size: 15px; color: #1d4ed8; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Resumen</h2>
          <p style="margin: 8px 0;"><strong>Duración:</strong> ${duracionReal}</p>
          <p style="margin: 8px 0;"><strong>Acciones registradas:</strong> ${totalAcciones}</p>
        </div>

        <p style="line-height: 1.6; color: #6b7280;">Puedes consultar el detalle completo de la auditoría desde la plataforma.</p>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({ from: FROM, to, subject: `Supervisión Finalizada - ${colegioNombre}`, html });
    } catch (error) {
      console.error('Error enviando email de supervisión finalizada:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // COLEGIO: Suspendido (notificar a directivos)
  // ─────────────────────────────────────────────────────────────
  static async sendColegioSuspendido(
    to: string,
    directivoNombre: string,
    colegioNombre: string,
    motivo: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Colegio Suspendido</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${colegioNombre}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${directivoNombre},</p>
        <p style="line-height: 1.6;">Te informamos que el colegio <strong>${colegioNombre}</strong> ha sido <strong>suspendido</strong> por el Administrador General del sistema.</p>

        ${motivo ? `
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: 500;"><strong>Motivo:</strong> ${motivo}</p>
          </div>
        ` : ''}

        <p style="line-height: 1.6; color: #6b7280;">Mientras el colegio esté suspendido, los usuarios no podrán iniciar sesión en el sistema. Para más información, contacta al administrador.</p>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({ from: FROM, to, subject: `⚠️ Colegio Suspendido - ${colegioNombre}`, html });
    } catch (error) {
      console.error('Error enviando email de colegio suspendido:', error);
    }
  }
}
