import { Request, Response } from "express";
import { db } from "../config/kysely";
import { sql } from "kysely";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { NotificationService } from "../services/notificationService";

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "El correo electrónico es requerido." });
    return;
  }

  try {
    // 1. Buscar usuario por correo
    const user = await db
      .selectFrom("usuario")
      .select(["id_usuario", "nombre", "apellido"])
      .where("email", "=", email)
      .where("estado", "!=", "ELIMINADO")
      .executeTakeFirst();

    if (!user) {
      // Retornar éxito genérico por seguridad y prevención de enumeración
      res.json({ message: "Si el correo está registrado, recibirás un enlace de recuperación en breve." });
      return;
    }

    // 2. Generar token UUID y expiración (1 hora)
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // 3. Guardar token en BD (invalidar anteriores activos)
    await db
      .updateTable("password_reset_tokens")
      .set({ used: true })
      .where("id_usuario", "=", user.id_usuario)
      .where("used", "=", false)
      .execute();

    await db
      .insertInto("password_reset_tokens")
      .values({
        id_usuario: user.id_usuario,
        token,
        expires_at: expiresAt,
        used: false
      })
      .execute();

    // 4. Enviar correo con el enlace de recuperación
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://academianeiva.adsoproject.dev").replace(/\/$/, "");
    const resetLink = `${frontendUrl}/reset-password/${token}`;
    const userName = `${user.nombre} ${user.apellido}`;

    await NotificationService.sendPasswordResetEmail(email, userName, resetLink);

    res.json({ message: "Si el correo está registrado, recibirás un enlace de recuperación en breve." });
  } catch (error: any) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ error: "Error en el servidor al procesar la solicitud." });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400).json({ error: "El token y la nueva contraseña son requeridos." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    return;
  }

  try {
    let success = false;
    await db.transaction().execute(async (trx) => {
      // 1. Validar token
      const resetToken = await trx
        .selectFrom("password_reset_tokens")
        .selectAll()
        .where("token", "=", token)
        .where("used", "=", false)
        .where("expires_at", ">", new Date())
        .executeTakeFirst();

      if (!resetToken) {
        res.status(400).json({ error: "El token es inválido, ha expirado o ya fue utilizado." });
        return;
      }

      // 2. Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Actualizar contraseña del usuario
      await trx
        .updateTable("usuario")
        .set({ password: hashedPassword })
        .where("id_usuario", "=", resetToken.id_usuario)
        .execute();

      // 4. Marcar token como utilizado
      await trx
        .updateTable("password_reset_tokens")
        .set({ used: true })
        .where("id", "=", resetToken.id)
        .execute();

      success = true;
    });

    if (success) {
      res.json({ message: "Contraseña restablecida exitosamente." });
    }
  } catch (error: any) {
    console.error("Error in resetPassword:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error en el servidor al restablecer la contraseña." });
    }
  }
};
