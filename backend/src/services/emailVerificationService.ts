import { db } from "../config/kysely";
import { TipoVerificacionEmail } from "../types/db.types";
import { NotificationService } from "./notificationService";

export type EmailVerificationTipo = TipoVerificacionEmail;

export interface SendVerificationCodeParams {
  email: string;
  tipo: EmailVerificationTipo;
  id_usuario?: number | null;
  userName?: string;
}

export interface VerifyCodeParams {
  email: string;
  codigo: string;
  tipo: EmailVerificationTipo;
  id_usuario?: number | null;
}

export interface IsVerifiedParams {
  email: string;
  tipo: EmailVerificationTipo;
  maxAgeHours?: number;
}

export class EmailVerificationService {
  /**
   * Genera un código OTP de 6 dígitos con 15 minutos de expiración,
   * lo guarda en codigo_verificacion_email y envía el correo correspondiente.
   */
  static async sendCode(params: SendVerificationCodeParams) {
    const { email, tipo, id_usuario = null, userName = '' } = params;

    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email).trim())) {
      throw new Error("El correo electrónico proporcionado no es válido.");
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Generar código numérico de 6 dígitos (100000 - 999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expiración: 15 minutos a partir de ahora
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Inactivar/marcar como no válidos tokens previos no verificados del mismo email y tipo
    await db
      .updateTable("codigo_verificacion_email")
      .set({ verified: false })
      .where("email", "=", cleanEmail)
      .where("tipo", "=", tipo)
      .where("verified", "=", false)
      .execute();

    // Guardar nuevo código de verificación
    await db
      .insertInto("codigo_verificacion_email")
      .values({
        email: cleanEmail,
        codigo: code,
        tipo,
        id_usuario,
        expires_at: expiresAt,
        verified: false
      })
      .execute();

    // Enviar correo según el tipo de flujo
    if (tipo === 'MATRICULA_NUEVA') {
      await NotificationService.sendEnrollmentEmailVerificationCode(cleanEmail, code);
    } else if (tipo === 'CAMBIO_CORREO') {
      await NotificationService.sendEmailChangeCode(cleanEmail, userName || 'Usuario', code);
    }

    return {
      message: `Código de verificación de 6 dígitos enviado exitosamente al correo ${cleanEmail}. Válido por 15 minutos.`
    };
  }

  /**
   * Verifica el código OTP de 6 dígitos para el email y tipo indicados.
   */
  static async verifyCode(params: VerifyCodeParams) {
    const { email, codigo, tipo, id_usuario = null } = params;

    if (!email || !codigo) {
      throw new Error("El correo electrónico y el código de verificación son obligatorios.");
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(codigo).trim();

    let query = db
      .selectFrom("codigo_verificacion_email")
      .selectAll()
      .where("email", "=", cleanEmail)
      .where("codigo", "=", cleanCode)
      .where("tipo", "=", tipo)
      .where("verified", "=", false)
      .where("expires_at", ">", new Date());

    if (id_usuario !== null && id_usuario !== undefined) {
      query = query.where("id_usuario", "=", id_usuario);
    }

    const record = await query.orderBy("created_at", "desc").executeTakeFirst();

    if (!record) {
      throw new Error("El código de verificación es incorrecto o ha expirado. Por favor solicita uno nuevo.");
    }

    // Marcar como verificado
    await db
      .updateTable("codigo_verificacion_email")
      .set({ verified: true })
      .where("id_verificacion", "=", record.id_verificacion)
      .execute();

    return {
      verified: true,
      message: "Correo electrónico verificado exitosamente."
    };
  }

  /**
   * Comprueba si existe una verificación exitosa reciente para el email y tipo.
   */
  static async isVerified(params: IsVerifiedParams): Promise<boolean> {
    const { email, tipo, maxAgeHours = 2 } = params;
    const cleanEmail = String(email).trim().toLowerCase();
    const minDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const record = await db
      .selectFrom("codigo_verificacion_email")
      .select(["id_verificacion"])
      .where("email", "=", cleanEmail)
      .where("tipo", "=", tipo)
      .where("verified", "=", true)
      .where("created_at", ">", minDate)
      .executeTakeFirst();

    return Boolean(record);
  }
}
