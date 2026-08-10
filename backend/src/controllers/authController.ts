import { Request, Response } from "express";
import { pool } from "../config/db";
import { db } from "../config/kysely";
import { sql } from "kysely";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { NotificationService } from "../services/notificationService";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: "El correo o código es obligatorio" });
    return;
  }

  const credential = email.trim();

  try {
    if (credential.includes("@")) {
      // --- LOGIN GENERAL (Email: directivo, docente, padre, admin_general) ---
      const user = await db
        .selectFrom("usuario as u")
        .leftJoin("usuario_rol as ur", "ur.id_usuario", "u.id_usuario")
        .leftJoin("rol as r", "r.id_rol", "ur.id_rol")
        .select([
          "u.id_usuario",
          "u.email",
          "u.password",
          "u.nombre",
          "u.apellido",
          "u.id_colegio",
          "u.estado",
          sql<string[]>`array_agg(r.nombre)`.as("roles")
        ])
        .where("u.email", "=", credential)
        .groupBy(["u.id_usuario", "u.email", "u.password", "u.nombre", "u.apellido", "u.id_colegio", "u.estado"])
        .executeTakeFirst();

      if (!user) {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      // Verificar estado del usuario
      if (user.estado === 'BANEADO') {
        res.status(403).json({ error: "Tu cuenta ha sido baneada. Contacta al administrador." });
        return;
      }
      if (user.estado === 'SUSPENDIDO') {
        res.status(403).json({ error: "Tu cuenta se encuentra suspendida." });
        return;
      }
      if (user.estado === 'ELIMINADO') {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      // Consultar vinculaciones de institucion en usuario_colegio
      const activeSchools = await db
        .selectFrom("usuario_colegio as uc")
        .innerJoin("colegio as c", "c.id_colegio", "uc.id_colegio")
        .select(["uc.id_colegio", "c.estado as colegio_estado"])
        .where("uc.id_usuario", "=", user.id_usuario)
        .where("uc.estado", "=", "ACTIVO")
        .execute();

      let activeSchoolId: number | null = user.id_colegio || (activeSchools.length > 0 ? activeSchools[0].id_colegio : null);

      if (activeSchools.length > 0) {
        const firstSchool = activeSchools[0];
        if (firstSchool.colegio_estado === 'PENDIENTE') {
          res.status(403).json({ error: "El colegio asociado aún no ha sido aprobado." });
          return;
        }
        if (firstSchool.colegio_estado === 'SUSPENDIDO') {
          res.status(403).json({ error: "El colegio asociado se encuentra suspendido." });
          return;
        }
        if (firstSchool.colegio_estado === 'RECHAZADO' || firstSchool.colegio_estado === 'ELIMINADO') {
          res.status(403).json({ error: "El colegio asociado no tiene acceso al sistema." });
          return;
        }
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      const schoolIds = activeSchools.map((s: { id_colegio: number }) => Number(s.id_colegio));

      // Generar JWT
      const jti = crypto.randomUUID();
      const token = jwt.sign(
        { 
          id: user.id_usuario, 
          email: user.email, 
          role: user.roles[0], 
          roles: user.roles,
          schoolId: activeSchoolId,
          schoolIds: schoolIds.length > 0 ? schoolIds : undefined,
          jti
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        user: {
          id: userWithoutPassword.id_usuario,
          name: userWithoutPassword.nombre,
          email: userWithoutPassword.email,
          role: userWithoutPassword.roles[0],
          roles: userWithoutPassword.roles,
          schoolId: activeSchoolId,
          schoolIds: schoolIds.length > 0 ? schoolIds : undefined
        },
        token
      });

    } else {
      // --- LOGIN ESTUDIANTE (Código: e.g. EST-1-12) ---
      const user = await db
        .selectFrom("estudiante as e")
        .innerJoin("usuario as u", "u.id_usuario", "e.id_usuario")
        .leftJoin("usuario_rol as ur", "ur.id_usuario", "u.id_usuario")
        .leftJoin("rol as r", "r.id_rol", "ur.id_rol")
        .select([
          "e.id_usuario",
          "e.estado as estado_estudiante",
          "u.email",
          "u.nombre",
          "u.password",
          "u.id_colegio",
          "u.estado",
          sql<string[]>`array_agg(r.nombre)`.as("roles")
        ])
        .where((eb) => eb.or([
          eb("e.codigo", "=", credential),
          eb("u.documento", "=", credential),
          eb(sql`LOWER(u.email)`, "=", credential.toLowerCase())
        ]))
        .groupBy(["e.id_usuario", "e.estado", "u.email", "u.nombre", "u.password", "u.id_colegio", "u.estado"])
        .executeTakeFirst();

      if (!user) {
        res.status(401).json({ error: "Código o contraseña incorrectos" });
        return;
      }

      // Verificar estado del estudiante (expulsado no puede ingresar)
      if (user.estado_estudiante === 'EXPULSADO') {
        res.status(403).json({ error: "Tu cuenta ha sido suspendida por expulsión. No tienes acceso al sistema." });
        return;
      }

      // Verificar estado del usuario
      if (user.estado !== 'ACTIVO') {
        res.status(403).json({ error: "Tu cuenta no se encuentra activa. Contacta al administrador." });
        return;
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({ error: "Código o contraseña incorrectos" });
        return;
      }

      // Generar JWT
      const jti = crypto.randomUUID();
      const token = jwt.sign(
        { 
          id: user.id_usuario, 
          email: user.email, 
          role: "estudiante", 
          roles: user.roles,
          schoolId: user.id_colegio,
          jti
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.json({
        user: {
          id: user.id_usuario,
          name: user.nombre,
          email: user.email,
          role: "estudiante",
          roles: user.roles,
          schoolId: user.id_colegio
        },
        token
      });
    }
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const studentLogin = async (req: Request, res: Response): Promise<void> => {
  const { codigo, password } = req.body;

  try {
    // Buscar el estudiante por su código usando Kysely
    const user = await db
      .selectFrom("estudiante as e")
      .innerJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .leftJoin("usuario_rol as ur", "ur.id_usuario", "u.id_usuario")
      .leftJoin("rol as r", "r.id_rol", "ur.id_rol")
      .select([
        "e.id_usuario",
        "e.estado as estado_estudiante",
        "u.email",
        "u.nombre",
        "u.password",
        "u.id_colegio",
        "u.estado",
        sql<string[]>`array_agg(r.nombre)`.as("roles")
      ])
      .where("e.codigo", "=", codigo)
      .groupBy(["e.id_usuario", "e.estado", "u.email", "u.nombre", "u.password", "u.id_colegio", "u.estado"])
      .executeTakeFirst();

    if (!user) {
      res.status(401).json({ error: "Código o contraseña incorrectos" });
      return;
    }

    // Verificar estado del estudiante (expulsado no puede ingresar)
    if (user.estado_estudiante === 'EXPULSADO') {
      res.status(403).json({ error: "Tu cuenta ha sido suspendida por expulsión. No tienes acceso al sistema." });
      return;
    }

    // Verificar estado del usuario
    if (user.estado !== 'ACTIVO') {
      res.status(403).json({ error: "Tu cuenta no se encuentra activa. Contacta al administrador." });
      return;
    }

    // 2. Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: "Código o contraseña incorrectos" });
      return;
    }

    // 3. Generar JWT
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { 
        id: user.id_usuario, 
        email: user.email, 
        role: "estudiante", 
        roles: user.roles,
        schoolId: user.id_colegio,
        jti
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // 4. Responder
    res.json({
      user: {
        id: user.id_usuario,
        name: user.nombre,
        email: user.email,
        role: "estudiante",
        roles: user.roles,
        schoolId: user.id_colegio
      },
      token
    });

  } catch (error: any) {
    console.error("Student Login error:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getSchoolIdentity = async (req: Request, res: Response): Promise<void> => {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const schoolRes = await pool.query(
      `SELECT id_colegio, nombre, escudo_url, color_primario, color_secundario 
       FROM colegio 
       WHERE id_colegio = $1`,
      [schoolId]
    );

    if (schoolRes.rows.length === 0) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }

    const school = schoolRes.rows[0];
    
    const DEFAULT_PRIMARY = "#4f46e5";
    const DEFAULT_SECONDARY = "#0f172a";

    res.json({
      id_colegio: school.id_colegio,
      nombre: school.nombre,
      escudo_url: school.escudo_url || null,
      color_primario: school.color_primario || DEFAULT_PRIMARY,
      color_secundario: school.color_secundario || DEFAULT_SECONDARY
    });
  } catch (error: any) {
    console.error("Error getting school identity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

/**
 * GET /api/auth/verify
 * Verifica que el JWT sea válido y que el usuario siga activo.
 * Usado por el frontend en el router guard para evitar acceso con tokens expirados/invalidados.
 */
export const verifySession = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ valid: false, error: 'Token requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verificar blacklist
    if (decoded.jti) {
      const blacklistRes = await pool.query(
        'SELECT 1 FROM token_blacklist WHERE jti = $1',
        [decoded.jti]
      );
      if (blacklistRes.rows.length > 0) {
        res.status(401).json({ valid: false, error: 'Sesión invalidada' });
        return;
      }
    }

    // Verificar estado del usuario e invalidación global
    const userDbRes = await pool.query(
      'SELECT estado, logged_out_at FROM usuario WHERE id_usuario = $1',
      [decoded.id]
    );

    if (userDbRes.rows.length === 0) {
      res.status(401).json({ valid: false, error: 'Usuario no encontrado' });
      return;
    }

    const dbUser = userDbRes.rows[0];

    if (dbUser.estado !== 'ACTIVO') {
      res.status(401).json({ valid: false, error: 'Cuenta inactiva o suspendida' });
      return;
    }

    if (dbUser.logged_out_at && decoded.iat) {
      const loggedOutTime = new Date(dbUser.logged_out_at).getTime();
      const tokenIssuedTime = decoded.iat * 1000;
      if (tokenIssuedTime < loggedOutTime) {
        res.status(401).json({ valid: false, error: 'Sesión expirada' });
        return;
      }
    }

    res.json({ valid: true, userId: decoded.id });
  } catch {
    res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
  }
};

export const requestEmailChange = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { nuevo_email } = req.body;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  const targetEmail = (nuevo_email || '').trim().toLowerCase();
  if (!targetEmail || !targetEmail.includes("@")) {
    res.status(400).json({ error: "Debe proporcionar un correo electrónico válido." });
    return;
  }

  try {
    const userId = Number(user.id);

    // 1. Obtener datos del usuario
    const userRes = await pool.query(
      'SELECT email, nombre, apellido FROM usuario WHERE id_usuario = $1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }

    const currentEmail = (userRes.rows[0].email || '').trim().toLowerCase();
    const userName = `${userRes.rows[0].nombre} ${userRes.rows[0].apellido || ''}`.trim();

    if (currentEmail === targetEmail) {
      res.status(400).json({ error: "El nuevo correo electrónico es idéntico al actual." });
      return;
    }

    // 2. Verificar que el nuevo correo no esté registrado por otro usuario
    const checkRes = await pool.query(
      'SELECT 1 FROM usuario WHERE LOWER(email) = $1 AND id_usuario != $2',
      [targetEmail, userId]
    );

    if (checkRes.rows.length > 0) {
      res.status(400).json({ error: "El correo electrónico ya se encuentra registrado en la plataforma por otra cuenta." });
      return;
    }

    // 3. Generar código numérico de 6 dígitos aleatorio
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expiración en 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Inactivar tokens anteriores no usados de este usuario
    await pool.query(
      'UPDATE email_change_tokens SET used = TRUE WHERE id_usuario = $1 AND used = FALSE',
      [userId]
    );

    // Insertar nuevo token
    await pool.query(
      `INSERT INTO email_change_tokens (id_usuario, nuevo_email, codigo, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, targetEmail, code, expiresAt]
    );

    // 4. Enviar email con el código de 6 dígitos al NUEVO correo electrónico
    await NotificationService.sendEmailChangeCode(targetEmail, userName, code);

    res.json({ 
      message: `Código de verificación enviado exitosamente al correo ${targetEmail}. Por favor ingresa los 6 dígitos para confirmar el cambio.` 
    });
  } catch (error) {
    console.error("Error requesting email change:", error);
    res.status(500).json({ error: "Error al generar la solicitud de cambio de correo." });
  }
};

export const verifyEmailChange = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { nuevo_email, codigo } = req.body;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  const targetEmail = (nuevo_email || '').trim().toLowerCase();
  const inputCode = (codigo || '').trim();

  if (!targetEmail || !inputCode) {
    res.status(400).json({ error: "Correo electrónico y código de verificación son requeridos." });
    return;
  }

  try {
    const userId = Number(user.id);

    // 1. Buscar token activo matching id_usuario, nuevo_email y codigo
    const tokenRes = await pool.query(
      `SELECT id, expires_at 
       FROM email_change_tokens 
       WHERE id_usuario = $1 
         AND LOWER(nuevo_email) = $2 
         AND codigo = $3 
         AND used = FALSE 
         AND expires_at > NOW()
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, targetEmail, inputCode]
    );

    if (tokenRes.rows.length === 0) {
      res.status(400).json({ error: "El código de verificación es incorrecto o ha expirado. Por favor solicita uno nuevo." });
      return;
    }

    const tokenId = tokenRes.rows[0].id;

    // 2. Verificar por seguridad que el correo no se haya ocupado mientras tanto
    const checkRes = await pool.query(
      'SELECT 1 FROM usuario WHERE LOWER(email) = $1 AND id_usuario != $2',
      [targetEmail, userId]
    );

    if (checkRes.rows.length > 0) {
      res.status(400).json({ error: "El correo electrónico ya se encuentra registrado por otro usuario." });
      return;
    }

    // 3. Actualizar correo en la tabla usuario
    await pool.query(
      'UPDATE usuario SET email = $1 WHERE id_usuario = $2',
      [targetEmail, userId]
    );

    // 4. Marcar token como usado
    await pool.query(
      'UPDATE email_change_tokens SET used = TRUE WHERE id = $1',
      [tokenId]
    );

    res.json({ message: "Correo electrónico verificado y actualizado exitosamente." });
  } catch (error) {
    console.error("Error verifying email change:", error);
    res.status(500).json({ error: "Error al verificar el código de cambio de correo." });
  }
};

export const updateProfilePassword = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { password_actual, nueva_password } = req.body;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  if (!password_actual || !nueva_password || nueva_password.length < 6) {
    res.status(400).json({ error: "Debe proporcionar la contraseña actual y una nueva contraseña de al menos 6 caracteres." });
    return;
  }

  try {
    const userId = Number(user.id);
    
    // Obtener contraseña actual hasheada
    const userRes = await pool.query(
      'SELECT password FROM usuario WHERE id_usuario = $1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }

    const dbPassword = userRes.rows[0].password;

    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(password_actual, dbPassword);
    if (!validPassword) {
      res.status(400).json({ error: "La contraseña actual es incorrecta." });
      return;
    }

    // Hashear y actualizar la nueva contraseña
    const hashedNew = await bcrypt.hash(nueva_password, 10);
    await pool.query(
      'UPDATE usuario SET password = $1 WHERE id_usuario = $2',
      [hashedNew, userId]
    );

    res.json({ message: "Contraseña actualizada exitosamente." });
  } catch (error) {
    console.error("Error updating profile password:", error);
    res.status(500).json({ error: "Error al actualizar la contraseña." });
  }
};

export const updateProfilePhone = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { telefono } = req.body;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  try {
    const userId = Number(user.id);
    const newPhone = telefono ? String(telefono).trim() : null;

    // Actualizar teléfono en la tabla usuario
    await pool.query(
      'UPDATE usuario SET telefono = $1 WHERE id_usuario = $2',
      [newPhone, userId]
    );

    res.json({ message: "Teléfono de contacto actualizado exitosamente." });
  } catch (error) {
    console.error("Error updating profile phone:", error);
    res.status(500).json({ error: "Error al actualizar el teléfono." });
  }
};

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  try {
    const userId = req.query.userId ? Number(req.query.userId) : Number(user.id);
    
    // Obtener datos unificados del usuario
    const userRes = await pool.query(
      `SELECT 
         u.id_usuario, 
         u.nombre, 
         u.apellido, 
         u.email, 
         u.estado, 
         u.fecha_creacion,
         u.documento,
         td_u.tipo AS tipo_documento,
         u.telefono AS telefono
       FROM usuario u
       LEFT JOIN tipo_documento td_u ON u.id_tipodocumento = td_u.id_tipodocumento
       WHERE u.id_usuario = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }

    const userData = userRes.rows[0];
    const userRole = (user.role || '').toUpperCase();

    const profileObj = {
      id_usuario: userData.id_usuario,
      nombre: userData.nombre,
      apellido: userData.apellido,
      email: userData.email,
      estado: userData.estado,
      fecha_creacion: userData.fecha_creacion,
      rol: userRole,
      documento: userData.documento || 'No Registrado',
      tipo_documento: userData.tipo_documento || 'No Registrado',
      telefono: userData.telefono || null
    };

    res.json({
      ...profileObj,
      user: profileObj
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Error al consultar los datos del perfil." });
  }
};


