"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Configuración de transporte (El usuario deberá completar esto en su .env)
// Por ahora usamos una configuración de prueba o valores por defecto
const transporter = nodemailer_1.default.createTransport({
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
    }
    else {
        console.log('🚀 Servidor de correo listo para enviar mensajes');
    }
});
class NotificationService {
    static async sendTeacherWelcomeEmail(to, teacherName, schoolName, documentType, documentNumber, temporaryPassword) {
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
          <a href="http://localhost:5173/login" style="background-color: #2563eb; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
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
        }
        catch (error) {
            console.error('Error enviando email de bienvenida al docente:', error);
        }
    }
    static async sendTeacherAssignmentEmail(to, teacherName, schoolName, subjectName, courseName, action) {
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
        }
        catch (error) {
            console.error('Error enviando email de asignación al docente:', error);
        }
    }
    static async sendTeacherStatusEmail(to, teacherName, schoolName, status, reason) {
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
        }
        catch (error) {
            console.error('Error enviando email de estado al docente:', error);
        }
    }
    static async sendApprovalEmail(to, parentName, studentName, studentCode) {
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
            <p style="margin-bottom: 10px;">El estudiante podrá ingresar al sistema utilizando su código estudiantil.</p>
            <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #4338ca;">Código Estudiantil: ${studentCode}</p>
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
        }
        catch (error) {
            console.error('Error enviando email:', error);
        }
    }
    static async sendRejectionEmail(to, parentName, reason, token) {
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
        }
        catch (error) {
            console.error('Error enviando email:', error);
        }
    }
    static async sendCancellationEmail(to, parentName, motivo, detalles) {
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
        }
        catch (error) {
            console.error('Error enviando email de cancelación:', error);
        }
    }
    static async sendStudentTransferEmail(to, parentName, studentName, oldGrade, newGrade, reason, schoolName) {
        if (!to)
            return;
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
          <a href="http://localhost:5173/login" style="background-color: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block;">
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
        }
        catch (error) {
            console.error('Error enviando email de traslado de estudiante:', error);
        }
    }
}
exports.NotificationService = NotificationService;
