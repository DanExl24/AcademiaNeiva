import nodemailer from 'nodemailer';

// Configuración de transporte (El usuario deberá completar esto en su .env)
// Por ahora usamos una configuración de prueba o valores por defecto
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // true para 465, false para otros
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS?.replace(/"/g, ''), // Eliminar comillas si las hay
  },
  logger: true,
  debug: true
});

// Verificar conexión al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error de conexión SMTP:', error);
  } else {
    console.log('🚀 Servidor de correo listo para enviar mensajes');
  }
});

export class NotificationService {
  
  static async sendApprovalEmail(to: string, parentName: string, studentName: string, studentCode: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de aprobación porque no hay destinatario (to)');
      return;
    }
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.2);">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">¡Matrícula Aprobada!</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Centro de Excelencia</p>
        </div>
        
        <div style="padding: 0 10px;">
          <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
          <p style="line-height: 1.6;">Nos complace informarte que la documentación de <strong>${studentName}</strong> ha sido validada y aprobada satisfactoriamente.</p>
          
          <div style="background-color: #f9fafb; border-radius: 16px; padding: 25px; margin: 30px 0; border: 1px solid #f3f4f6;">
            <h2 style="font-size: 16px; color: #4b5563; margin-top: 0; text-transform: uppercase; letter-spacing: 0.05em;">Información del Estudiante</h2>
            <p style="margin: 5px 0;"><strong>Código Estudiantil:</strong> <span style="color: #4f46e5; font-weight: 800; font-size: 18px;">${studentCode}</span></p>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <h3 style="font-size: 13px; color: #6b7280; margin-top: 0; text-transform: uppercase;">Para el Padre (Acceso General)</h3>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Usuario:</strong> ${to}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Contraseña:</strong> padre123</p>
              </div>
              <div>
                <h3 style="font-size: 13px; color: #6b7280; margin-top: 0; text-transform: uppercase;">Para el Estudiante (Portal Propio)</h3>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Código:</strong> ${studentCode}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>Contraseña:</strong> estudiante123</p>
              </div>
            </div>

            <div style="margin-top: 20px; font-size: 12px; color: #9ca3af; line-height: 1.4;">
              * El estudiante debe ingresar a través del <strong>Portal Estudiantil</strong> usando su código y la contraseña asignada. Te recomendamos cambiar estas credenciales tras el primer ingreso.
            </div>
          </div>

          <div style="text-align: center; margin-top: 40px;">
            <a href="http://localhost:5173/login" style="background-color: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              Acceder a la Plataforma
            </a>
          </div>
        </div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
          <p>Este es un correo automático, por favor no respondas a esta dirección.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: '¡Bienvenido! Matrícula Aprobada - Academia Neiva',
        html,
      });
      console.log(`Email enviado con éxito a ${to}`);
    } catch (error) {
      console.error('Error enviando email:', error);
    }
  }

  static async sendRejectionEmail(to: string, parentName: string, reason: string, token: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de rechazo porque no hay destinatario (to)');
      return;
    }
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background-color: #ef4444; padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Acción Requerida</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Inconsistencias en Documentación</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
        <p style="line-height: 1.6;">Durante el proceso de revisión de documentos hemos encontrado lo siguiente:</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 500;">${reason}</p>
        </div>

        <p style="line-height: 1.6;">Por favor, ingresa a la plataforma para corregir o subir nuevamente los documentos solicitados.</p>

        <div style="text-align: center; margin-top: 40px;">
          <a href="http://localhost:5173/matricula/corregir/${token}" style="background-color: #1f2937; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
            Corregir Documentación
          </a>
        </div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Acción Requerida: Inconsistencias en su Matrícula',
        html,
      });
    } catch (error) {
      console.error('Error enviando email:', error);
    }
  }
}
