import { Request, Response } from "express";
import { pool } from "../config/db";
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
    const userRes = await pool.query(
      "SELECT id_usuario, nombre, apellido FROM usuario WHERE email = $1 AND estado != 'ELIMINADO'",
      [email]
    );

    if (userRes.rows.length === 0) {
      // Retornar éxito genérico por seguridad y prevención de enumeración
      res.json({ message: "Si el correo está registrado, recibirás un enlace de recuperación en breve." });
      return;
    }

    const user = userRes.rows[0];

    // 2. Generar token UUID y expiración (1 hora)
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // 3. Guardar token en BD (invalidar anteriores activos)
    await pool.query(
      "UPDATE password_reset_tokens SET used = true WHERE id_usuario = $1 AND used = false",
      [user.id_usuario]
    );

    await pool.query(
      "INSERT INTO password_reset_tokens (id_usuario, token, expires_at, used) VALUES ($1, $2, $3, false)",
      [user.id_usuario, token, expiresAt]
    );

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

  if (password.length < 6) {
    res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Validar token
    const tokenRes = await client.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (tokenRes.rows.length === 0) {
      res.status(400).json({ error: "El token es inválido, ha expirado o ya fue utilizado." });
      await client.query("ROLLBACK");
      return;
    }

    const resetToken = tokenRes.rows[0];

    // 2. Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Actualizar contraseña del usuario
    await client.query(
      "UPDATE usuario SET password = $1 WHERE id_usuario = $2",
      [hashedPassword, resetToken.id_usuario]
    );

    // 4. Marcar token como utilizado
    await client.query(
      "UPDATE password_reset_tokens SET used = true WHERE id = $1",
      [resetToken.id]
    );

    await client.query("COMMIT");
    res.json({ message: "Contraseña restablecida exitosamente." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in resetPassword:", error);
    res.status(500).json({ error: "Error en el servidor al restablecer la contraseña." });
  } finally {
    client.release();
  }
};
