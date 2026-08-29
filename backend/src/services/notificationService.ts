import nodemailer from 'nodemailer';

// Configuración de transporte (El usuario deberá completar esto en su .env)
// Por ahora usamos una configuración de prueba o valores por defecto
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // true para 465, false para otros
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS?.replace(/"/g, '').replace(/\s+/g, ''), // Eliminar comillas y espacios de la contraseña de aplicación
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

const getFrontendUrl = (): string => {
  const envUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.replace(/\/$/, '');
  }
  return 'https://academianeiva.adsoproject.dev';
};

const FRONTEND_URL = {
  toString: () => getFrontendUrl(),
  valueOf: () => getFrontendUrl()
} as unknown as string;

export class NotificationService {
  static async sendTeacherWelcomeEmail(
    to: string,
    teacherName: string,
    schoolName: string,
    documentType: string,
    documentNumber: string,
    temporaryPassword: string
  ) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de bienvenida al docente porque no hay destinatario (to)');
      return;
    }

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Bienvenido al equipo docente</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${schoolName}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${teacherName},</p>
        <p style="line-height: 1.6;">Tu registro como docente fue creado correctamente en la plataforma institucional.</p>

        <div style="background-color: #f8fafc; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #e2e8f0;">
          <h2 style="font-size: 15px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Datos registrados</h2>
          <p style="margin: 8px 0;"><strong>Nombre:</strong> ${teacherName}</p>
          <p style="margin: 8px 0;"><strong>Documento:</strong> ${documentType} ${documentNumber}</p>
          <p style="margin: 8px 0;"><strong>Correo:</strong> ${to}</p>
        </div>

        <div style="background-color: #eff6ff; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #bfdbfe;">
          <h2 style="font-size: 15px; color: #1d4ed8; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Acceso inicial</h2>
          <p style="margin: 8px 0;"><strong>Usuario:</strong> ${to}</p>
          <p style="margin: 8px 0;"><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
          <p style="margin: 14px 0 0 0; font-size: 14px; color: #1e40af;">Se recomienda cambiar esta contraseña después del primer ingreso.</p>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <a href="${FRONTEND_URL}/login" style="background-color: #2563eb; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
            Ingresar a la plataforma
          </a>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Bienvenido como docente a la plataforma',
        html,
      });
    } catch (error) {
      console.error('Error enviando email de bienvenida al docente:', error);
    }
  }

  static async sendTeacherAssignmentEmail(
    to: string,
    teacherName: string,
    schoolName: string,
    subjectName: string,
    courseName: string,
    action: 'assigned' | 'unassigned'
  ) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de asignación al docente porque no hay destinatario (to)');
      return;
    }

    const isAssigned = action === 'assigned';
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: ${isAssigned ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'}; padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">${isAssigned ? 'Nueva asignación académica' : 'Cambio en tu asignación académica'}</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${schoolName}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${teacherName},</p>
        <p style="line-height: 1.6;">${isAssigned ? 'Se te asignó una nueva combinación de curso y materia.' : 'Se retiró una combinación de curso y materia de tus responsabilidades.'}</p>

        <div style="background-color: #f8fafc; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 8px 0;"><strong>Materia:</strong> ${subjectName}</p>
          <p style="margin: 8px 0;"><strong>Curso:</strong> ${courseName}</p>
          <p style="margin: 8px 0;"><strong>Estado:</strong> ${isAssigned ? 'Asignado' : 'Desasignado'}</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: isAssigned ? 'Nueva asignación de curso y materia' : 'Desasignación de curso y materia',
        html,
      });
    } catch (error) {
      console.error('Error enviando email de asignación al docente:', error);
    }
  }

  static async sendTeacherStatusEmail(
    to: string,
    teacherName: string,
    schoolName: string,
    status: 'ACTIVO' | 'INACTIVO' | 'DESVINCULADO' | string,
    reason?: string
  ) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de estado al docente porque no hay destinatario (to)');
      return;
    }

    const isActive = status === 'ACTIVO';
    const isInactive = status === 'INACTIVO';
    const isUnlinked = status === 'DESVINCULADO';

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: ${isActive ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : isInactive ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'}; padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">${isActive ? 'Cuenta docente reactivada' : isInactive ? 'Cuenta docente inactivada' : 'Docente desvinculado'}</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${schoolName}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${teacherName},</p>
        <p style="line-height: 1.6;">${isActive ? 'Tu cuenta de acceso a la plataforma fue activada nuevamente.' : isInactive ? 'Tu cuenta de acceso a la plataforma fue marcada como inactiva por la institución.' : 'Tu vinculación como docente fue finalizada y tu acceso a la plataforma fue retirado.'}</p>

        ${reason ? `
          <div style="background-color: #f8fafc; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0;"><strong>Detalle informado:</strong> ${reason}</p>
          </div>
        ` : ''}
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: isActive ? 'Tu cuenta docente fue reactivada' : isInactive ? 'Tu cuenta docente fue inactivada' : 'Tu vinculación docente fue finalizada',
        html,
      });
    } catch (error) {
      console.error('Error enviando email de estado al docente:', error);
    }
  }

  
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
            <h2 style="font-size: 16px; color: #4b5563; margin-top: 0; text-transform: uppercase; letter-spacing: 0.05em;">Credenciales del Padre de Familia</h2>
            <p style="margin-bottom: 10px;">Ya puedes ingresar a nuestra plataforma con los siguientes datos:</p>
            <p style="margin: 5px 0;"><strong>Usuario:</strong> ${to}</p>
            <p style="margin: 5px 0;"><strong>Contraseña temporal:</strong> padre123</p>
          </div>

          <div style="background-color: #e0e7ff; border-radius: 16px; padding: 25px; margin: 30px 0; border: 1px solid #c7d2fe;">
            <h2 style="font-size: 16px; color: #3730a3; margin-top: 0; text-transform: uppercase; letter-spacing: 0.05em;">Acceso para el Estudiante</h2>
            <p style="margin-bottom: 10px;">El estudiante podrá ingresar al sistema en la pantalla de inicio de sesión con los siguientes datos:</p>
            <p style="margin: 5px 0; font-size: 16px; font-weight: bold; color: #4338ca;">Código Estudiantil o Documento: ${studentCode}</p>
            <p style="margin: 5px 0; font-size: 16px; font-weight: bold; color: #4338ca;">Contraseña inicial: ${studentCode}</p>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #4338ca; font-style: italic;">Nota: El correo electrónico para el estudiante es opcional y podrá ser registrado más adelante en el módulo "Mi Cuenta".</p>
          </div>

          <div style="text-align: center; margin-top: 40px;">
            <a href="${FRONTEND_URL}/login" style="background-color: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
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
    const FRONTEND_URL = getFrontendUrl();
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
          <a href="${FRONTEND_URL}/matricula/corregir/${token}" style="background-color: #1f2937; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
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

  static async sendExtraordinaryApprovalEmail(to: string, parentName: string, token: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de aprobación extraordinaria porque no hay destinatario (to)');
      return;
    }
    const FRONTEND_URL = getFrontendUrl();
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Solicitud Extraordinaria Aprobada</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Excepción de Matrícula</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
        <p style="line-height: 1.6;">Nos complace informarte que la solicitud de matrícula extraordinaria ha sido aprobada por la dirección de la institución.</p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="margin: 0; color: #166534; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">🔑 Tu Token Único de Seguimiento</p>
          <p style="margin: 8px 0 0 0; color: #047857; font-size: 20px; font-family: monospace; font-weight: 800; letter-spacing: 1px;">${token}</p>
          <p style="margin: 6px 0 0 0; color: #15803d; font-size: 12px;">Conserva este token para consultar el estado de tu trámite en cualquier momento.</p>
        </div>

        <p style="line-height: 1.6;">Para continuar con el proceso, debes ingresar al siguiente enlace para cargar la documentación requerida y reservar tu cupo:</p>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${FRONTEND_URL}/matricula?token=${token}" style="background-color: #10b981; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            Completar Matrícula y Cargar Documentos
          </a>
        </div>

        <div style="text-align: center; margin-top: 15px;">
          <a href="${FRONTEND_URL}/matricula/seguimiento?token=${token}" style="color: #059669; font-size: 13px; font-weight: 600; text-decoration: underline;">
            🔍 Consultar estado de la matrícula en cualquier momento
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
        subject: 'Excepción Aprobada: Cargue de Documentos de Matrícula Extraordinaria',
        html,
      });
      console.log(`Email de aprobación extraordinaria enviado con éxito a ${to}`);
    } catch (error) {
      console.error('Error enviando email de aprobación extraordinaria:', error);
    }
  }

  static async sendReingresoApprovalEmail(to: string, parentName: string, token: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de aprobación de reingreso porque no hay destinatario (to)');
      return;
    }
    const FRONTEND_URL = getFrontendUrl();
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Solicitud de Reingreso Aprobada</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Reingreso Estudiantil</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
        <p style="line-height: 1.6;">Nos complace informarte que la solicitud de reingreso estudiantil ha sido aprobada por la dirección de la institución.</p>
        <p style="line-height: 1.6;">Para continuar con el proceso, debes ingresar al siguiente enlace para actualizar la documentación requerida y reservar tu cupo:</p>

        <div style="text-align: center; margin-top: 40px;">
          <a href="${FRONTEND_URL}/matricula/corregir/${token}" style="background-color: #10b981; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            Actualizar Documentación
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
        subject: 'Solicitud Aprobada: Cargue de Documentos para Reingreso Estudiantil',
        html,
      });
      console.log(`Email de aprobación de reingreso enviado con éxito a ${to}`);
    } catch (error) {
      console.error('Error enviando email de aprobación de reingreso:', error);
    }
  }

  static async sendReingresoRejectionEmail(to: string, parentName: string, reason: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de rechazo de reingreso porque no hay destinatario (to)');
      return;
    }
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800;">Solicitud de Reingreso No Aprobada</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Dirección Académica</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Estimado(a) ${parentName},</p>
        <p style="line-height: 1.6;">Le informamos que tras la evaluación del comité académico de la institución, la solicitud de reingreso estudiantil ha sido <strong style="color: #dc2626;">DENEGADA / RECHAZADA</strong>.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0; border-radius: 8px;">
          <p style="margin: 0; color: #991b1b; font-weight: 700; font-size: 13px; text-transform: uppercase;">Motivo institucional del rechazo:</p>
          <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 15px;">${reason}</p>
        </div>

        <p style="line-height: 1.6;">Si considera que requiere atención adicional o desea presentar recursos de reposición, por favor contacte directamente a la secretaría del colegio.</p>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Respuesta a Solicitud de Reingreso — Solicitud Denegada',
        html,
      });
      console.log(`Email de rechazo de reingreso enviado a ${to}`);
    } catch (error) {
      console.error('Error enviando email de rechazo de reingreso:', error);
    }
  }

  static async sendNonExistentStudentEmail(to: string, senderName: string, motivo: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de notificación de estudiante no existente porque no hay destinatario (to)');
      return;
    }
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Información sobre Solicitud de Reingreso</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Dirección Académica</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Estimado(a) ${senderName},</p>
        <p style="line-height: 1.6;">Le informamos que tras verificar nuestros registros institucionales, no se encontraron antecedentes del estudiante en nuestra base de datos activa o histórica de retirados.</p>
        
        <div style="background-color: #fffbebfb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: 600;">Observación institucional:</p>
          <p style="margin: 5px 0 0 0;">${motivo}</p>
        </div>

        <p style="line-height: 1.6;">Por lo tanto, no es posible aplicar un trámite de reingreso. Si desea ingresar al colegio, le invitamos a realizar el proceso de <strong>Matrícula Regular de Estudiante Nuevo</strong> a través de nuestra plataforma pública.</p>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${FRONTEND_URL}/matricula" style="background-color: #3b82f6; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
            Ir al Formulario de Matrícula Regular
          </a>
        </div>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Respuesta a Solicitud de Reingreso — Registros no encontrados',
        html,
      });
      console.log(`Email de estudiante no existente enviado con éxito a ${to}`);
    } catch (error) {
      console.error('Error enviando email de estudiante no existente:', error);
    }
  }

  static async sendCancellationEmail(to: string, parentName: string, motivo: string, detalles: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de cancelación porque no hay destinatario (to)');
      return;
    }
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background-color: #ef4444; padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Matrícula Cancelada</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Centro de Excelencia</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
        <p style="line-height: 1.6;">Te informamos que la matrícula asociada a este correo electrónico ha sido <strong>CANCELADA</strong> por la institución.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 500;"><strong>Motivo de cancelación:</strong> ${motivo}</p>
          ${detalles ? `<p style="margin: 10px 0 0 0; color: #7f1d1d; font-size: 14px;"><strong>Detalles:</strong> ${detalles}</p>` : ''}
        </div>

        <p style="line-height: 1.6;">Si consideras que esto es un error o requieres más aclaraciones, por favor comunícate con la administración de la institución.</p>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Importante: Cancelación de Matrícula - Academia Neiva',
        html,
      });
      console.log(`Email de cancelación enviado con éxito a ${to}`);
    } catch (error) {
      console.error('Error enviando email de cancelación:', error);
    }
  }

  static async sendStudentTransferEmail(
    to: string, 
    parentName: string, 
    studentName: string, 
    oldGrade: string, 
    newGrade: string, 
    reason: string, 
    schoolName: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Traslado de Curso</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${schoolName}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
        <p style="line-height: 1.6;">Te informamos que se ha realizado un traslado de curso para el estudiante <strong>${studentName}</strong>.</p>

        <div style="background-color: #f8fafc; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 15px;">
            <div style="text-align: center; flex: 1;">
              <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Curso Anterior</p>
              <p style="margin: 5px 0 0 0; font-weight: 800; color: #ef4444;">${oldGrade}</p>
            </div>
            <div style="padding: 0 15px; color: #94a3b8; font-size: 20px;">→</div>
            <div style="text-align: center; flex: 1;">
              <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Nuevo Curso</p>
              <p style="margin: 5px 0 0 0; font-weight: 800; color: #10b981;">${newGrade}</p>
            </div>
          </div>
          
          <div style="margin-top: 20px;">
            <p style="margin: 0 0 8px 0; color: #475569; font-weight: 700; font-size: 12px; text-transform: uppercase;">Motivo del Traslado:</p>
            <div style="margin: 0; color: #1e2937; line-height: 1.6; font-style: italic; background: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid #f1f5f9;">
              "${reason}"
            </div>
          </div>
        </div>

        <p style="line-height: 1.6; font-size: 14px; color: #64748b; text-align: center;">Este cambio ya está reflejado en la plataforma institucional.</p>

        <div style="text-align: center; margin-top: 40px;">
          <a href="${FRONTEND_URL}/login" style="background-color: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
            Acceder a la plataforma
          </a>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: '"Academia Neiva" <' + process.env.SMTP_USER + '>',
        to,
        subject: `Notificación de Traslado: ${studentName}`,
        html,
      });
    } catch (error) {
      console.error('Error enviando email de traslado de estudiante:', error);
    }
  }

  static async sendInterInstitutionalTransferApprovedEmail(
    to: string,
    parentName: string,
    studentName: string,
    originSchoolName: string,
    destSchoolName: string,
    gradeName: string,
    groupName: string | null
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">¡Traslado Aprobado!</h1>
          <p style="opacity: 0.92; margin-top: 10px; font-size: 16px;">${destSchoolName}</p>
        </div>

        <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
        <p style="line-height: 1.6;">Nos complace informarte que la solicitud de traslado para el estudiante <strong>${studentName}</strong> ha sido <strong>APROBADA Y FORMALIZADA</strong> con éxito.</p>

        <div style="background-color: #f8fafc; border-radius: 18px; padding: 24px; margin: 28px 0; border: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 15px;">
            <div style="text-align: center; flex: 1;">
              <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Institución Origen</p>
              <p style="margin: 5px 0 0 0; font-weight: 800; color: #64748b;">${originSchoolName}</p>
            </div>
            <div style="padding: 0 15px; color: #10b981; font-size: 20px; font-weight: bold;">→</div>
            <div style="text-align: center; flex: 1;">
              <p style="margin: 0; color: #047857; font-size: 11px; text-transform: uppercase; font-weight: 700;">Nueva Institución</p>
              <p style="margin: 5px 0 0 0; font-weight: 800; color: #059669;">${destSchoolName}</p>
            </div>
          </div>
          
          <div style="margin-top: 15px;">
            <p style="margin: 0 0 8px 0; color: #475569; font-weight: 700; font-size: 12px; text-transform: uppercase;">Ubicación Académica Asignada:</p>
            <div style="margin: 0; color: #1e2937; line-height: 1.6; background: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid #f1f5f9;">
              <p style="margin: 0 0 4px 0;"><strong>Grado:</strong> ${gradeName}</p>
              <p style="margin: 0;"><strong>Grupo / Sección:</strong> ${groupName || 'Pendiente de asignación interna por rectoría'}</p>
            </div>
          </div>
        </div>

        <p style="line-height: 1.6; font-size: 14px; color: #64748b; text-align: center;">El estudiante ya se encuentra activo en el nuevo plantel educativo.</p>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${FRONTEND_URL}/login" style="background-color: #059669; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
            Ingresar al Portal
          </a>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: '"Academia Neiva" <' + process.env.SMTP_USER + '>',
        to,
        subject: `¡Traslado Aprobado a ${destSchoolName}!: ${studentName}`,
        html,
      });
    } catch (error) {
      console.error('Error enviando email de aprobación de traslado interinstitucional:', error);
    }
  }

  static async sendPasswordResetEmail(to: string, userName: string, resetLink: string) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de restablecimiento de contraseña porque no hay destinatario (to)');
      return;
    }
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Restablecer Contraseña</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Portal del Usuario</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Hola, ${userName},</p>
        <p style="line-height: 1.6;">Has solicitado restablecer la contraseña para acceder a la plataforma institucional de Academia Neiva.</p>
        <p style="line-height: 1.6;">Haz clic en el siguiente botón para definir una nueva contraseña. Este enlace expirará en 1 hora:</p>

        <div style="text-align: center; margin-top: 40px;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            Restablecer mi contraseña
          </a>
        </div>

        <p style="line-height: 1.6; margin-top: 30px; font-size: 14px; color: #6b7280;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Recuperación de contraseña - Academia Neiva',
        html,
      });
      console.log(`Email de recuperación enviado con éxito a ${to}`);
    } catch (error) {
      console.error('Error enviando email de recuperación de contraseña:', error);
    }
  }

  static async sendEnrollmentSubmittedEmail(
    to: string,
    parentName: string,
    studentName: string,
    trackingToken: string
  ) {
    if (!to) {
      console.error('❌ Error: No se puede enviar email de confirmación de matrícula porque no hay destinatario (to)');
      return;
    }
    const trackingLink = `${FRONTEND_URL}/matricula/seguimiento?token=${trackingToken}`;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Solicitud Recibida</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 16px;">Academia Neiva - Registro de Matrícula</p>
        </div>
        
        <p style="font-size: 18px; font-weight: 600;">Hola, ${parentName},</p>
        <p style="line-height: 1.6;">Hemos recibido correctamente el formulario de inscripción y documentos para el estudiante <strong>${studentName}</strong>.</p>
        <p style="line-height: 1.6;">Nuestra secretaría académica revisará la documentación en breve. Mientras tanto, puedes realizar el seguimiento de tu solicitud ingresando al portal con tu código único:</p>

        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center; border: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Token Único de Seguimiento</p>
          <p style="margin: 10px 0; font-family: monospace; font-size: 18px; font-weight: bold; color: #1e1b4b; word-break: break-all;">${trackingToken}</p>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <a href="${trackingLink}" style="background-color: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            Ver estado de mi matrícula
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
        subject: 'Confirmación: Solicitud de Matrícula Recibida',
        html,
      });
      console.log(`Email de confirmación de matrícula enviado con éxito a ${to}`);
    } catch (error) {
      console.error('Error enviando email de confirmación de matrícula:', error);
    }
  }

  static async sendReingresoInProcessEmail(
    to: string,
    recipientName: string,
    ticketCode: string,
    studentName?: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800;">Solicitud de Reingreso en Proceso</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 15px;">Academia Neiva - Gestión de Reingresos</p>
        </div>
        
        <p style="font-size: 16px; font-weight: 600;">Hola, ${recipientName},</p>
        <p style="line-height: 1.6;">Te informamos que tu solicitud de reingreso estudiantil (Ticket <strong>${ticketCode}</strong>) ${studentName ? `para el alumno <strong>${studentName}</strong>` : ''} ha entrado formalmente en <strong>PROCESO DE REVISIÓN Y GESTIÓN</strong> por parte de la directiva institucional.</p>
        <p style="line-height: 1.6;">En breve recibirás las instrucciones y el enlace personalizado para completar la actualización documental requerida.</p>

        <div style="background-color: #fffbeb; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #fde68a;">
          <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 700;">📌 Estado del Ticket: EN PROCESO</p>
          <p style="margin: 5px 0 0 0; color: #b45309; font-size: 12px;">Este proceso ya está activo y no se detendrá hasta culminar la revisión del reingreso.</p>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© 2024 Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: `Actualización Reingreso: Ticket ${ticketCode} en Proceso`,
        html,
      });
      console.log(`Email de reingreso en proceso enviado a ${to}`);
    } catch (error) {
      console.error('Error enviando email de reingreso en proceso:', error);
    }
  }

  static async sendEmailChangeCode(
    to: string,
    userName: string,
    code: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800;">Código de Verificación</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 15px;">Confirmación de Cambio de Correo Electrónico</p>
        </div>
        
        <p style="font-size: 16px; font-weight: 600;">Hola, ${userName},</p>
        <p style="line-height: 1.6;">Has solicitado actualizar la dirección de correo electrónico asociada a tu cuenta institucional en <strong>Academia Neiva</strong>.</p>
        
        <div style="background-color: #f8fafc; border-radius: 20px; padding: 30px; margin: 25px 0; border: 2px dashed #6366f1; text-align: center;">
          <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">Tu código de seguridad</p>
          <p style="margin: 15px 0 0 0; color: #4338ca; font-size: 42px; font-weight: 900; letter-spacing: 0.25em;">${code}</p>
        </div>

        <p style="line-height: 1.6; font-size: 13px; color: #64748b;">Este código es válido durante los próximos <strong>15 minutos</strong>. Si tú no realizaste esta solicitud, por favor ignora este mensaje y tu correo no cambiará.</p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: `Código de Verificación: ${code} - Cambio de Correo`,
        html,
      });
      console.log(`Email de verificación de cambio de correo enviado a ${to}`);
    } catch (error) {
      console.error('Error enviando email de verificación de cambio de correo:', error);
    }
  }

  static async sendEnrollmentEmailVerificationCode(
    to: string,
    code: string
  ) {
    if (!to) return;
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px; border-radius: 24px; text-align: center; color: white; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800;">Verificación de Correo Electrónico</h1>
          <p style="opacity: 0.9; margin-top: 10px; font-size: 15px;">Academia Neiva - Proceso de Matrícula</p>
        </div>
        
        <p style="font-size: 16px; font-weight: 600;">Hola,</p>
        <p style="line-height: 1.6;">Estás realizando el registro de solicitud de matrícula en <strong>Academia Neiva</strong>. Para verificar la autenticidad de tu dirección de correo electrónico, utiliza el siguiente código de seguridad:</p>
        
        <div style="background-color: #f8fafc; border-radius: 20px; padding: 30px; margin: 25px 0; border: 2px dashed #2563eb; text-align: center;">
          <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">Código de Verificación Único</p>
          <p style="margin: 15px 0 0 0; color: #1d4ed8; font-size: 42px; font-weight: 900; letter-spacing: 0.25em;">${code}</p>
        </div>

        <p style="line-height: 1.6; font-size: 13px; color: #64748b;">Este código es de un solo uso y será válido durante los próximos <strong>15 minutos</strong>. Una vez verificado tu correo, podrás finalizar el envío de la matrícula.</p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>© Academia Neiva. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Academia Neiva" <${process.env.SMTP_USER}>`,
        to,
        subject: `Código de Verificación de Matrícula: ${code}`,
        html,
      });
      console.log(`Email de verificación de matrícula enviado exitosamente a ${to}`);
    } catch (error) {
      console.error('Error enviando email de verificación de matrícula:', error);
    }
  }
}
